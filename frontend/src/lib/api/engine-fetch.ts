import type { EngineReply, EngineRequest } from "./engine.worker";

/**
 * A `fetch` that answers API requests from the engine running in a Web Worker in this tab
 * instead of from a server. The worker starts on the first request.
 */
let worker: Worker | undefined;
let failure: Error | undefined;
let nextId = 0;
const pending = new Map<number, { resolve: (r: Response) => void; reject: (e: Error) => void }>();

function engine(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }: MessageEvent<EngineReply>) => {
      const request = pending.get(data.id);
      pending.delete(data.id);
      if (!request) return;
      if ("error" in data) request.reject(new Error(data.error));
      else request.resolve(new Response(data.body, { status: data.status, headers: data.headers }));
    };
    worker.onerror = (event) => {
      failure = new Error(event.message || "The in-browser engine failed to start.");
      for (const request of pending.values()) request.reject(failure);
      pending.clear();
    };
  }
  return worker;
}

export async function engineFetch(request: Request): Promise<Response> {
  if (failure) throw failure;
  const message: EngineRequest = {
    id: nextId++,
    method: request.method,
    url: request.url,
    headers: [...request.headers],
    body: await request.arrayBuffer(),
  };
  return new Promise((resolve, reject) => {
    pending.set(message.id, { resolve, reject });
    engine().postMessage(message, [message.body]);
  });
}
