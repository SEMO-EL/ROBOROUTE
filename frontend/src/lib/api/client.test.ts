import { ApiError, createApiClient, unwrap } from "./client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("unwrap", () => {
  it("returns the data of a successful response", async () => {
    const client = createApiClient({
      fetch: () => Promise.resolve(jsonResponse(200, { status: "ok" })),
    });
    await expect(unwrap(client.GET("/api/v1/health"))).resolves.toEqual({ status: "ok" });
  });

  it("converts the error envelope into an ApiError", async () => {
    const client = createApiClient({
      fetch: () =>
        Promise.resolve(jsonResponse(404, { code: "not_found", message: "No example 'x'." })),
    });
    const error = await unwrap(
      client.GET("/api/v1/examples/{example_id}", { params: { path: { example_id: "x" } } }),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: "not_found", message: "No example 'x'." });
  });

  it("reports an unreachable backend as a network error", async () => {
    const client = createApiClient({ fetch: () => Promise.reject(new TypeError("fetch failed")) });
    await expect(unwrap(client.GET("/api/v1/health"))).rejects.toMatchObject({
      code: "network_error",
      status: 0,
    });
  });

  it("handles error bodies that are not envelopes", async () => {
    const client = createApiClient({
      fetch: () => Promise.resolve(new Response("Bad Gateway", { status: 502 })),
    });
    await expect(unwrap(client.GET("/api/v1/health"))).rejects.toMatchObject({
      code: "http_502",
      status: 502,
    });
  });
});
