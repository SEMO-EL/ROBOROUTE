"""Time to move a given amount with a symmetric trapezoidal velocity profile.

The robot starts and ends each movement at rest, accelerates at ``a`` up to ``v``, cruises, and
decelerates at ``a``. Accelerating to ``v`` takes ``v/a`` seconds and covers ``v²/(2a)``; doing that
twice covers ``v²/a``. Hence for an amount d (metres, or radians for turning):

    d ≥ v²/a :  t = d/v + v/a        (reaches top speed; trapezoid)
    d < v²/a :  t = 2·√(d/a)         (never reaches top speed; triangle, peak speed √(a·d))

The two formulas agree at d = v²/a, so t(d) is continuous and increasing. With no acceleration
given (``None``) the model is constant speed: t = d/v.
"""

import math

from roboroute.engine.models import MotionProfile


def profile_time(amount: float, profile: MotionProfile) -> float:
    if amount <= 0.0:
        return 0.0
    v = profile.max_speed
    a = profile.acceleration
    if a is None:
        return amount / v
    if amount >= v * v / a:
        return amount / v + v / a
    return 2.0 * math.sqrt(amount / a)
