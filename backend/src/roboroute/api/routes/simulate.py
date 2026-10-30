import hashlib
import json
import time

import numpy
from fastapi import APIRouter

import roboroute
from roboroute.api.errors import ApiError
from roboroute.api.routes.routing import check_matrix_work
from roboroute.api.schemas.simulate import (
    DifferenceOut,
    HistogramOut,
    IntervalOut,
    MissionRateOut,
    PlanSimulationOut,
    ProbabilityOut,
    SimulateRequest,
    SimulateResponse,
    SimulationMetadata,
    SummaryOut,
)
from roboroute.engine.optimization.instance import PlanningError, compile_instance
from roboroute.engine.optimization.plan import evaluate
from roboroute.engine.simulation.compare import SimulatedPlan, compare
from roboroute.engine.simulation.runner import PlanError
from roboroute.engine.stats.summary import ecdf, histogram, proportion, summarize
from roboroute.engine.travel.matrix import build_travel_matrix

router = APIRouter(tags=["simulate"])

MAX_TOTAL_TRIALS = 100_000

ASSUMPTIONS = [
    "Each trial draws travel-time noise, mission durations and outcomes from the scenario's "
    "distributions; outcomes of different missions are independent.",
    "A mission whose 'succeeded' requirement failed is skipped; failed attempts are retried up to "
    "the mission's limit.",
    "The buzzer is hard: a mission still in progress when time runs out scores nothing.",
    "Intervals are 95 % intervals for the Monte Carlo estimate under this model; they do not "
    "measure how well the model matches a real robot.",
]


def _probability(flags: numpy.typing.NDArray[numpy.bool_]) -> ProbabilityOut:
    estimate, interval = proportion(flags)
    return ProbabilityOut(estimate=estimate, interval=IntervalOut.of(interval))


@router.post("/simulate")
def simulate_plans(request: SimulateRequest) -> SimulateResponse:
    """Monte Carlo evaluation of one plan, or a fair comparison of up to three plans."""
    started = time.perf_counter()
    config = request.config
    total = config.trials * len(request.plans)
    if total > MAX_TOTAL_TRIALS:
        raise ApiError(
            422,
            "too_many_trials",
            f"{total:,} trials requested; at most {MAX_TOTAL_TRIALS:,} per request.",
        )
    scenario = request.scenario
    check_matrix_work(scenario)
    matrix = build_travel_matrix(scenario)
    try:
        instance = compile_instance(scenario, matrix)
        result = compare(scenario, instance, [(p.label, p.runs) for p in request.plans], config)
    except PlanningError as error:
        raise ApiError(
            422,
            "invalid_constraints",
            "The mission constraints cannot be satisfied.",
            [issue.model_dump() for issue in error.issues],
        ) from error
    except PlanError as error:
        raise ApiError(422, "invalid_plan", str(error)) from error

    index = {mission: i for i, mission in enumerate(instance.ids)}

    def describe(plan: SimulatedPlan) -> PlanSimulationOut:
        trials = plan.trials
        runs = [[index[m] for m in run] for run in plan.runs]
        planned = evaluate(instance, runs, enforce_budget=False)
        assert planned is not None  # the runner already validated the plan
        edges, counts = histogram(trials.score)
        time_edges, time_counts = histogram(trials.completion_time)
        target = (
            _probability(trials.score >= config.target_score)
            if config.target_score is not None
            else None
        )
        return PlanSimulationOut(
            label=plan.label,
            runs=plan.runs,
            score=SummaryOut.of(summarize(trials.score)),
            completion_time=SummaryOut.of(summarize(trials.completion_time)),
            probability_cut_off=_probability(trials.cut_off),
            probability_skipped_for_time=_probability(trials.skipped_for_time),
            probability_target=target,
            score_histogram=HistogramOut(edges=edges, counts=counts),
            completion_histogram=HistogramOut(edges=time_edges, counts=time_counts),
            score_ecdf=ecdf(trials.score),
            missions=[
                MissionRateOut(
                    mission=mission,
                    started=_probability(trials.started[:, col]),
                    succeeded=_probability(trials.succeeded[:, col]),
                )
                for col, mission in enumerate(trials.missions)
            ],
            analytic_expected_score=planned.expected_score,
            planned_time=planned.completion_time,
        )

    canonical = json.dumps(request.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    return SimulateResponse(
        plans=[describe(plan) for plan in result.plans],
        differences=[
            DifferenceOut(
                plan=d.plan,
                reference=d.reference,
                mean=d.mean,
                interval=IntervalOut.of(d.interval),
                share_better=d.share_better,
                share_worse=d.share_worse,
            )
            for d in result.differences
        ],
        metadata=SimulationMetadata(
            engine_version=roboroute.__version__,
            numpy_version=numpy.__version__,
            seed=config.seed,
            trials=config.trials,
            input_hash=hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        ),
        assumptions=ASSUMPTIONS,
        compute_seconds=time.perf_counter() - started,
    )
