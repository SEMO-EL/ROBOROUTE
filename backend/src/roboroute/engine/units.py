"""Unit and angle conventions (design doc §5, ADR-001).

Internally everything is SI: metres, seconds, radians. Headings are measured counter-clockwise
from the +x axis and normalised to the half-open interval (-π, π]. Display units (cm, degrees)
exist only at the UI boundary.
"""

import math

TAU = 2.0 * math.pi


def normalize_angle(theta: float) -> float:
    """Map any angle to the equivalent heading in (-π, π].

    -π and π describe the same heading; the half-open interval makes the representation unique
    (we keep +π) so that equal headings compare equal.
    """
    wrapped = math.fmod(theta, TAU)  # in (-2π, 2π), same sign as theta
    if wrapped <= -math.pi:
        wrapped += TAU
    elif wrapped > math.pi:
        wrapped -= TAU
    return wrapped


def angle_difference(a: float, b: float) -> float:
    """Signed shortest rotation that turns heading ``a`` into heading ``b``, in (-π, π].

    Positive means counter-clockwise. Example: from 170° to -170° is +20°, not -340°.
    """
    return normalize_angle(b - a)


def deg_to_rad(degrees: float) -> float:
    return math.radians(degrees)


def rad_to_deg(radians: float) -> float:
    return math.degrees(radians)


def cm_to_m(centimetres: float) -> float:
    return centimetres / 100.0


def m_to_cm(metres: float) -> float:
    return metres * 100.0


def format_point_cm(p: tuple[float, float]) -> str:
    """Human-readable position for messages, e.g. ``(100.0 cm, 60.0 cm)``."""
    return f"({m_to_cm(p[0]):.1f} cm, {m_to_cm(p[1]):.1f} cm)"
