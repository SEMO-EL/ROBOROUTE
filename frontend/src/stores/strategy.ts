import { create } from "zustand";

import { api, ApiError, type Scenario } from "@/lib/api/client";
import { optimize, type OptimizeResult } from "@/lib/api/endpoints";

type ApiClient = typeof api;

export interface StrategyState {
  result: OptimizeResult | null;
  /** Which scenario content the result belongs to; a different scenario makes it stale. */
  scenarioKey: string | null;
  status: "idle" | "running" | "ready" | "error";
  error: { message: string; details: string[] } | null;
  run: (scenario: Scenario, client?: ApiClient) => Promise<void>;
}

export function scenarioKey(scenario: Scenario): string {
  return JSON.stringify(scenario);
}

function detailMessages(details: unknown): string[] {
  if (!Array.isArray(details)) return [];
  return details.flatMap((item: unknown) =>
    typeof item === "object" &&
    item !== null &&
    typeof (item as { message?: unknown }).message === "string"
      ? [(item as { message: string }).message]
      : [],
  );
}

export const useStrategyStore = create<StrategyState>()((set) => ({
  result: null,
  scenarioKey: null,
  status: "idle",
  error: null,
  run: async (scenario, client = api) => {
    set({ status: "running", error: null });
    try {
      const result = await optimize(client, scenario);
      set({ result, scenarioKey: scenarioKey(scenario), status: "ready" });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      const details = cause instanceof ApiError ? detailMessages(cause.details) : [];
      set({ status: "error", error: { message, details } });
    }
  },
}));
