import createClient from "openapi-fetch";

import type { components, paths } from "./schema";

export type Schemas = components["schemas"];
type SchemaName = keyof Schemas;

/**
 * A model as the API *returns* it. Models used in both requests and responses have separate
 * "-Input" (defaults optional) and "-Output" (defaults always present) schemas; responses use the
 * latter. An Output value is always assignable to the matching Input type.
 */
export type Model<K extends string> = `${K}-Output` extends SchemaName
  ? Schemas[`${K}-Output`]
  : K extends SchemaName
    ? Schemas[K]
    : never;

export type Scenario = Model<"Scenario">;

/** An error from the RoboRoute API, or from failing to reach it at all (status 0). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ErrorEnvelope {
  code: string;
  message: string;
  details?: unknown;
}

function isEnvelope(value: unknown): value is ErrorEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).code === "string" &&
    typeof (value as Record<string, unknown>).message === "string"
  );
}

export interface ApiClientOptions {
  /** Origin of the API. Defaults to the page's own origin (the dev server proxies /api). */
  baseUrl?: string;
  fetch?: (request: Request) => Promise<Response>;
}

export function createApiClient(options: ApiClientOptions = {}) {
  return createClient<paths>({
    baseUrl: options.baseUrl ?? globalThis.location.origin,
    // Resolve fetch lazily so tests and polyfills that replace globalThis.fetch take effect.
    fetch: options.fetch ?? ((request: Request) => globalThis.fetch(request)),
  });
}

/** Resolve an openapi-fetch call to its data, throwing ApiError for every kind of failure. */
export async function unwrap<T>(
  pending: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let result: { data?: T; error?: unknown; response: Response };
  try {
    result = await pending;
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new ApiError(0, "network_error", `Cannot reach the RoboRoute API (${reason}).`);
  }
  const { data, error, response } = result;
  if (!response.ok || error !== undefined) {
    if (isEnvelope(error)) {
      throw new ApiError(response.status, error.code, error.message, error.details ?? null);
    }
    throw new ApiError(
      response.status,
      `http_${response.status}`,
      `The API answered ${response.status} ${response.statusText}`.trim(),
    );
  }
  return data as T;
}

const env = import.meta.env as { VITE_API_BASE?: string; VITE_ENGINE?: string };

/** The engine runs in this browser tab (the GitHub Pages build) instead of on a server. */
export const IN_BROWSER = env.VITE_ENGINE === "pyodide";

export const api = createApiClient(
  IN_BROWSER
    ? { fetch: async (request) => (await import("./engine-fetch")).engineFetch(request) }
    : env.VITE_API_BASE
      ? { baseUrl: env.VITE_API_BASE }
      : {},
);
