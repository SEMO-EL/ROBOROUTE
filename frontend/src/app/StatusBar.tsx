import { useEffect, useState } from "react";

import { api, IN_BROWSER, unwrap, type Schemas } from "@/lib/api/client";

type ApiClient = typeof api;

type BackendState =
  | { kind: "checking" }
  | { kind: "online"; version: Schemas["VersionInfo"] }
  | { kind: "offline"; reason: string };

/** Persistent footer reporting whether the computation backend is reachable. */
export function StatusBar({ client = api }: { client?: ApiClient }) {
  const [state, setState] = useState<BackendState>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;
    unwrap(client.GET("/api/v1/version"))
      .then((version) => {
        if (!cancelled) setState({ kind: "online", version });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ kind: "offline", reason: error instanceof Error ? error.message : "" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  return (
    <footer
      role="status"
      className="flex h-7 shrink-0 items-center gap-3 border-t border-border bg-surface px-3 text-xs text-muted"
    >
      {state.kind === "checking" && (
        <span>
          {IN_BROWSER
            ? "Loading the engine into your browser (about 20 MB on the first visit)…"
            : "Connecting to API…"}
        </span>
      )}
      {state.kind === "online" && (
        <>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full bg-success" />
            {IN_BROWSER ? "Engine ready (runs in your browser)" : "API online"}
          </span>
          <span className="font-mono">
            engine {state.version.version} · NumPy {state.version.numpy} · Python{" "}
            {state.version.python}
          </span>
        </>
      )}
      {state.kind === "offline" && (
        <span className="flex items-center gap-1.5" title={state.reason}>
          <span aria-hidden="true" className="size-2 rounded-full bg-danger" />
          {IN_BROWSER
            ? "The engine could not load — reload the page to try again."
            : "API offline — start the backend (see README) to plan routes and run simulations."}
        </span>
      )}
    </footer>
  );
}
