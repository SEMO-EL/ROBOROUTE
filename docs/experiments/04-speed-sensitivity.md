# Experiment 4 — Robot speed and the optimal strategy

**Code:** `experiments/04-speed-sensitivity/run.py` · **Raw data:** `results/raw.csv` + `metadata.json`

## Question

If the robot drives faster or slower (for example a different motor power setting), how much does
the best achievable expected score change, and at which speeds does the optimal mission set change?

## Method

Scenarios B (single run, 90 s) and D (multi-run with attachments and constraints, 150 s). For each
speed factor $f \in \{0.5, 0.6, \dots, 1.5\}$ the linear and turning **top speeds** are multiplied
by $f$; the stored route geometry is re-timed with the motion model and the DP re-solved.
Accelerations and mission durations are unchanged.

## Results

| Scenario | ×0.5 | ×0.6 | ×0.7 | ×0.8 | ×0.9 | ×1.0 | ×1.1–×1.5 |
|---|---|---|---|---|---|---|---|
| B optimal | 115.8 (5) | 124.3 (6) | 124.3 (6) | 134.8 (6) | 134.8 | 134.8 | 134.8 |
| B greedy | 106.8 | 124.3 | 124.3 | 124.3 | 134.8 | 134.8 | 134.8 at ×1.1–1.2, **124.3 at ×1.3–1.5** |
| D optimal | 126.5 (6) | 126.5 | 126.5 | 143.0 (7) | 146.5 (7) | 146.5 | 146.5 |
| D greedy | 97.4 | 97.4 | 97.4 | 117.4 | 117.4 | 117.4 | 117.4 |

(Number of missions in parentheses where it changes.) Travel time of the optimal plan in B falls
from 27.1 s at ×1.0 to 24.4 s at ×1.5 — only 10 %.

## Discussion

1. **The optimum never gets worse with a faster robot** — every plan that fits stays feasible —
   and the data confirm it.
2. **Greedy can get worse with a faster robot.** In B at ×1.2 greedy picks valve → drill → crane
   → satellite → solar → lift (134.8). At ×1.3 the shorter travel times change the ratio ranking:
   it now takes solar before satellite, from the new position "relay" has the better ratio, and
   afterwards "lift" no longer fits (124.3). A heuristic's quality is not monotone in its inputs;
   the exact method's is.
3. **Above about ×0.9 extra speed buys nothing here.** Mission work (60 s in B) dominates the
   clock, and short legs are limited by acceleration and turning, so a 50 % higher top speed saves
   only about 10 % of travel time. For these scenarios, improving mission reliability or mission
   duration matters more than driving faster.
4. **Below a threshold the plan changes discretely**: D loses "tree" between ×0.8 and ×0.7 (−16.5
   expected points). Teams can read the threshold directly from the app's sensitivity table.

## Limitations

Two fictional scenarios; accelerations held fixed; speed changes are assumed not to affect mission
success probabilities (in reality, driving faster can reduce accuracy).
