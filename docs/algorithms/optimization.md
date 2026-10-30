# Strategy optimisation in RoboRoute

Code: `backend/src/roboroute/engine/optimization` and `engine/missions/validation.py`.
Design: `docs/architecture/phase-0-design.md` §8.

## 1. The problem

A robot game gives you a time budget $B$ (for example 150 s) and a set of missions, each with
points, a duration, a success probability and a place on the field. Some missions need others
first, some exclude each other, some need a particular attachment. Which missions should the robot
do, in which order, and in how many runs, to score the most?

This is not the travelling-salesperson problem. It is closer to the **orienteering problem**
(collect as much value as possible within a time limit), extended with precedence constraints,
exclusions, attachments, runs and uncertainty. These problems are NP-hard in general, so there is
no known fast algorithm for large instances. Competition sizes (up to about 16 candidate missions)
are small enough to solve **exactly**.

## 2. The planning model

| Symbol | Meaning |
|---|---|
| $\tau_{ij}$ | travel time from node $i$ to node $j$ (node 0 = start/home), from the travel matrix |
| $d_k$ | planning duration of mission $k$: mean execution time, plus every retry if retries are allowed |
| $p_k,\ m_k$ | per-attempt success probability, number of attempts allowed |
| $P_k = 1 - (1 - p_k)^{m_k}$ | probability that mission $k$ eventually succeeds |
| $r_k$ | points for mission $k$ (from the scoring profile) |

**Expected score.** If mission $b$ requires mission $a$ to have *succeeded*, $b$ can only score
when both succeed. Let $\text{Need}(k)$ be all missions whose success $k$ depends on. With
independent outcomes:

$$E[\text{score} \mid S] = \sum_{k \in S} r_k \, P_k \prod_{j \in \text{Need}(k)} P_j
\;+\; \text{bonuses} \;-\; \text{penalties}.$$

Bonuses ("all of these succeed") multiply the probabilities of everything involved; a failure
penalty applies when the mission is attempted (its requirements succeeded) and still fails.

**The key observation:** the expected score depends only on the **set** $S$ of chosen missions,
never on their order. Order only affects *time*. So the question becomes: "of all sets that can be
done within the budget in some valid order, which one has the highest expected score?"

## 3. Exact solution: dynamic programming over subsets

State $(S, j, a)$: missions $S$ are done, the robot is at node $j$, attachment $a$ is mounted
($a = 0$: not committed yet — the team mounts what is needed when launching). $C(S, j, a)$ is the
least time to reach that state.

$$C(\varnothing, 0, 0) = 0$$
$$C(S \cup \{k\},\ k,\ a') = \min_{j}\ C(S, j, a) + \tau_{jk} + d_k$$

allowed only if $k \notin S$, everything $k$ requires is in $S$, nothing $k$ excludes is in $S$,
nothing that must come *after* $k$ is already in $S$, and the attachment fits. In multi-run formats
the robot may also go home:

$$C(S, 0, 0) = \min_{j, a}\ C(S, j, a) + \tau_{j0} + \text{reset time}.$$

A set $S$ is feasible if its best completion time (plus the trip home, if the format requires
ending there) is at most $B$. The answer is the feasible set with the highest expected score;
ties go to the shorter time (like WRO's time tie-break).

**Why it is correct.** What happens next depends only on *which* missions are done, *where* the
robot is and *which* attachment is mounted — not on the order that got it there (the *Markov
property*). So for each state only the fastest way to reach it matters; keeping only that loses
no plan. Because the score depends only on $S$, knowing the fastest time for every set is enough
to find the best plan.

**Complexity.** About $2^n \cdot n^2 \cdot A$ operations and $2^n \cdot n \cdot A$ memory ($n$
missions, $A$ attachment states). Measured: about 0.4 s for 12 missions and 6 s for 16 (pure
Python with NumPy). States that already exceed the budget are discarded, which helps a lot when the
budget is tight. RoboRoute limits exact optimisation to 16 candidate missions.

**Example (design doc §8.3).** Budget 100 s; X = 10 points / 10 s; Y = 90 points / 95 s. The DP
finds that {X, Y} needs 105 s (infeasible), {Y} needs 95 s (90 points), {X} needs 10 s (10 points):
the answer is Y.

## 4. Independent check: brute force

`bruteforce.py` tries every ordered selection of missions and, in multi-run formats, every way of
splitting it into runs. It shares nothing with the DP except the function that evaluates a plan.
The tests compare DP and brute force on 300 random instances per run (with constraints,
attachments and both formats). Three deliberately introduced DP bugs were each caught by these
tests (mutation testing).

## 5. Baseline: greedy

Repeatedly add the mission with the highest *expected points per second* (including any trip home
to change attachments) that still fits. Fast, intuitive — and not optimal. Experiment 2 measured:
with 12 missions greedy found the optimum in only 1–17 % of random instances and lost about 6 % of
the expected score on average (up to 49 % on small instances). Experiment 4 showed that greedy can
even get *worse* when the robot gets faster.

## 6. Explanations

All explanations are computed, never written by a language model:

- **Time breakdown**: travel, mission work, resets, slack.
- **Counterfactuals**: because the DP knows the best completion time of *every* set, RoboRoute can
  answer exactly: "what is the best plan **with** this mission?" (for left-out missions) and
  "what is the best plan **without** it?" (for chosen ones).
- **Speed sensitivity**: route geometry re-timed with scaled top speeds, problem re-solved.
- **Excluded missions**: unreachable, impossible (contradictory constraints), dependent on an
  impossible mission, or too long for the budget on their own — each with its reason.

## 7. Limitations

- **Deterministic planning.** The model plans with mean durations and budgets every retry. Real
  runs vary; Monte Carlo simulation (milestone M4) measures how plans behave under uncertainty and
  can re-rank the top plans.
- **Independence.** Mission outcomes are treated as independent. In reality, a robot that is badly
  aligned may fail several missions in a row.
- **A plan is not a policy.** The plan does not adapt during the match (except skipping missions
  whose requirement failed). Adaptive strategies would need a Markov decision process.
- **Exponential growth.** Beyond about 16 missions the exact method is too slow; only greedy is
  offered there.

## 8. How it is tested

| Test | What it proves |
|---|---|
| `test_dp_matches_brute_force` (300 random instances) | DP finds the optimum |
| `test_dp_finds_every_feasible_set` | DP's best time per set is never worse than any enumerated plan |
| `test_greedy_is_feasible_and_never_beats_the_optimum` | greedy is a valid lower bound |
| `test_greedy_falls_into_the_ratio_trap` | greedy's known weakness is real |
| `test_instance.py` | probabilities, requirement semantics, bonuses, penalties, exclusions |
| `test_validation.py` | cycles (with the cycle path), impossible missions |
| `test_explain.py` | counterfactual values, time breakdown, monotonic speed sensitivity |
