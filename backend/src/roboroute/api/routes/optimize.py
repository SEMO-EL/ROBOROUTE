import time

from fastapi import APIRouter

from roboroute.api.errors import ApiError
from roboroute.api.routes.routing import check_matrix_work
from roboroute.api.schemas.optimize import (
    DPSummaryOut,
    ExcludedOut,
    ExplanationOut,
    OptimizeRequest,
    OptimizeResponse,
    PlanOut,
    SensitivityOut,
)
from roboroute.engine.missions.validation import validate_constraints
from roboroute.engine.models import Issue
from roboroute.engine.optimization.dp import MAX_EXACT_MISSIONS, solve
from roboroute.engine.optimization.explain import explain, speed_sensitivity
from roboroute.engine.optimization.greedy import greedy
from roboroute.engine.optimization.instance import PlanningError, compile_instance
from roboroute.engine.travel.matrix import build_travel_matrix

router = APIRouter(tags=["optimize"])

# Each sensitivity factor re-solves the DP; above this size that would make requests slow.
MAX_SENSITIVITY_MISSIONS = 12

ASSUMPTIONS = [
    "Mission durations are the mean of each mission's time distribution; with retries every "
    "attempt is budgeted, so the plan fits even if all attempts are needed.",
    "Mission outcomes are independent; a mission whose 'succeeded' requirement failed is skipped.",
    "Travel times are modelled from the robot's speed settings unless a measured time was entered.",
    "Scores are expected values under this model. Simulation estimates how much they vary.",
    "Fictional scenarios are demonstrations, not official competition rules.",
]


@router.post("/optimize")
def optimize(request: OptimizeRequest) -> OptimizeResponse:
    """Choose and order missions to maximise the expected score within the time budget."""
    started = time.perf_counter()
    scenario = request.scenario
    check_matrix_work(scenario)
    matrix = build_travel_matrix(scenario)
    try:
        instance = compile_instance(scenario, matrix)
    except PlanningError as error:
        raise ApiError(
            422,
            "invalid_constraints",
            "The mission constraints cannot be satisfied.",
            [issue.model_dump() for issue in error.issues],
        ) from error

    warnings = [i for i in validate_constraints(scenario) if i.severity == "warning"]
    greedy_plan = PlanOut.of(greedy(instance), instance, matrix)

    if instance.n > MAX_EXACT_MISSIONS:
        warnings.append(
            Issue(
                code="too_many_missions",
                message=f"{instance.n} candidate missions exceed the exact optimiser's limit of "
                f"{MAX_EXACT_MISSIONS}; only the greedy plan is shown.",
                severity="warning",
            )
        )
        optimal = None
        alternatives: list[PlanOut] = []
        explanation = None
        dp_summary = None
        sensitivity: list[SensitivityOut] = []
    else:
        result = solve(instance, top_k=request.settings.top_k)
        optimal = PlanOut.of(result.best, instance, matrix)
        alternatives = [PlanOut.of(p, instance, matrix) for p in result.top[1:]]
        explanation = ExplanationOut.of(explain(instance, result))
        dp_summary = DPSummaryOut.of(result, instance)
        if instance.n <= MAX_SENSITIVITY_MISSIONS:
            sensitivity = [
                SensitivityOut.of(row)
                for row in speed_sensitivity(
                    scenario, matrix, instance, request.settings.sensitivity_factors
                )
            ]
        else:
            sensitivity = []
            warnings.append(
                Issue(
                    code="sensitivity_skipped",
                    message=f"Speed sensitivity is computed for up to {MAX_SENSITIVITY_MISSIONS} "
                    "candidate missions.",
                    severity="warning",
                )
            )

    return OptimizeResponse(
        candidates=instance.ids,
        excluded=[ExcludedOut(mission=m, reason=r) for m, r in instance.excluded.items()],
        warnings=warnings,
        optimal=optimal,
        alternatives=alternatives,
        greedy=greedy_plan,
        explanation=explanation,
        dp_summary=dp_summary,
        sensitivity=sensitivity,
        assumptions=ASSUMPTIONS,
        compute_seconds=time.perf_counter() - started,
    )
