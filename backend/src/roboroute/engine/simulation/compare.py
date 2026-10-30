"""Fair comparison of plans with common random numbers.

All plans are simulated with the same seed. Because random streams are keyed by mission id and
travel leg (see ``rng.py``), a mission that appears in two plans gets the same execution times and
outcomes in both, trial by trial. The paired difference score(plan) − score(reference) then
contains only the effect of the plans differing, not unrelated luck, so its confidence interval is
much narrower than comparing two independent simulations would give.
"""

from dataclasses import dataclass

from roboroute.engine.models import Scenario
from roboroute.engine.models.simulation import SimulationConfig
from roboroute.engine.optimization.instance import PlanningInstance
from roboroute.engine.simulation.runner import SimulationTrials, simulate
from roboroute.engine.stats.summary import Interval, mean_ci

MAX_COMPARED_PLANS = 3  # charts compare plans by colour; only 3 hues stay distinguishable


@dataclass(frozen=True)
class SimulatedPlan:
    label: str
    runs: list[list[str]]
    trials: SimulationTrials


@dataclass(frozen=True)
class PairedDifference:
    plan: str
    reference: str
    mean: float  # mean of score(plan) − score(reference) over trials
    interval: Interval
    share_better: float  # fraction of trials in which the plan scored strictly more
    share_worse: float


@dataclass(frozen=True)
class Comparison:
    plans: list[SimulatedPlan]
    differences: list[PairedDifference]


def compare(
    scenario: Scenario,
    instance: PlanningInstance,
    plans: list[tuple[str, list[list[str]]]],
    config: SimulationConfig,
) -> Comparison:
    if not 1 <= len(plans) <= MAX_COMPARED_PLANS:
        raise ValueError(f"compare between 1 and {MAX_COMPARED_PLANS} plans")
    simulated = [
        SimulatedPlan(label, runs, simulate(scenario, instance, runs, config))
        for label, runs in plans
    ]
    reference = simulated[0]
    differences = []
    for other in simulated[1:]:
        delta = other.trials.score - reference.trials.score
        mean, interval = mean_ci(delta)
        differences.append(
            PairedDifference(
                plan=other.label,
                reference=reference.label,
                mean=mean,
                interval=interval,
                share_better=float((delta > 0).mean()),
                share_worse=float((delta < 0).mean()),
            )
        )
    return Comparison(simulated, differences)
