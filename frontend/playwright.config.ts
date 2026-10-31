import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the real stack:
 *   - FastAPI backend in GA_MOCK_MODE (deterministic data, no Google account)
 *   - Vite dev server
 * Both are started automatically; locally an already-running server is reused.
 */
const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT ?? 5173);
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT ?? 8000);
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results",

  use: {
    baseURL: FRONTEND_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  // Exposed to tests via process.env so API-level checks can hit the backend directly.
  metadata: { backendUrl: BACKEND_URL },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
  ],

  webServer: [
    {
      command: `uv run uvicorn app.main:app --port ${BACKEND_PORT}`,
      cwd: "../backend",
      url: `${BACKEND_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        GA_MOCK_MODE: "true",
        SESSION_SECRET: "e2e-session-secret",
        FRONTEND_ORIGIN: FRONTEND_URL,
      },
    },
    {
      command: `npx vite --port ${FRONTEND_PORT} --strictPort`,
      url: FRONTEND_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { VITE_API_URL: BACKEND_URL, VITE_MOCK_API: "false" },
    },
  ],
});
