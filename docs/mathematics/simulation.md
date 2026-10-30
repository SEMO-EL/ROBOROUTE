# Monte Carlo simulation and statistics

Code: `backend/src/roboroute/engine/simulation`, `engine/stats`. Design: phase-0 design §9.

## 1. Why simulate at all?

The optimiser plans with **mean** durations. Real matches vary: a mission that usually takes 15 s
sometimes takes 22 s, a travel leg is a little slower, a retry is needed. A plan that fits in
100 s *on average* may still run into the buzzer in many matches, and the last missions then score
nothing. Simulation plays the plan thousands of times with random values to see the whole
distribution of outcomes — not just the average.

## 2. What one trial does

For each mission in plan order:

1. If a mission it requires has failed ("succeeded" semantics), skip it — the robot does not drive
   there.
2. Optionally, skip it if its planned duration no longer fits in the remaining time.
3. Drive there: nominal travel time × a random factor $F$.
4. Attempt it: draw an execution time; succeed with probability $p$; retry up to $m$ attempts.
5. If the buzzer sounds during travel or an attempt, stop: the interrupted mission scores nothing.

Then apply the scoring rules to what succeeded.

## 3. Random variables and why these distributions

| Quantity | Distribution | Why |
|---|---|---|
| Execution time | Fixed, Triangular(min, mode, max), LogNormal(median, gsd), or measured samples | Never negative; triangular is easy to estimate ("best / usual / worst"); lognormal is right-skewed like real task times |
| Travel time | nominal × $F$, $F$ ~ LogNormal with mean 1, CV = spread | Positive; long legs vary more than short ones |
| Success | Bernoulli($p$) per attempt | Each attempt succeeds or fails |

**Travel factor.** For a lognormal with parameters $(\mu, \sigma)$: mean $= e^{\mu + \sigma^2/2}$
and $\text{CV}^2 = e^{\sigma^2} - 1$. Choosing $\sigma^2 = \ln(1 + \text{CV}^2)$ and
$\mu = -\sigma^2/2$ gives mean exactly 1 and the requested CV.

**Normal distributions are not used for durations:** they assign probability to negative times.

## 4. Randomness that can be reproduced

Each random variable family has its own stream, derived from the seed and a stable key
(mission id, travel leg):

$$\text{stream} = \text{PCG64}\big(\text{SeedSequence}(\text{seed},\ (\text{crc32(key)}, \text{kind}))\big).$$

- Same seed → identical results (the response includes the seed, versions and an input hash).
- Two plans simulated with the same seed see the **same** draws for each shared mission
  (*common random numbers*). Their difference then reflects the plans, not luck, and its interval
  is much narrower — a test checks that the paired variance is smaller than the independent one.

## 5. Statistics

| Output | Estimate | 95 % interval |
|---|---|---|
| Mean score | $\bar x = \frac1N\sum x_i$ | $\bar x \pm 1.96\, s/\sqrt N$ (central limit theorem) |
| Probability (e.g. score ≥ target) | $\hat p = k/N$ | Wilson: $\dfrac{\hat p + \frac{z^2}{2N} \pm z\sqrt{\frac{\hat p(1-\hat p)}{N} + \frac{z^2}{4N^2}}}{1 + z^2/N}$ |
| Quantile $q$ (median, p10, p90) | sample quantile | order statistics with ranks $Nq \pm z\sqrt{Nq(1-q)}$ |
| Difference between plans | mean of paired differences | $\pm 1.96\, s_\Delta/\sqrt N$ |

The Wilson interval is used instead of $\hat p \pm z\sqrt{\hat p(1-\hat p)/N}$ because the latter
collapses to zero width at $\hat p = 0$ or $1$ and undercovers for small $N$. A test draws 4,000
binomial samples and checks that the Wilson interval covers the true value 93–97 % of the time.

**What the intervals mean:** they describe Monte Carlo error — how precisely the simulation has
estimated the model's behaviour. They say nothing about whether the model matches a real robot.

## 6. Validation

- With no randomness, the simulated completion time equals the planning model's exactly.
- With randomness but no buzzer cut-offs, the simulated mean equals the analytic expected score
  within 5 standard errors (50,000 trials, Scenarios A and D).
- Experiment 5: error ∝ $N^{-0.502}$ (theory $N^{-1/2}$); interval coverage 92–97 %.
- Contingency rules (skip after a failed requirement, retries, hard buzzer, skip when time is
  short) each have a dedicated test.

## 7. Limitations

- Mission outcomes are independent; correlated failures (e.g. a misaligned robot failing several
  missions) are not modelled.
- The plan is fixed; the simulated robot does not re-plan during the match beyond the contingency
  rules.
- The parameters (durations, probabilities) are only as good as the team's measurements.
