import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const PORT = 8123;
const dist = fileURLToPath(new URL("./dist", import.meta.url));

/**
 * End-to-end tests run against the production build served by the backend — the same setup as
 * the container — so routing fallbacks and the Content-Security-Policy are exercised too.
 * Run with `pnpm test:e2e` (builds first).
 */
export default defineConfig({
  testDir: "./e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://127.0.0.1:${String(PORT)}`, trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `uv run uvicorn roboroute.api.app:app --host 127.0.0.1 --port ${String(PORT)}`,
    cwd: "../backend",
    url: `http://127.0.0.1:${String(PORT)}/api/v1/health`,
    env: { ROBOROUTE_STATIC_DIR: dist, ROBOROUTE_CORS_ORIGINS: "" },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
