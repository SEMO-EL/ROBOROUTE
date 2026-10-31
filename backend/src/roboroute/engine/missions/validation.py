"""Semantic checks of mission constraints, beyond the schema's reference checks.

- **Cycles.** ``requires`` and ``precedes`` both say "this mission comes first". If these
  "comes before" edges form a cycle, no order can satisfy them: an error.
- **Contradictions.** If a mission's transitive requirements (plus itself) contain two missions
  that exclude each other, it can never be done: a warning (the rest of the scenario is still
  solvable; the optimiser simply leaves that mission out and says why).
- **Placement.** A start or approach pose where the robot's collision disc touches an obstacle or
  wall cannot be reached: a warning, shown while editing rather than discovered when optimising.
"""

from roboroute.engine.geometry.clearance import ClearanceField
from roboroute.engine.models import Excludes, Issue, Precedes, Requires, Scenario
from roboroute.engine.units import format_point_cm


def precedence_graph(scenario: Scenario) -> dict[str, list[str]]:
    """Edges ``before → after`` from requires and precedes constraints, in definition order."""
    graph: dict[str, list[str]] = {m.id: [] for m in scenario.missions}
    for constraint in scenario.constraints:
        if isinstance(constraint, Requires | Precedes):
            graph[constraint.before].append(constraint.after)
    return graph


def find_cycle(graph: dict[str, list[str]]) -> list[str] | None:
    """A directed cycle as a closed path ``[a, b, …, a]``, or None (iterative DFS, 3 colours)."""
    white, grey, black = 0, 1, 2
    colour = dict.fromkeys(graph, white)
    for root in graph:
        if colour[root] != white:
            continue
        stack: list[tuple[str, int]] = [(root, 0)]
        path = [root]
        colour[root] = grey
        while stack:
            node, index = stack[-1]
            successors = graph[node]
            if index < len(successors):
                stack[-1] = (node, index + 1)
                nxt = successors[index]
                if colour[nxt] == grey:
                    return [*path[path.index(nxt) :], nxt]
                if colour[nxt] == white:
                    colour[nxt] = grey
                    stack.append((nxt, 0))
                    path.append(nxt)
            else:
                colour[node] = black
                stack.pop()
                path.pop()
    return None


def requirement_closure(scenario: Scenario) -> dict[str, set[str]]:
    """For each mission, every mission it transitively requires (not including itself)."""
    direct: dict[str, set[str]] = {m.id: set() for m in scenario.missions}
    for constraint in scenario.constraints:
        if isinstance(constraint, Requires):
            direct[constraint.after].add(constraint.before)
    closure: dict[str, set[str]] = {}
    for mission in direct:
        seen: set[str] = set()
        frontier = list(direct[mission])
        while frontier:
            current = frontier.pop()
            if current in seen:
                continue
            seen.add(current)
            frontier.extend(direct[current])
        seen.discard(mission)
        closure[mission] = seen
    return closure


def impossible_missions(scenario: Scenario) -> dict[str, str]:
    """Missions that can never be done, with a human-readable reason."""
    excluded_pairs = [(c.a, c.b) for c in scenario.constraints if isinstance(c, Excludes)]
    closure = requirement_closure(scenario)
    reasons: dict[str, str] = {}
    for mission in scenario.missions:
        needed = closure[mission.id] | {mission.id}
        for a, b in excluded_pairs:
            if a in needed and b in needed:
                if mission.id in (a, b):
                    other = b if mission.id == a else a
                    reasons[mission.id] = (
                        f"Mission '{mission.id}' can never be done: it requires '{other}', "
                        "which it excludes."
                    )
                else:
                    reasons[mission.id] = (
                        f"Mission '{mission.id}' can never be done: it requires both '{a}' and "
                        f"'{b}', which exclude each other."
                    )
                break
    return reasons


def validate_constraints(scenario: Scenario) -> list[Issue]:
    issues: list[Issue] = []
    cycle = find_cycle(precedence_graph(scenario))
    if cycle is not None:
        issues.append(
            Issue(
                code="constraint_cycle",
                message="The order constraints form a cycle: "
                + " → ".join(cycle)
                + ". No order of missions can satisfy them.",
                path=["constraints"],
                severity="error",
            )
        )
        return issues  # closures are meaningless on a cyclic graph
    for mission_id, reason in impossible_missions(scenario).items():
        index = next(i for i, m in enumerate(scenario.missions) if m.id == mission_id)
        issues.append(
            Issue(
                code="impossible_mission",
                message=reason,
                path=["missions", index],
                severity="warning",
            )
        )
    return issues


def placement_issues(scenario: Scenario) -> list[Issue]:
    """Poses where the robot cannot stand: its collision disc would touch an obstacle or wall.

    Such a mission is left out by the optimiser; reporting it while editing avoids a surprise
    later. Warnings, not errors: the scenario is still well formed.
    """
    field = ClearanceField(scenario.arena)
    radius = scenario.robot.footprint_radius

    def blocked(x: float, y: float) -> bool:
        return field.at((x, y)) < radius - 1e-9

    def message(what: str, x: float, y: float) -> str:
        return (
            f"{what} at {format_point_cm((x, y))} is too close to an obstacle or wall for a "
            f"robot of collision radius {radius * 100:.1f} cm."
        )

    issues: list[Issue] = []
    start = scenario.arena.start_pose
    if blocked(start.x, start.y):
        issues.append(
            Issue(
                code="start_in_collision",
                message=message("The start pose", start.x, start.y) + " No route can leave it.",
                path=["arena", "start_pose"],
                severity="warning",
            )
        )
    for index, mission in enumerate(scenario.missions):
        pose = mission.approach_pose
        if blocked(pose.x, pose.y):
            issues.append(
                Issue(
                    code="approach_in_collision",
                    message=message(f"The approach pose of '{mission.name}'", pose.x, pose.y)
                    + " The robot cannot reach it, so it will be left out of every plan.",
                    path=["missions", index, "approach_pose"],
                    severity="warning",
                )
            )
    return issues
