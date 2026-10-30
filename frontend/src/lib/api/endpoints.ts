/**
 * Typed wrappers for API calls. Result types are derived from what the client actually returns
 * (openapi-fetch widens JSON tuples to arrays), so components never hand-write response shapes.
 */
import { api, unwrap, type Scenario } from "./client";

type ApiClient = typeof api;

export interface PlanBody {
  scenario: Scenario;
  from_node: string;
  to_node: string;
  options: {
    algorithm: "astar" | "dijkstra";
    heuristic: "octile" | "euclidean" | "manhattan" | "zero";
    connectivity: 4 | 8;
    smooth: boolean;
  };
  include_trace: boolean;
  trace_limit: number;
}

export function planRoute(client: ApiClient, body: PlanBody) {
  return unwrap(client.POST("/api/v1/routes/plan", { body }));
}

export function fetchGrid(client: ApiClient, scenario: Scenario) {
  return unwrap(client.POST("/api/v1/routes/grid", { body: { scenario } }));
}

export type RouteResult = Awaited<ReturnType<typeof planRoute>>;
export type GridResult = Awaited<ReturnType<typeof fetchGrid>>;

export function optimize(client: ApiClient, scenario: Scenario) {
  return unwrap(client.POST("/api/v1/optimize", { body: { scenario } }));
}

export type OptimizeResult = Awaited<ReturnType<typeof optimize>>;

export interface SimulateBody {
  scenario: Scenario;
  plans: { label: string; runs: string[][] }[];
  config: {
    trials: number;
    seed: number;
    travel_time_cv: number;
    skip_if_insufficient_time: boolean;
    target_score: number | null;
  };
}

export function simulate(client: ApiClient, body: SimulateBody) {
  return unwrap(client.POST("/api/v1/simulate", { body }));
}

export type SimulateResult = Awaited<ReturnType<typeof simulate>>;
