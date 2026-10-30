import { render, screen } from "@testing-library/react";

import { createApiClient } from "@/lib/api/client";

import { StatusBar } from "./StatusBar";

function clientAnswering(handler: (path: string) => Response | Promise<Response>) {
  return createApiClient({
    baseUrl: "http://api.test",
    fetch: (request) => Promise.resolve(handler(new URL(request.url).pathname)),
  });
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

describe("StatusBar", () => {
  it("shows the engine and NumPy versions when the API is online", async () => {
    const client = clientAnswering(() =>
      json({ version: "0.1.0", python: "3.13.17", numpy: "2.5.4" }),
    );
    render(<StatusBar client={client} />);
    expect(await screen.findByText(/API online/)).toBeInTheDocument();
    expect(screen.getByText(/engine 0\.1\.0/)).toBeInTheDocument();
    expect(screen.getByText(/NumPy 2\.5\.4/)).toBeInTheDocument();
  });

  it("explains how to recover when the API is unreachable", async () => {
    const client = createApiClient({
      baseUrl: "http://api.test",
      fetch: () => Promise.reject(new TypeError("connection refused")),
    });
    render(<StatusBar client={client} />);
    expect(await screen.findByText(/API offline/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/start the backend/i);
  });
});
