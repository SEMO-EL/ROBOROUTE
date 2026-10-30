"""Summaries of simulation output with confidence intervals.

- **Mean:** x̄ ± z·s/√n (normal approximation; fine for the thousands of trials used here).
- **Proportions:** Wilson score interval, which behaves well near 0 and 1 and for small n, unlike
  the textbook p̂ ± z√(p̂(1−p̂)/n).
- **Quantiles:** distribution-free interval from order statistics: the number of samples below
  the true q-quantile is Binomial(n, q), so ranks n·q ± z·√(n·q·(1−q)) bracket it.

These are intervals for the *simulation estimate* (Monte Carlo error) under the model — not a
statement about how well the model matches a real robot.
"""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

Z95 = 1.959964  # two-sided 95 % normal quantile

FloatArray = NDArray[np.float64]


@dataclass(frozen=True)
class Interval:
    low: float
    high: float


@dataclass(frozen=True)
class Quantile:
    q: float
    estimate: float
    interval: Interval


@dataclass(frozen=True)
class Summary:
    n: int
    mean: float
    mean_ci: Interval
    std: float
    minimum: float
    maximum: float
    quantiles: dict[str, Quantile]


def wilson(successes: int, n: int, z: float = Z95) -> Interval:
    if n == 0:
        return Interval(0.0, 1.0)
    p = successes / n
    denominator = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denominator
    half = z / denominator * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return Interval(max(0.0, centre - half), min(1.0, centre + half))


def proportion(flags: NDArray[np.bool_], z: float = Z95) -> tuple[float, Interval]:
    n = int(flags.size)
    successes = int(flags.sum())
    return (successes / n if n else 0.0), wilson(successes, n, z)


def mean_ci(values: FloatArray, z: float = Z95) -> tuple[float, Interval]:
    mean = float(values.mean())
    if values.size < 2:
        return mean, Interval(mean, mean)
    half = z * float(values.std(ddof=1)) / math.sqrt(values.size)
    return mean, Interval(mean - half, mean + half)


def quantile_ci(values: FloatArray, q: float, z: float = Z95) -> tuple[float, Interval]:
    ordered = np.sort(values)
    n = ordered.size
    estimate = float(np.quantile(ordered, q))
    spread = z * math.sqrt(n * q * (1 - q))
    low = min(n - 1, max(0, math.floor(n * q - spread)))
    high = min(n - 1, max(0, math.ceil(n * q + spread)))
    return estimate, Interval(float(ordered[low]), float(ordered[high]))


def summarize(values: FloatArray) -> Summary:
    mean, interval = mean_ci(values)
    quantiles = {}
    for name, q in (("p10", 0.10), ("median", 0.5), ("p90", 0.90), ("p95", 0.95)):
        estimate, q_interval = quantile_ci(values, q)
        quantiles[name] = Quantile(q, estimate, q_interval)
    return Summary(
        n=int(values.size),
        mean=mean,
        mean_ci=interval,
        std=float(values.std(ddof=1)) if values.size > 1 else 0.0,
        minimum=float(values.min()),
        maximum=float(values.max()),
        quantiles=quantiles,
    )


def _integer_step(values: FloatArray) -> int | None:
    """Greatest common divisor of whole-number values (e.g. 5 if every score is a multiple of 5)."""
    if not np.allclose(values, np.round(values)):
        return None
    distinct = np.unique(np.round(values).astype(np.int64))
    if distinct.size < 2:
        return None
    return int(np.gcd.reduce(np.diff(distinct)))


def histogram(values: FloatArray, max_bins: int = 40) -> tuple[list[float], list[int]]:
    """Bins for display.

    Competition scores move in fixed steps (often 5 points). For whole-number data the bin width is
    a multiple of that step, so bins are never systematically empty; otherwise NumPy's automatic
    rule is used, capped at ``max_bins``.
    """
    low, high = float(values.min()), float(values.max())
    if low == high:
        return [low - 0.5, high + 0.5], [int(values.size)]
    step = _integer_step(values)
    if step is not None:
        width = step * max(1, math.ceil((high - low) / step / max_bins))
        start = math.floor(low / width) * width
        edges = np.arange(start, high + width + 1e-9, width, dtype=float)
        # Centre each step value inside its bin rather than on a bin edge.
        if width == step:
            edges = edges - step / 2
            if edges[-1] < high + step / 2 - 1e-9:
                edges = np.append(edges, edges[-1] + width)
    else:
        edges = np.histogram_bin_edges(values, bins=max_bins)
    counts, edges = np.histogram(values, bins=edges)
    return [float(e) for e in edges], [int(c) for c in counts]


def ecdf(values: FloatArray, max_points: int = 200) -> list[tuple[float, float]]:
    """Empirical cumulative distribution, thinned to at most ``max_points`` + 1 points."""
    ordered = np.sort(values)
    n = ordered.size
    indices = np.unique(np.linspace(0, n - 1, min(n, max_points + 1)).round().astype(int))
    return [(float(ordered[i]), (i + 1) / n) for i in indices]
