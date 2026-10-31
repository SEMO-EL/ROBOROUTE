/// <reference lib="webworker" />
/**
 * The RoboRoute engine running in the browser (the GitHub Pages build, which has no server).
 * Pyodide — CPython compiled to WebAssembly, self-hosted under `pyodide/` — loads the backend
 * package and answers each API request through the same FastAPI app the server runs, so
 * validation, error envelopes and limits are identical. See `scripts/pages-build.mjs`.
 */
import type { PyodideAPI } from "pyodide";
import type { PyProxy } from "pyodide/ffi";

export interface EngineRequest {
  id: number;
  method: string;
  url: string;
  headers: [string, string][];
  body: ArrayBuffer;
}

export type EngineReply =
  | { id: number; status: number; headers: [string, string][]; body: Uint8Array<ArrayBuffer> }
  | { id: number; error: string };

const base = new URL(`${import.meta.env.BASE_URL}pyodide/`, self.location.href).href;

const scenarios = import.meta.glob<string>("../../../../scenarios/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
});

async function download(name: string): Promise<ArrayBuffer> {
  const response = await fetch(base + name);
  if (!response.ok) throw new Error(`Cannot download ${name} (${String(response.status)}).`);
  return response.arrayBuffer();
}

type Handle = (method: string, url: string, headers: PyProxy, body: PyProxy) => Promise<PyProxy>;

async function start(): Promise<{ pyodide: PyodideAPI; handle: Handle }> {
  const { loadPyodide } = (await import(/* @vite-ignore */ `${base}pyodide.mjs`)) as {
    loadPyodide: typeof import("pyodide").loadPyodide;
  };
  const pyodide = await loadPyodide({ indexURL: base });
  const [wheel] = await Promise.all([
    download("roboroute.whl"),
    pyodide.loadPackage(["numpy", "fastapi"]),
  ]);
  pyodide.unpackArchive(wheel, "wheel");
  const fs = pyodide.FS as {
    mkdir(path: string): void;
    writeFile(path: string, data: string): void;
  };
  fs.mkdir("/scenarios");
  for (const [path, text] of Object.entries(scenarios)) {
    fs.writeFile(`/scenarios/${path.slice(path.lastIndexOf("/") + 1)}`, text);
  }
  await pyodide.runPythonAsync(`
import os
os.environ["ROBOROUTE_EXAMPLES_DIR"] = "/scenarios"
os.environ["ROBOROUTE_CORS_ORIGINS"] = ""
from roboroute.api.browser import handle, run_without_threads
run_without_threads()
from roboroute.api.app import app

async def handle_request(method, url, headers, body):
    return await handle(app, method, url, headers, body)
`);
  const globals = pyodide.globals as unknown as { get(name: string): Handle };
  return { pyodide, handle: globals.get("handle_request") };
}

const ready = start();
let scipy: Promise<unknown> | undefined;

self.onmessage = async ({ data }: MessageEvent<EngineRequest>) => {
  let reply: EngineReply;
  try {
    const { pyodide, handle } = await ready;
    // Only calibration needs SciPy, a large download: fetch it on first use.
    if (new URL(data.url).pathname.endsWith("/calibration/fit")) {
      scipy ??= pyodide.loadPackage("scipy");
      await scipy;
    }
    const headers = pyodide.toPy(data.headers) as PyProxy;
    const body = pyodide.toPy(new Uint8Array(data.body)) as PyProxy;
    const result = await handle(data.method, data.url, headers, body);
    const [status, responseHeaders, responseBody] = result.toJs() as [
      number,
      [string, string][],
      Uint8Array<ArrayBuffer>,
    ];
    for (const proxy of [headers, body, result]) proxy.destroy();
    reply = { id: data.id, status, headers: responseHeaders, body: responseBody };
  } catch (error) {
    reply = { id: data.id, error: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(reply);
};
