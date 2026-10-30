import { createApiClient } from "@/lib/api/client";
import { SCENARIO_A } from "@/test/fixtures";

import { useProjectStore } from "./project";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("project store", () => {
  beforeEach(() => {
    useProjectStore.setState(useProjectStore.getInitialState());
  });

  it("loads an example scenario", async () => {
    const client = createApiClient({
      baseUrl: "http://api.test",
      fetch: () => Promise.resolve(json(200, SCENARIO_A)),
    });
    await useProjectStore.getState().loadExample("a-simple-arena", client);
    const state = useProjectStore.getState();
    expect(state.status).toBe("ready");
    expect(state.scenario?.id).toBe("a-simple-arena");
  });

  it("keeps the previous scenario and reports the error when loading fails", async () => {
    useProjectStore.setState({ scenario: SCENARIO_A, status: "ready" });
    const client = createApiClient({
      baseUrl: "http://api.test",
      fetch: () => Promise.resolve(json(404, { code: "not_found", message: "No example 'x'." })),
    });
    await useProjectStore.getState().loadExample("x", client);
    const state = useProjectStore.getState();
    expect(state.status).toBe("error");
    expect(state.error).toBe("No example 'x'.");
    expect(state.scenario?.id).toBe("a-simple-arena");
  });
});
