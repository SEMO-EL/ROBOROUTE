# Experiment 5 — Monte Carlo convergence and interval coverage

**Code:** `experiments/05-monte-carlo-convergence/{run,analyze}.py` ·
**Raw data:** `results/raw.csv` (800 runs) + `metadata.json` · **Figure:** `results/convergence.png`

## Question

How quickly does the simulated mean converge to the true expected score as the number of trials N
grows, and do RoboRoute's 95 % confidence intervals contain the true value about 95 % of the time?

## Method

Scenario D with the budget relaxed to 600 s so that no trial is cut off. The expected score of
the optimal plan is then known exactly from the planning model: **146.4844 points**, and the
simulation must converge to it (design doc §9.5). For each N ∈ {10, 30, …, 30,000}, 100 independent
seeds were run (10 % travel-time spread). Recorded: the estimate, its error, and whether the 95 %
interval contains the truth.

## Results

| Trials N | RMSE (points) | Mean \|error\| | 95 % CI coverage |
|---|---|---|---|
| 10 | 10.269 | 8.166 | 95% |
| 30 | 5.130 | 3.941 | 92% |
| 100 | 2.874 | 2.229 | 95% |
| 300 | 1.560 | 1.297 | 97% |
| 1,000 | 0.976 | 0.781 | 93% |
| 3,000 | 0.608 | 0.480 | 93% |
| 10,000 | 0.301 | 0.241 | 96% |
| 30,000 | 0.160 | 0.124 | 95% |

Fitted on a log–log scale: log₁₀(RMSE) = **−0.502** · log₁₀(N) + 1.478. Theory predicts −0.5.

## Discussion

1. **The error shrinks like 1/√N**, as the central limit theorem predicts: ten times more trials
   give about 3.2× less error. 10,000 trials estimate this plan's mean to about ±0.3 points.
2. **The intervals are honest.** Coverage ranges from 92 % to 97 %. With 100 seeds per N, the
   coverage estimate itself has a standard error of about 2.2 percentage points, so these values
   are consistent with the nominal 95 %.
3. **This also validates the engine.** The simulator (random sampling, contingency rules) and the
   optimiser (closed-form expected value) were written independently; they agree to within
   Monte Carlo error.

## Limitations

The check uses a relaxed budget: with the real budget the simulation includes buzzer cut-offs,
which the planning model ignores — that difference is the subject of experiment 3, not an error.
