import numpy as np

from roboroute.engine.optimization.instance import PlanningInstance


def simple_instance(
    points: list[float],
    durations: list[float],
    budget: float,
    probabilities: list[float] | None = None,
    travel: float = 0.0,
) -> PlanningInstance:
    """Independent missions, uniform travel time between every pair of nodes."""
    n = len(points)
    p = np.array(probabilities if probabilities is not None else [1.0] * n)
    tau = np.full((n + 1, n + 1), travel)
    np.fill_diagonal(tau, 0.0)
    return PlanningInstance(
        ids=[f"m{i}" for i in range(n)],
        names=[f"Mission {i}" for i in range(n)],
        tau=tau,
        duration=np.array(durations, dtype=float),
        p_eventual=p,
        requires_mask=[0] * n,
        after_mask=[0] * n,
        excludes_mask=[0] * n,
        attachment=[0] * n,
        attachments=[],
        budget=budget,
        multi_run=False,
        reset_time=0.0,
        must_end_in_home=False,
        weight=np.array(points, dtype=float) * p,
        bonuses=[],
    )
