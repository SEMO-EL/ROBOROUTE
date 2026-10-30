"""Validated domain contracts. These models are the single source of truth for the schema."""

from roboroute.engine.models.arena import MAX_GRID_CELLS, Arena, Obstacle, Zone
from roboroute.engine.models.competition import CompetitionFormat
from roboroute.engine.models.constraints import Constraint, Excludes, Precedes, Requires
from roboroute.engine.models.distributions import (
    Distribution,
    Empirical,
    Fixed,
    LogNormal,
    Triangular,
)
from roboroute.engine.models.geometry import CircleShape, Pose, RectShape, Shape
from roboroute.engine.models.issues import Issue
from roboroute.engine.models.missions import (
    CountsSuccess,
    Mission,
    ProbabilitySuccess,
    SuccessModel,
)
from roboroute.engine.models.robot import MotionProfile, Robot
from roboroute.engine.models.scenario import (
    MAX_MISSIONS,
    SCHEMA_VERSION,
    Scenario,
    find_reference_issues,
)
from roboroute.engine.models.scoring import (
    AllOfBonus,
    FailurePenalty,
    MissionPoints,
    ScoringProfile,
    ScoringRule,
)
from roboroute.engine.models.travel import START_NODE, TravelOverride

__all__ = [
    "MAX_GRID_CELLS",
    "MAX_MISSIONS",
    "SCHEMA_VERSION",
    "START_NODE",
    "AllOfBonus",
    "Arena",
    "CircleShape",
    "CompetitionFormat",
    "Constraint",
    "CountsSuccess",
    "Distribution",
    "Empirical",
    "Excludes",
    "FailurePenalty",
    "Fixed",
    "Issue",
    "LogNormal",
    "Mission",
    "MissionPoints",
    "MotionProfile",
    "Obstacle",
    "Pose",
    "Precedes",
    "ProbabilitySuccess",
    "RectShape",
    "Requires",
    "Robot",
    "Scenario",
    "ScoringProfile",
    "ScoringRule",
    "Shape",
    "SuccessModel",
    "TravelOverride",
    "Triangular",
    "Zone",
    "find_reference_issues",
]
