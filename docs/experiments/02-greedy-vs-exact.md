# Experiment 2 — Greedy baseline versus exact optimisation

**Code:** `experiments/02-greedy-vs-exact/{run,analyze}.py` ·
**Raw data:** `results/raw.csv` (1,500 instances) + `metadata.json` · **Figure:** `results/greedy_gap.png`

## Question

How often, and by how much, does the greedy rule "next, take the mission with the most expected
points per second" miss the optimal plan? Does it depend on the number of missions $n$ and on how
tight the time budget is?

## Method

Random instances (generator documented in `run.py`):

- $n \in \{4, 6, 8, 10, 12\}$ missions placed uniformly on a 2.4 m × 1.2 m field, start at (0.2, 0.2).
- Travel time = distance / 0.25 m/s + 1 s turning overhead (a stand-in for the route planner so
  that many instances can be generated quickly).
- Duration ~ U(4, 20) s, points ∈ {10, 15, …, 50}, success probability ~ U(0.6, 1).
- Budget $B = \rho \times$ (time to do every mission in nearest-neighbour order), with tightness
  $\rho \in \{0.3, 0.5, 0.7\}$.
- No constraints or attachments (isolates selection and ordering). Half single-run, half
  multi-run (5 s reset). 100 instances per $(n, \rho)$, seed 7.
- Relative gap $= (E_{opt} - E_{greedy}) / E_{opt}$; "greedy optimal" means gap ≤ 1e-9.
- The DP itself is validated against brute force in the test suite (300 random instances per run).

## Results

| n | ρ | Greedy optimal | Mean gap | Median gap | Worst gap | DP median (ms) | Greedy median (ms) |
|---|---|---|---|---|---|---|---|
| 4 | 0.3 | 83% | 2.7% | 0.0% | 49.2% | 0.2 | 0.02 |
| 4 | 0.5 | 78% | 4.0% | 0.0% | 43.0% | 0.3 | 0.02 |
| 4 | 0.7 | 61% | 6.1% | 0.0% | 41.4% | 0.4 | 0.03 |
| 6 | 0.3 | 71% | 3.4% | 0.0% | 31.5% | 0.4 | 0.03 |
| 6 | 0.5 | 52% | 5.6% | 0.0% | 28.1% | 0.9 | 0.04 |
| 6 | 0.7 | 38% | 6.3% | 4.8% | 24.3% | 1.6 | 0.05 |
| 8 | 0.3 | 51% | 6.3% | 0.0% | 40.2% | 1.3 | 0.05 |
| 8 | 0.5 | 32% | 6.2% | 4.4% | 24.1% | 4.2 | 0.07 |
| 8 | 0.7 | 19% | 5.6% | 5.7% | 16.6% | 10.6 | 0.12 |
| 10 | 0.3 | 33% | 5.4% | 3.2% | 26.8% | 4.4 | 0.09 |
| 10 | 0.5 | 15% | 6.4% | 5.8% | 16.5% | 18.8 | 0.12 |
| 10 | 0.7 | 13% | 5.3% | 5.6% | 12.6% | 30.3 | 0.13 |
| 12 | 0.3 | 17% | 7.9% | 7.5% | 23.8% | 14.8 | 0.13 |
| 12 | 0.5 | 8% | 5.7% | 5.8% | 15.6% | 65.3 | 0.16 |
| 12 | 0.7 | 1% | 6.2% | 5.9% | 14.4% | 126.2 | 0.20 |

By format: greedy was optimal in 38 % of 750 multi-run and 39 % of 750 single-run instances
(mean gap 5.4 % and 5.7 %).

## Discussion

1. **Greedy is usually close but rarely optimal for realistic sizes.** With 12 missions it found
   the optimum in 1–17 % of instances, losing about 6 % of the expected score on average.
2. **Small problems can hide large losses.** The worst gaps (up to 49 %) occur at $n = 4$ with a
   tight budget — exactly the §8.3 trap: an early high-ratio mission uses the time a more valuable
   mission needed.
3. **The exact optimum is cheap at competition sizes.** The DP's median time stayed below 130 ms
   up to 12 missions; it grows roughly 4× per two extra missions (about 6 s at 16 missions in a
   separate check). Greedy runs in well under a millisecond.

## Limitations

- Instances use straight-line travel times, not the route planner, and no constraints; real
  scenarios (B, D) are compared in the app and in experiment 4.
- The generator's distributions shape the numbers; different missions mixes will give different
  gaps. The qualitative findings (greedy optimal less often as $n$ grows) are what transfer.
