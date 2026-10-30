import scenarioA from "../../../scenarios/a-simple-arena.json";
import scenarioD from "../../../scenarios/d-complex.json";

import type { Scenario } from "@/lib/api/client";

/** The real Scenario A file shipped in /scenarios, typed as the API returns it. */
export const SCENARIO_A = scenarioA as Scenario;


/** Scenario D: constraints, bonus, penalty and attachments — useful for editing tests. */
export const SCENARIO_D = scenarioD as Scenario;
