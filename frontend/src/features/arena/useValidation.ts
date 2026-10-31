import { useEffect, useState } from "react";

import { api, unwrap, type Scenario } from "@/lib/api/client";

type ApiClient = typeof api;

export interface ValidationIssue {
  code: string;
  message: string;
  path: (string | number)[];
  severity: "error" | "warning";
}

export type ValidationState =
  | { kind: "checking" }
  | { kind: "done"; issues: ValidationIssue[] }
  | { kind: "unavailable"; message: string };

const DEBOUNCE_MS = 400;

/** Validate the scenario with the backend after the user pauses editing. */
export function useValidation(scenario: Scenario | null, client: ApiClient = api): ValidationState {
  const [state, setState] = useState<{ for: Scenario | null; value: ValidationState }>({
    for: null,
    value: { kind: "checking" },
  });

  useEffect(() => {
    if (!scenario) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      unwrap(client.POST("/api/v1/scenarios/validate", { body: scenario }))
        .then((report) => {
          if (!cancelled)
            setState({
              for: scenario,
              value: { kind: "done", issues: report.issues },
            });
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setState({
              for: scenario,
              value: {
                kind: "unavailable",
                message: error instanceof Error ? error.message : String(error),
              },
            });
          }
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scenario, client]);

  return state.for === scenario ? state.value : { kind: "checking" };
}
