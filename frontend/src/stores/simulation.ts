import { create } from "zustand";

import { api, ApiError } from "@/lib/api/client";
import { simulate, type SimulateBody, type SimulateResult } from "@/lib/api/endpoints";

import { scenarioKey } from "./strategy";

type ApiClient = typeof api;

export interface SimulationState {
  result: SimulateResult | null;
  /** The request that produced `result` — saved with experiments so they can be reproduced. */
  request: SimulateBody | null;
  scenarioKey: string | null;
  status: "idle" | "running" | "ready" | "error";
  error: string | null;
  run: (body: SimulateBody, client?: ApiClient) => Promise<void>;
}

export const useSimulationStore = create<SimulationState>()((set) => ({
  result: null,
  request: null,
  scenarioKey: null,
  status: "idle",
  error: null,
  run: async (body, client = api) => {
    set({ status: "running", error: null });
    try {
      const result = await simulate(client, body);
      set({ result, request: body, scenarioKey: scenarioKey(body.scenario), status: "ready" });
    } catch (cause) {
      const message =
        cause instanceof ApiError || cause instanceof Error ? cause.message : String(cause);
      set({ status: "error", error: message });
    }
  },
}));
