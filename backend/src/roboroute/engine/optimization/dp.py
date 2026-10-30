"""Exact optimisation by dynamic programming over subsets (design doc §8.2).

State (S, j, a): the missions in S are done, the robot is at node j (0 = home, i + 1 = mission i),
and attachment a is mounted (0 = not yet committed — the team mounts whatever is needed when it
launches from home). C(S, j, a) is the least time to reach that state.

    C(∅, 0, 0) = 0
    C(S ∪ {k}, k+1, a') = min_j C(S, j, a) + τ(j, k+1) + d_k
        if k ∉ S, requires(k) ⊆ S, k excludes nothing in S, nothing that must follow k is in S,
        and k's attachment is compatible with a (a' is k's attachment, or a if it needs none)
    C(S, 0, 0) = min_{j,a} C(S, j, a) + τ(j, 0) + reset        (multi-run only: return home)

Why it is exact: the time to continue from a state depends only on (S, j, a) — not on the order in
which S was done (the Markov property) — and the expected score depends only on S (design doc
§8.1). So keeping only the fastest way to reach each state loses nothing, and every set S that
can be done in time is found with its least completion time.

States whose time already exceeds the budget are discarded (time never decreases).
Complexity: O(2ⁿ · n² · A) time and O(2ⁿ · n · A) memory for n missions and A attachments.
"""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from roboroute.engine.optimization.instance import PlanningInstance
from roboroute.engine.optimization.plan import TOLERANCE, Plan, evaluate

MAX_EXACT_MISSIONS = 16


class TooManyMissionsError(ValueError):
    pass


@dataclass(frozen=True)
class DPResult:
    best: Plan
    top: list[Plan]
    completion_time: NDArray[np.float64]  # least completion time per mask (inf if impossible)
    scores: NDArray[np.float64]  # expected score per mask
    feasible: NDArray[np.bool_]


def solve(instance: PlanningInstance, top_k: int = 5) -> DPResult:
    n = instance.n
    if n > MAX_EXACT_MISSIONS:
        raise TooManyMissionsError(
            f"Exact optimisation is limited to {MAX_EXACT_MISSIONS} missions ({n} given)."
        )
    size = 1 << n
    states = len(instance.attachments) + 1
    budget = instance.budget + TOLERANCE

    cost = np.full((size, n + 1, states), math.inf)
    parent_node = np.full((size, n + 1, states), -1, dtype=np.int16)
    parent_att = np.full((size, n + 1, states), -1, dtype=np.int16)
    cost[0, 0, 0] = 0.0

    bits = np.left_shift(1, np.arange(n, dtype=np.int64))
    requires = np.array(instance.requires_mask, dtype=np.int64)
    excludes = np.array(instance.excludes_mask, dtype=np.int64)
    after = np.array(instance.after_mask, dtype=np.int64)
    attachment = np.array(instance.attachment, dtype=np.int64)
    to_mission = instance.tau[:, 1:] + instance.duration[None, :]  # (n+1) × n
    home = instance.tau[1:, 0] + instance.reset_time  # from mission node i+1 back home

    for mask in range(size):
        layer = cost[mask]
        if not np.isfinite(layer).any():
            continue
        if instance.multi_run and mask:
            back = layer[1:, :] + home[:, None]
            flat = int(np.argmin(back))
            j, a = divmod(flat, states)
            if back[j, a] <= budget and back[j, a] < layer[0, 0]:
                layer[0, 0] = back[j, a]
                parent_node[mask, 0, 0] = j + 1
                parent_att[mask, 0, 0] = a

        allowed = (
            ((bits & mask) == 0)
            & ((requires & ~mask) == 0)
            & ((excludes & mask) == 0)
            & ((after & mask) == 0)
        )
        ks = np.nonzero(allowed)[0]
        if ks.size == 0:
            continue
        new_masks = mask | bits[ks]
        nodes = ks + 1
        for a in range(states):
            column = layer[:, a]
            if not np.isfinite(column).any():
                continue
            candidates = column[:, None] + to_mission[:, ks]
            best_j = np.argmin(candidates, axis=0)
            best = candidates[best_j, np.arange(ks.size)]
            needs = attachment[ks]
            compatible = (needs == 0) | (a == 0) | (needs == a)
            new_a = np.where(needs == 0, a, needs)
            current = cost[new_masks, nodes, new_a]
            improve = compatible & (best <= budget) & (best < current)
            if improve.any():
                idx = np.nonzero(improve)[0]
                cost[new_masks[idx], nodes[idx], new_a[idx]] = best[idx]
                parent_node[new_masks[idx], nodes[idx], new_a[idx]] = best_j[idx]
                parent_att[new_masks[idx], nodes[idx], new_a[idx]] = a

    end = instance.tau[:, 0].copy() if instance.must_end_in_home else np.zeros(n + 1)
    end[0] = 0.0
    totals = (cost + end[None, :, None]).reshape(size, -1)
    best_state = np.argmin(totals, axis=1)
    completion = totals[np.arange(size), best_state]
    feasible = completion <= budget
    scores = instance.expected_scores()

    candidates_masks = np.nonzero(feasible)[0]
    # Higher score first; ties by shorter time (lexicographic, like the WRO tie-break).
    order = np.lexsort((completion[candidates_masks], -np.round(scores[candidates_masks], 9)))
    top: list[Plan] = []
    for mask in candidates_masks[order][:top_k]:
        node, att = divmod(int(best_state[mask]), states)
        runs = _reconstruct(int(mask), node, att, parent_node, parent_att)
        plan = evaluate(instance, runs)
        if plan is None or abs(plan.completion_time - completion[mask]) > 1e-6:
            raise AssertionError(f"DP reconstruction inconsistent for mask {mask:b}")
        top.append(plan)
    return DPResult(
        best=top[0], top=top, completion_time=completion, scores=scores, feasible=feasible
    )


def _reconstruct(
    mask: int,
    node: int,
    att: int,
    parent_node: NDArray[np.int16],
    parent_att: NDArray[np.int16],
) -> list[list[int]]:
    """Follow parent pointers back to the start; home visits split the sequence into runs."""
    reversed_nodes: list[int] = []
    while not (mask == 0 and node == 0):
        previous_node = int(parent_node[mask, node, att])
        previous_att = int(parent_att[mask, node, att])
        reversed_nodes.append(node)
        if node != 0:
            mask ^= 1 << (node - 1)
        node, att = previous_node, previous_att
    runs: list[list[int]] = [[]]
    for visited in reversed(reversed_nodes):
        if visited == 0:
            runs.append([])
        else:
            runs[-1].append(visited - 1)
    return [run for run in runs if run]
