"""The complete problem description (design doc §4, §8).

A validated ``Scenario`` is guaranteed to be referentially consistent: ids are unique, every
constraint and scoring rule names an existing mission, and every pose lies inside the arena.
Engine code can therefore look missions up by id without defensive checks.
"""

from collections import Counter
from typing import Literal, Self

from pydantic import Field, model_validator
from pydantic_core import PydanticCustomError

from roboroute.engine.models.arena import Arena
from roboroute.engine.models.base import Description, Identifier, Label, StrictModel
from roboroute.engine.models.competition import CompetitionFormat
from roboroute.engine.models.constraints import Constraint, Excludes
from roboroute.engine.models.issues import Issue
from roboroute.engine.models.missions import Mission
from roboroute.engine.models.robot import Robot
from roboroute.engine.models.scoring import AllOfBonus, ScoringProfile

SCHEMA_VERSION: Literal[1] = 1
MAX_MISSIONS = 32


class Scenario(StrictModel):
    schema_version: Literal[1] = SCHEMA_VERSION
    id: Identifier
    name: Label
    description: Description = ""
    fictional: bool = Field(
        description="True when the data is invented for demonstration, not an official ruleset"
    )
    arena: Arena
    robot: Robot
    missions: list[Mission] = Field(default_factory=list, max_length=MAX_MISSIONS)
    constraints: list[Constraint] = Field(default_factory=list, max_length=200)
    scoring: ScoringProfile
    format: CompetitionFormat

    @model_validator(mode="after")
    def _check_references(self) -> Self:
        issues = find_reference_issues(self)
        if issues:
            summary = "; ".join(issue.message for issue in issues)
            raise PydanticCustomError(
                "scenario_references",
                "{count} problem(s) in scenario: {summary}",
                {
                    "count": len(issues),
                    "summary": summary,
                    "issues": [issue.model_dump() for issue in issues],
                },
            )
        return self

    def mission(self, mission_id: str) -> Mission:
        for mission in self.missions:
            if mission.id == mission_id:
                return mission
        raise KeyError(mission_id)


def find_reference_issues(scenario: Scenario) -> list[Issue]:
    """Collect every referential problem at once so the user can fix them in one pass."""
    issues: list[Issue] = []

    all_ids = (
        [m.id for m in scenario.missions]
        + [o.id for o in scenario.arena.obstacles]
        + [z.id for z in scenario.arena.home_zones]
    )
    for duplicate, count in sorted(Counter(all_ids).items()):
        if count > 1:
            issues.append(
                Issue(
                    code="duplicate_id",
                    message=f"id '{duplicate}' is used {count} times; ids must be unique",
                    path=["missions"],
                )
            )

    mission_ids = {m.id for m in scenario.missions}

    def check(mission_id: str, path: list[str | int], owner: str) -> None:
        if mission_id not in mission_ids:
            issues.append(
                Issue(
                    code="unknown_mission",
                    message=f"{owner} refers to unknown mission '{mission_id}'",
                    path=path,
                )
            )

    for index, constraint in enumerate(scenario.constraints):
        owner = f"constraint #{index + 1} ({constraint.kind})"
        if isinstance(constraint, Excludes):
            pair = [("a", constraint.a), ("b", constraint.b)]
        else:
            pair = [("before", constraint.before), ("after", constraint.after)]
        for field, mission_id in pair:
            check(mission_id, ["constraints", index, field], owner)
        if pair[0][1] == pair[1][1]:
            issues.append(
                Issue(
                    code="self_constraint",
                    message=f"{owner} relates mission '{pair[0][1]}' to itself",
                    path=["constraints", index],
                )
            )

    for index, rule in enumerate(scenario.scoring.rules):
        owner = f"scoring rule #{index + 1} ({rule.kind})"
        if isinstance(rule, AllOfBonus):
            for position, mission_id in enumerate(rule.missions):
                check(mission_id, ["scoring", "rules", index, "missions", position], owner)
        else:
            check(rule.mission, ["scoring", "rules", index, "mission"], owner)

    for index, mission in enumerate(scenario.missions):
        pose = mission.approach_pose
        if not scenario.arena.contains(pose.x, pose.y):
            issues.append(
                Issue(
                    code="outside_arena",
                    message=f"mission '{mission.id}' approach pose ({pose.x:.3f}, {pose.y:.3f}) m "
                    "is outside the arena",
                    path=["missions", index, "approach_pose"],
                )
            )

    return issues
