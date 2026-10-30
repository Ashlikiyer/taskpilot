import { defineConfig, devices } from "@playwright/test";

const ci = Boolean(process.env.CI);

/**
 * Smoke test in a real browser against the real backend and database.
 * Locally it reuses servers that are already running; in CI it starts both, with
 * the offline "echo" AI provider so quick-add costs nothing.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  // CI machines are slower than a laptop; the default 5s is too tight there.
  expect: { timeout: 15_000 },
  reporter: ci ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "uv run uvicorn app.main:app --port 8000",
      cwd: "../backend",
      url: "http://localhost:8000/api/v1/health",
      reuseExistingServer: !ci,
      env: { AI_PROVIDER: "echo" },
      timeout: 120_000,
    },
    {
      command: ci ? "npm run build && npm run start" : "npm run dev",
      url: "http://localhost:3000/login",
      reuseExistingServer: !ci,
      timeout: 240_000,
    },
  ],
});
