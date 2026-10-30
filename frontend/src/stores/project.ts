import { create } from "zustand";

import { api, unwrap, type Scenario } from "@/lib/api/client";

type ApiClient = typeof api;

export interface ProjectState {
  scenario: Scenario | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  loadExample: (id: string, client?: ApiClient) => Promise<void>;
}

/**
 * The scenario currently being worked on. A failed load keeps the previous scenario so that a
 * network hiccup never discards the user's work.
 */
export const useProjectStore = create<ProjectState>()((set) => ({
  scenario: null,
  status: "idle",
  error: null,
  loadExample: async (id, client = api) => {
    set({ status: "loading", error: null });
    try {
      const scenario = await unwrap(
        client.GET("/api/v1/examples/{example_id}", { params: { path: { example_id: id } } }),
      );
      set({ scenario, status: "ready", error: null });
    } catch (error) {
      set({ status: "error", error: error instanceof Error ? error.message : String(error) });
    }
  },
}));
