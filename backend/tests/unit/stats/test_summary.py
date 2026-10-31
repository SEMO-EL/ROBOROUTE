import itertools
import math

import numpy as np
import pytest

from roboroute.engine.stats.summary import (
    ecdf,
    histogram,
    mean_ci,
    proportion,
    quantile_ci,
    running_mean_ci,
    summarize,
    wilson,
)


def test_wilson_known_value() -> None:
    # 8 successes in 10: p̂ = 0.8, 95 % Wilson interval ≈ [0.490, 0.943].
    interval = wilson(8, 10)
    assert interval.low == pytest.approx(0.4902, abs=1e-4)
    assert interval.high == pytest.approx(0.9433, abs=1e-4)


def test_wilson_extremes_stay_in_unit_interval() -> None:
    assert wilson(0, 20).low == 0.0
    assert wilson(20, 20).high == pytest.approx(1.0)
    assert 0.0 < wilson(20, 20).low < 1.0


def test_wilson_coverage_is_close_to_nominal() -> None:
    """Over many repeated experiments a 95 % interval should contain the truth ~95 % of the time."""
    rng = np.random.default_rng(5)
    p, n, repeats = 0.3, 50, 4000
    hits = rng.binomial(n, p, repeats)
    covered = sum(wilson(int(k), n).low <= p <= wilson(int(k), n).high for k in hits)
    assert 0.93 <= covered / repeats <= 0.97


def test_mean_ci() -> None:
    mean, interval = mean_ci(np.array([1.0, 2.0, 3.0, 4.0]))
    half = 1.959964 * np.std([1, 2, 3, 4], ddof=1) / 2
    assert mean == 2.5
    assert interval.low == pytest.approx(2.5 - half)
    assert interval.high == pytest.approx(2.5 + half)


def test_single_trial_has_finite_degenerate_intervals() -> None:
    summary = summarize(np.array([42.0]))
    assert summary.mean == 42.0
    assert summary.mean_ci.low == summary.mean_ci.high == 42.0
    assert summary.std == 0.0
    assert all(math.isfinite(q.estimate) for q in summary.quantiles.values())


def test_quantile_ci_contains_estimate_and_truth() -> None:
    values = np.random.default_rng(1).uniform(0, 100, 20_000)
    estimate, interval = quantile_ci(values, 0.9)
    assert interval.low <= estimate <= interval.high
    assert interval.low <= 90.0 <= interval.high


def test_proportion() -> None:
    estimate, interval = proportion(np.array([True, False, True, True]))
    assert estimate == 0.75
    assert interval.low < 0.75 < interval.high


def test_histogram_counts_everything() -> None:
    values = np.array([0, 20, 20, 35, 55, 55, 55], dtype=float)
    edges, counts = histogram(values)
    assert sum(counts) == values.size
    assert len(edges) == len(counts) + 1


def test_ecdf_is_monotone_and_ends_at_one() -> None:
    points = ecdf(np.random.default_rng(2).normal(size=5000), max_points=100)
    assert len(points) <= 101
    ys = [y for _, y in points]
    assert ys == sorted(ys)
    assert ys[-1] == pytest.approx(1.0)


def test_histogram_bins_follow_the_score_step() -> None:
    """Scores that are all multiples of 5 get 5-point bins, not mostly-empty 1-point bins."""
    values = np.array([0, 20, 35, 55, 60, 95, 120], dtype=float)
    edges, counts = histogram(values)
    widths = {round(b - a, 9) for a, b in itertools.pairwise(edges)}
    assert widths == {5.0}
    assert sum(counts) == values.size


def test_running_mean_ends_at_the_overall_mean() -> None:
    values = np.random.default_rng(4).normal(50, 10, 1000)
    points = running_mean_ci(values)
    assert [p[0] for p in points] == [10, 20, 50, 100, 200, 500, 1000]
    n, mean, low, high = points[-1]
    expected_mean, interval = mean_ci(values)
    assert n == 1000
    assert mean == pytest.approx(expected_mean)
    assert (low, high) == pytest.approx((interval.low, interval.high))


def test_running_mean_with_one_trial_is_finite() -> None:
    assert running_mean_ci(np.array([7.0])) == [(1, 7.0, 7.0, 7.0)]
