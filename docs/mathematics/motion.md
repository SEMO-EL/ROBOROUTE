# Motion model and calibration

Code: `backend/src/roboroute/engine/motion`, `backend/src/roboroute/engine/calibration`.

## 1. What is modelled

Most competition robots are programmed as a sequence of "drive straight d cm" and "turn θ°"
commands. RoboRoute models exactly that: a route is a polyline, the robot drives each segment in a
straight line and turns on the spot at each corner. This is a **model**, not a measurement; its
numbers are labelled *modelled* everywhere in the app.

## 2. One movement: the trapezoidal velocity profile

Each straight drive (and each turn) starts and ends at rest. With maximum speed $v$ and
acceleration $a$ (the same for speeding up and slowing down):

- accelerating from 0 to $v$ takes $v/a$ seconds and covers $\tfrac12 a (v/a)^2 = v^2/(2a)$;
- decelerating takes the same time and distance;
- so speeding up and slowing down together cover $v^2/a$.

If the distance $d$ is at least $v^2/a$, the robot reaches top speed, cruises, and stops
(a **trapezoid** in a speed–time plot):

$$t(d) = \underbrace{\frac{2v}{a}}_{\text{speed up + slow down}} + \underbrace{\frac{d - v^2/a}{v}}_{\text{cruise}} = \frac{d}{v} + \frac{v}{a}.$$

If $d < v^2/a$ it never reaches top speed (a **triangle**): it accelerates for half the distance
and decelerates for the other half. From $d/2 = \tfrac12 a t_{1/2}^2$, $t_{1/2} = \sqrt{d/a}$ and

$$t(d) = 2\sqrt{d/a}, \qquad \text{peak speed } \sqrt{ad} < v.$$

At $d = v^2/a$ both formulas give $2v/a$, so $t(d)$ is continuous and increasing.
Turning uses the same formulas with angular speed $\omega$ and angular acceleration $\alpha$.
If no acceleration is known, RoboRoute uses constant speed: $t = d/v$.

**Example.** $v = 0.5$ m/s, $a = 1$ m/s². Then $v^2/a = 0.25$ m. Driving 1 m takes
$1/0.5 + 0.5/1 = 2.5$ s; driving 16 cm takes $2\sqrt{0.16} = 0.8$ s.

## 3. A whole route, and when to drive backwards

For segments with directions $\varphi_1, \dots, \varphi_n$ and lengths $\ell_1, \dots, \ell_n$:

$$T = \sum_k t_{\text{drive}}(\ell_k) + \sum_k t_{\text{turn}}(|\Delta\theta_k|)$$

including the turn from the starting heading to the first segment and, at a mission, the turn to
the required approach heading. Turning angles are always the shortest signed turn, in
$(-\pi, \pi]$.

A robot that can reverse may drive a segment backwards: its heading is then $\varphi_k + \pi$.
Backing out of a mission instead of turning around can save a lot of time. RoboRoute chooses
forwards/backwards for every segment with a small **dynamic program** over two states per
segment; it minimises total turning time and runs in $O(n)$. Driving time is assumed equal in
both directions (an assumption — calibrate both if your robot differs).

**Differential-drive background.** With wheel speeds $v_L, v_R$ and wheel separation $b$, the
robot moves with $v = (v_R + v_L)/2$ and turns with $\omega = (v_R - v_L)/b$. A point turn has
$v = 0$, so with a wheel-speed limit $v_w$ the turning speed is at most $\omega = 2v_w/b$.
A differential drive has no minimum turning radius.

## 4. Calibration from a ruler and a stopwatch

Manufacturer data is only a ceiling. LEGO's fact sheets give, at 7.2 V and no load, 175 RPM ±15 %
for the SPIKE Prime Large Angular Motor and 185 RPM ±15 % for the Medium Angular Motor. A real
robot carries load, runs at a chosen power setting and uses its own acceleration code, so it is
slower. RoboRoute therefore estimates parameters from **your own measurements**.

Rewrite the trapezoid formula as

$$t = d \cdot \underbrace{\frac{1}{v}}_{\text{slope}} + \underbrace{\frac{v}{a}}_{\text{intercept } c}.$$

Time is a **straight line in distance**. Time two or more different distances, fit the line by
least squares, and read off

$$v = \frac{1}{\text{slope}}, \qquad a = \frac{v}{c}.$$

**Example (illustrative, not a reference value).** 20 cm in 1.2 s and 100 cm in 3.6 s:
slope $= 2.4/0.8 = 3$ s/m, so $v = 0.333$ m/s; $c = 1.2 - 0.2 \cdot 3 = 0.6$ s, so
$a = 0.333/0.6 = 0.556$ m/s².

Guard rails:

| Situation | What RoboRoute does |
|---|---|
| One distance only | Average speed $\bar v = \sum d / \sum t$, constant-speed model, warning |
| Times do not increase with distance | Average speed, warning to re-check |
| Intercept ≤ 0 (no visible start/stop overhead) | Constant speed fitted through the origin |
| Some distances shorter than $v^2/a$ | Line fit is biased; refined by nonlinear least squares on the exact model (SciPy) |
| Implausible values | Warning |

The result reports residuals and $R^2$ so you can see how well the model fits your robot.

**Tip:** measure each distance several times; the fit then also averages out stopwatch error.
