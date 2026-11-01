from fastapi import APIRouter

from roboroute.api.errors import ApiError
from roboroute.engine.calibration.fit import fit_profile
from roboroute.engine.models.calibration import CalibrationRequest, CalibrationResult
from roboroute.engine.models.robot import MAX_SPEED

router = APIRouter(prefix="/calibration", tags=["calibration"])


@router.post("/fit")
def fit(request: CalibrationRequest) -> CalibrationResult:
    """Estimate speed and acceleration from timed movements (distances or turn angles)."""
    result = fit_profile(request.measurements)
    if result.max_speed > MAX_SPEED:
        # Applying it would make the robot invalid, so every later calculation would be refused.
        raise ApiError(
            422,
            "implausible_calibration",
            f"These measurements give a top speed of {result.max_speed:.0f} per second, above "
            f"the limit of {MAX_SPEED:g}. Please check the distances and times.",
        )
    return result
