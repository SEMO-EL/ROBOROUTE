# RoboRoute user guide

For students, coaches and judges who want to plan a robot-game strategy with RoboRoute. No
programming is needed. The [README](../README.md) explains how to run RoboRoute.

RoboRoute answers three questions about your robot game:

1. **Where can the robot drive, and how long does each trip take?** (Arena, Robot)
2. **Which missions should we attempt, and in what order?** (Strategy)
3. **How does that plan hold up when things go wrong?** (Simulation)

Every answer comes from a calculation you can inspect on the **Learn** page. Nothing is made up or
generated text.

---

## 1. Start a project

On **Overview**, either open a fictional example (Scenarios A–D) or start a blank field:

- **One continuous run:** the robot leaves home once (WRO RoboMission style).
- **Several runs from home:** the robot returns home between runs, where you can change attachments
  (FLL Challenge style).

Your work is saved automatically **in this browser only**. Nothing is uploaded to an account.
Use **Export** to keep a copy or share it, and **Import** to open a shared file. Examples stay
unsaved until you change something.

## 2. Draw the field (Arena)

Set the field size, then add obstacles, keep-out areas and missions with the toolbar. Drag to move;
`Ctrl+Z` / `Ctrl+Shift+Z` undo and redo; arrow keys nudge the selection.

Each mission has an **approach pose**: where the robot's centre must be, and which way it faces,
to start the mission. The badge next to the toolbar checks the scenario as you edit. It warns, for
example, when a pose is so close to a wall that the robot cannot stand there.

## 3. Describe the missions (Missions)

For each mission enter:

| Field | What to put |
| --- | --- |
| Points | What the mission scores when it succeeds |
| Time to do the mission | Measured from the approach pose: always the same, best/usual/worst, or your own list of measured times |
| Chance of success | A percentage, or better: *successes out of attempts* from practice. RoboRoute then uses (s + 1) / (n + 2), which never claims certainty from a few runs |
| Attempts allowed | Retries after a failure |
| Constraints | "A must be done before B", "A requires B to have succeeded", "A and B exclude each other" |
| Bonuses | Extra points for completing a group of missions |

## 4. Calibrate your robot (Robot)

RoboRoute does not assume any particular robot. It learns your robot's speed from a stopwatch:

1. Run your normal drive-straight program over a measured distance and time it from start to
   stop. A phone stopwatch is fine.
2. Repeat for at least **two different distances**, for example 20 cm and 100 cm, a few times each.
3. Enter the measurements and press **Fit driving speed**. RoboRoute fits
   *time = distance ÷ top speed + start-up time*, shows how well the line fits, and derives the
   acceleration.
4. Do the same for turning on the spot with two angles, for example 90° and 360°.
5. **Apply to robot**.

The more different the distances are, the better the fit. With a single distance, RoboRoute cannot
separate top speed from start-up time and says so. The *sanity check* compares your result with
the maximum your motors could reach (from motor RPM and wheel diameter).

If you have timed a whole trip (say from the start to the crane), add it under **Measured trip
times** on the same page. It replaces the modelled time for that trip, in that direction only (the
way back can take longer), and the strategy timeline marks it "(measured)".

## 5. Find the best plan (Strategy)

Press **Optimise**. RoboRoute considers every set of missions and every order in which they fit the
time budget (up to 16 candidate missions), and returns:

- the **optimal plan**, with its expected score and timeline;
- a **greedy plan** ("most points per second first") for comparison. Greedy is sometimes
  much worse, and the page shows by how much;
- **why** each mission was chosen or left out, worked out by re-optimising without it (or with
  it forced in);
- how the best plan changes if the robot is **slower or faster** than calibrated.

The expected score uses *average* durations and budgets every allowed attempt, so the plan fits even
if all retries are needed.

## 6. Test the plan under uncertainty (Simulation)

Press **Run simulation**. Each plan is played thousands of times with random mission times, random
successes and failures, and random travel-time variation. The buzzer is strict: a mission still
running at the end scores nothing.

You get the average score with its uncertainty, the spread of scores, the chance of reaching a
**target score** you choose, how often the buzzer cuts a run short, and per-mission success rates.
Plans are compared on the *same* random draws, so the difference between them is not luck.

A plan with the best average is not always the best choice. If you need a minimum score to advance,
compare the chance of reaching that target.

## 7. Save, compare and share (Experiments)

**Save as experiment** stores the settings and results. On **Experiments** you can compare saved
runs, **Reproduce** one (RoboRoute re-runs it and confirms the result is identical), and export
the experiment as a file or every simulated match as a spreadsheet (CSV).

## 8. See how it works (Learn)

- **Pathfinding:** plan a route and step through the search cell by cell, with the g, h and f
  values the algorithm actually used.
- **Optimisation:** how many mission sets the optimiser examined, the best ones it found, and the
  calculation behind your plan's timeline.
- **Simulation:** the random quantities drawn in each match, and how the average settles as more
  matches are played.

---

## What RoboRoute cannot tell you

- **The model is only as good as your measurements.** Calibrate with your real robot, on your real
  table, and re-measure after changing the robot.
- **Routes are planned for a robot that drives straight lines and turns on the spot**, kept clear of
  obstacles by a safety disc. Real robots drift; the simulation's travel-time variation is a rough
  allowance for this, not a physics model.
- **Mission outcomes are treated as independent.** If one failure makes another more likely (a
  misaligned robot fails twice), the simulation is too optimistic.
- **Uncertainty intervals describe the simulation, not reality.** "128 ± 1" means more simulated
  matches would not change the estimate much. It does not mean the robot will score 128.
- **Examples are fictional.** RoboRoute ships no official competition content; enter your season's
  rules yourself.

## Limits

| What | Limit |
| --- | --- |
| Missions per scenario | 32 (exact optimisation up to 16 candidates; above that only the greedy plan) |
| Speed-sensitivity analysis | up to 12 candidate missions |
| Planning grid | 400 000 cells (choose a coarser grid resolution for large fields) |
| Travel times between all missions | grid cells × (missions + 1) up to 3 000 000 — e.g. a 400 000-cell grid allows 6 missions, a 100 000-cell grid 29 |
| Simulation | 50 000 matches per plan, 3 plans and 100 000 matches per run |
| Imported files | 1 MB |
