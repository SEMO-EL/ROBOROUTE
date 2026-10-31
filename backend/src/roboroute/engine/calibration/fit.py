"""Fit (max speed, acceleration) to timed movements.

In the trapezoidal regime (d ≥ v²/a) the motion model says t = d·(1/v) + v/a: time is a straight
line in distance with slope 1/v and intercept c = v/a. Ordinary least squares on (d, t) therefore
gives v = 1/slope and a = v/c directly.

Short movements that never reach top speed follow t = 2√(d/a) instead and would bias the line. If
any measurement falls in that regime, the line fit is used as the starting point for a nonlinear
least-squares fit of the exact piecewise model (SciPy ``least_squares``).

Degenerate inputs never produce NaN: a single distance only identifies the average speed
(constant-speed model), and inconsistent data falls back to it with a warning.
"""

import math
from typing import Literal

import numpy as np
from numpy.typing import NDArray

from roboroute.engine.models import MotionProfile
from roboroute.engine.models.calibration import CalibrationResult, Measurement
from roboroute.engine.motion.profiles import profile_time

Array = NDArray[np.float64]
Method = Literal[
    "average_speed", "proportional_fit", "linear_least_squares", "nonlinear_least_squares"
]


def _predict(amounts: Array, v: float, a: float | None) -> Array:
    profile = MotionProfile.model_construct(max_speed=v, acceleration=a, provenance="calibrated")
    return np.array([profile_time(float(d), profile) for d in amounts])


def _result(
    amounts: Array,
    seconds: Array,
    v: float,
    a: float | None,
    method: Method,
    warnings: list[str],
) -> CalibrationResult:
    residuals = seconds - _predict(amounts, v, a)
    total = float(np.sum((seconds - seconds.mean()) ** 2))
    r_squared = 1.0 - float(np.sum(residuals**2)) / total if total > 0 else None
    if v > 50 or (a is not None and a > 500):
        warnings.append("The fitted values are implausibly large; please check the measurements.")
    return CalibrationResult(
        max_speed=v,
        acceleration=a,
        model="constant_speed" if a is None else "trapezoidal",
        method=method,
        r_squared=r_squared,
        residuals=[float(r) for r in residuals],
        warnings=warnings,
    )


def fit_profile(measurements: list[Measurement]) -> CalibrationResult:
    amounts = np.array([m.amount for m in measurements], dtype=float)
    seconds = np.array([m.seconds for m in measurements], dtype=float)
    warnings: list[str] = []

    def average_speed() -> CalibrationResult:
        return _result(
            amounts, seconds, float(amounts.sum() / seconds.sum()), None, "average_speed", warnings
        )

    if len(np.unique(amounts)) < 2:
        warnings.append(
            "With a single distance only the average speed can be estimated. Time two different "
            "distances (for example 20 cm and 100 cm) to also estimate acceleration."
        )
        return average_speed()

    slope, intercept = np.polyfit(amounts, seconds, 1)
    if slope <= 0:
        warnings.append(
            "Measured times do not increase with distance, so no speed can be fitted reliably; "
            "the average speed is used. Please re-check the measurements."
        )
        return average_speed()

    if intercept <= 1e-9:
        # No measurable start/stop overhead: fit t = d / v through the origin.
        warnings.append(
            "No acceleration overhead is visible in the data; a constant-speed model is used."
        )
        inverse_v = float(np.dot(amounts, seconds) / np.dot(amounts, amounts))
        return _result(amounts, seconds, 1.0 / inverse_v, None, "proportional_fit", warnings)

    v = 1.0 / float(slope)
    a = v / float(intercept)
    if bool(np.all(amounts >= v * v / a - 1e-9)):
        return _result(amounts, seconds, v, a, "linear_least_squares", warnings)

    def residual(params: Array) -> Array:
        difference: Array = _predict(amounts, float(params[0]), float(params[1])) - seconds
        return difference

    # Imported here: SciPy is a large download for the in-browser engine, fetched only when needed.
    from scipy.optimize import least_squares

    fit = least_squares(
        residual,
        x0=[v, a],
        bounds=([1e-6, 1e-6], [math.inf, math.inf]),
        xtol=1e-14,
        ftol=1e-14,
        gtol=1e-14,
    )
    if not fit.success:
        warnings.append(f"The exact model fit did not converge ({fit.message}); line fit used.")
        return _result(amounts, seconds, v, a, "linear_least_squares", warnings)
    return _result(
        amounts, seconds, float(fit.x[0]), float(fit.x[1]), "nonlinear_least_squares", warnings
    )
