import hashlib
import json
import time

import numpy
from fastapi import APIRouter
from fastapi.responses import Response

import roboroute
from roboroute.api.csv_export import to_csv
from roboroute.api.errors import ApiError
from roboroute.api.routes.routing import check_matrix_work
from roboroute.api.schemas.simulate import (
    ConvergencePointOut,
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
from roboroute.engine.optimization.instance import (
    PlanningError,
    PlanningInstance,
    compile_instance,
)
from roboroute.engine.optimization.plan import evaluate
from roboroute.engine.simulation.compare import Comparison, SimulatedPlan, compare
from roboroute.engine.simulation.runner import PlanError
from roboroute.engine.stats.summary import (
    ecdf,
    histogram,
    proportion,
    running_mean_ci,
    summarize,
)
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


def _run(request: SimulateRequest) -> tuple[PlanningInstance, Comparison]:
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
    return instance, result


@router.post(
    "/simulate/trials",
    response_class=Response,
    responses={200: {"content": {"text/csv": {}}, "description": "One row per simulated match"}},
)
def simulate_trials_csv(request: SimulateRequest) -> Response:
    """Per-trial results as CSV, regenerated deterministically from the request and its seed."""
    _, result = _run(request)
    missions = sorted({m for plan in result.plans for m in plan.trials.missions})
    header = [
        "plan",
        "trial",
        "score",
        "completion_time_s",
        "cut_off",
        "skipped_for_time",
        *(f"{m}_succeeded" for m in missions),
    ]
    rows: list[list[str | int | float | bool]] = []
    for plan in result.plans:
        trials = plan.trials
        column = {m: c for c, m in enumerate(trials.missions)}
        for t in range(trials.score.size):
            rows.append(
                [
                    plan.label,
                    t,
                    float(trials.score[t]),
                    float(trials.completion_time[t]),
                    bool(trials.cut_off[t]),
                    bool(trials.skipped_for_time[t]),
                    *(
                        bool(trials.succeeded[t, column[m]]) if m in column else ""
                        for m in missions
                    ),
                ]
            )
    return Response(
        content=to_csv(header, rows),
        media_type="text/csv",
        headers={"content-disposition": 'attachment; filename="roboroute-trials.csv"'},
    )


@router.post("/simulate")
def simulate_plans(request: SimulateRequest) -> SimulateResponse:
    """Monte Carlo evaluation of one plan, or a fair comparison of up to three plans."""
    started = time.perf_counter()
    config = request.config
    instance, result = _run(request)

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
            convergence=[
                ConvergencePointOut(trials=n, mean=mean, interval=IntervalOut(low=low, high=high))
                for n, mean, low, high in running_mean_ci(trials.score)
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
