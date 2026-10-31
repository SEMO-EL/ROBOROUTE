import type { SimulateResult } from "@/lib/api/endpoints";

const fmt = (value: number, digits = 1) => value.toFixed(digits);
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

export function Insight({ result }: { result: SimulateResult }) {
  const [reference] = result.plans;
  if (!reference) return null;
  const better = result.differences
    .filter((d) => d.interval.low > 0)
    .sort((a, b) => b.mean - a.mean)[0];
  if (!better) return null;
  return (
    <p
      role="note"
      className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-warning"
    >
      Under uncertainty, {better.plan} scores more on average than {reference.label}: +
      {fmt(better.mean)} expected points (95% interval +{fmt(better.interval.low)} to +
      {fmt(better.interval.high)}). The planning model uses mean durations; the simulation also
      counts runs that hit the buzzer.
    </p>
  );
}

export function Ranking({ result, target }: { result: SimulateResult; target: number | null }) {
  const difference = (label: string) => result.differences.find((d) => d.plan === label);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="text-xs text-muted">
          <tr>
            <th className="py-1.5 pr-3 font-medium">Plan</th>
            <th
              className="py-1.5 pr-3 font-medium"
              title="Expected score under the deterministic planning model"
            >
              Planning model
            </th>
            <th className="py-1.5 pr-3 font-medium">Simulated mean (95% CI)</th>
            {target !== null && <th className="py-1.5 pr-3 font-medium">P(score ≥ {target})</th>}
            <th className="py-1.5 pr-3 font-medium">Cut off by buzzer</th>
            <th className="py-1.5 font-medium">vs {result.plans[0]?.label}</th>
          </tr>
        </thead>
        <tbody className="font-mono text-[13px]">
          {result.plans.map((plan) => {
            const d = difference(plan.label);
            return (
              <tr key={plan.label} className="border-t border-border">
                <td className="py-1.5 pr-3 font-sans">{plan.label}</td>
                <td className="py-1.5 pr-3">{fmt(plan.analytic_expected_score)}</td>
                <td className="py-1.5 pr-3">
                  {fmt(plan.score.mean)}{" "}
                  <span className="text-muted">
                    ({fmt(plan.score.mean_ci.low)}–{fmt(plan.score.mean_ci.high)})
                  </span>
                </td>
                {target !== null && (
                  <td className="py-1.5 pr-3">
                    {plan.probability_target ? pct(plan.probability_target.estimate) : "—"}
                  </td>
                )}
                <td className="py-1.5 pr-3">{pct(plan.probability_cut_off.estimate)}</td>
                <td className="py-1.5">
                  {d ? (
                    <>
                      {d.mean >= 0 ? "+" : ""}
                      {fmt(d.mean)}{" "}
                      <span className="text-muted">
                        ({fmt(d.interval.low)}…{fmt(d.interval.high)})
                      </span>
                    </>
                  ) : (
                    <span className="text-muted">reference</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
