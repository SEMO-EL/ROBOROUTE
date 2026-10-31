import { defineConfig } from "@playwright/test";

import config from "./playwright.config";

const PORT = 8124;

/**
 * The same end-to-end and accessibility tests against the GitHub Pages build
 * (`pnpm test:e2e:pages`): a static site under /ROBOROUTE/ with the engine running in the
 * browser, so no backend is started.
 */
export default defineConfig({
  ...config,
  // The first API call waits for the in-browser engine to download and start.
  expect: { timeout: 60_000 },
  use: { ...config.use, baseURL: `http://127.0.0.1:${String(PORT)}/ROBOROUTE/` },
  webServer: {
    command: `pnpm exec vite preview --mode pages --host 127.0.0.1 --port ${String(PORT)} --strictPort`,
    url: `http://127.0.0.1:${String(PORT)}/ROBOROUTE/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
