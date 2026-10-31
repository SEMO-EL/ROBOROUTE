import { Link } from "react-router";

import type { Scenario } from "@/lib/api/client";
import { useSimulationStore } from "@/stores/simulation";
import { scenarioKey, useStrategyStore } from "@/stores/strategy";

function Tile({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  note: string;
}) {
  return (
    <div className="flex flex-col gap-0.5" title={note}>
      <span className="text-xs text-muted">{label}</span>
      <span className="font-mono text-xl">
        {value}
        {unit && <span className="ml-1 text-sm text-muted">{unit}</span>}
      </span>
      <span className="text-xs text-faint">{note}</span>
    </div>
  );
}

/** Headline numbers of the latest optimisation and simulation of the open scenario. */
export function LatestResults({ scenario }: { scenario: Scenario }) {
  const key = scenarioKey(scenario);
  const strategy = useStrategyStore((s) => (s.scenarioKey === key ? s.result : null));
  const simulation = useSimulationStore((s) => (s.scenarioKey === key ? s.result : null));
  const plan = strategy?.optimal ?? strategy?.greedy ?? null;
  const simulated = simulation?.plans[0] ?? null;

  if (!plan) {
    return (
      <p className="text-muted">
        No plan yet for this scenario.{" "}
        <Link
          to="/strategy"
          className="text-accent underline underline-offset-2 hover:text-accent-strong"
        >
          Optimise it
        </Link>{" "}
        to see the expected score, then simulate it to see how it behaves under uncertainty.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <Tile
        label="Expected score"
        value={plan.expected_score.toFixed(1)}
        unit="pts"
        note="planning model"
      />
      <Tile
        label="Planned time"
        value={plan.completion_time.toFixed(1)}
        unit={`/ ${scenario.format.time_budget} s`}
        note="planning model"
      />
      <Tile
        label="Missions in the plan"
        value={plan.runs.flat().length.toString()}
        unit={`of ${scenario.missions.length}`}
        note={`${plan.runs.length} run(s)`}
      />
      {simulated && (
        <>
          <Tile
            label={`Simulated mean (${simulated.label})`}
            value={simulated.score.mean.toFixed(1)}
            unit="pts"
            note={`${simulated.score.n.toLocaleString("en")} simulated matches`}
          />
          {simulated.probability_target && (
            <Tile
              label="Chance of reaching target"
              value={`${(simulated.probability_target.estimate * 100).toFixed(1)}%`}
              note="simulated"
            />
          )}
          <Tile
            label="Cut off by the buzzer"
            value={`${(simulated.probability_cut_off.estimate * 100).toFixed(1)}%`}
            note="simulated"
          />
        </>
      )}
    </div>
  );
}
