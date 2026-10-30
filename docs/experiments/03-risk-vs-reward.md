# Experiment 3 — Risk versus reward

**Code:** `experiments/03-risk-vs-reward/{run,analyze}.py` ·
**Raw data:** `results/raw.csv` (45 plan simulations) + `metadata.json` ·
**Figure:** `results/risk_vs_reward.png`

## Question

Scenario C offers a high-value but unreliable "jackpot" mission (60 points) next to steady,
reliable ones. As the jackpot's success probability p changes:

1. When does the optimiser include it?
2. Does the plan with the best expected score under the planning model also do best once timing
   uncertainty and the hard buzzer are simulated? Is it also the plan most likely to reach a
   target of 100 points?

## Method

For each p ∈ {0.2, 0.3, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 0.9}: the DP returns its top 5 plans
(ranked by planning-model expected score). Each plan is simulated with 20,000 trials, the same seed
for all plans (common random numbers) and 10 % travel-time spread.

## Results

| Jackpot p | Model-optimal includes jackpot | Model-optimal: simulated mean / P(≥100) / cut-off | Best simulated mean (model rank) | Best P(≥100) (model rank) |
|---|---|---|---|---|
| 0.2 | no | 128.6 / 82.1% / 0.0% | 128.6 (#1) | 82.1% (#1) |
| 0.3 | no | 128.6 / 82.1% / 0.0% | 128.6 (#1) | 82.1% (#1) |
| 0.4 | yes | 125.6 / 62.9% / 12.5% | 131.5 (#2) | 82.1% (#5) |
| 0.45 | yes | 127.6 / 64.5% / 12.5% | 134.2 (#2) | 80.5% (#5) |
| 0.5 | yes | 129.6 / 66.1% / 12.5% | 137.0 (#2) | 82.3% (#5) |
| 0.6 | yes | 133.7 / 69.7% / 12.5% | 142.8 (#2) | 85.9% (#5) |
| 0.7 | yes | 137.8 / 73.1% / 12.5% | 148.6 (#2) | 89.5% (#5) |
| 0.8 | yes | 141.9 / 76.7% / 12.5% | 154.3 (#2) | 93.2% (#5) |
| 0.9 | yes | 146.0 / 80.1% / 12.5% | 159.9 (#2) | 96.8% (#5) |

Example at p = 0.45 (all 5 plans): model ranks #1–#4 have planning-model scores 136.5, 135.8,
135.8, 135.8 but simulated means 127.6, 134.2, 132.0, 123.3 and cut-off probabilities 12.4 %,
4.7 %, 8.3 %, 12.6 %; #5 (130.2 on paper, no long-shot) simulates to 130.0 with no cut-offs and
the highest P(score ≥ 100) of 80.4 %.

## Discussion

1. **Reliability threshold.** Below p ≈ 0.4 the optimiser leaves the jackpot out; above it the
   jackpot's expected value (60·p) beats the alternatives it displaces.
2. **The planning model's best plan is not the best plan under uncertainty.** From p = 0.4 on, the
   model-optimal plan finishes with the jackpot so close to the buzzer that it is cut off in
   12.5 % of matches, losing 7–14 points of mean score against the model's estimate. A plan
   ranked #2 on paper — almost the same missions, slightly shorter — wins in simulation every time.
   This is exactly why RoboRoute keeps two models (design doc §9.5) and why the Simulation page
   compares the optimiser's top plans.
3. **"Highest average" and "most likely to reach a target" are different goals.** The plan most
   likely to reach 100 points (#5) drops the risky long-shot mission and never hits the buzzer. A
   team that needs a reliable score in a knockout round should pick a different plan than a team
   chasing a high average.

## Limitations

- One fictional scenario; the size of the effect depends on how tight the budget is.
- The planning model budgets mean durations; a planning variant that budgets a high percentile of
  the duration (robust planning) would reduce cut-offs. It is a natural extension and is not
  implemented yet.
