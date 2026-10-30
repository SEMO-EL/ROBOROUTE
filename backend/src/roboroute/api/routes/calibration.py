from fastapi import APIRouter

from roboroute.engine.calibration.fit import fit_profile
from roboroute.engine.models.calibration import CalibrationRequest, CalibrationResult

router = APIRouter(prefix="/calibration", tags=["calibration"])


@router.post("/fit")
def fit(request: CalibrationRequest) -> CalibrationResult:
    """Estimate speed and acceleration from timed movements (distances or turn angles)."""
    return fit_profile(request.measurements)
