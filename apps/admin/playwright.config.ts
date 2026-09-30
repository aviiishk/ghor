import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { E2E } from "./e2e/env";

// Browser smoke test for the admin console: real Chromium → apps/admin (built, `next start`)
// → apps/api (built, `node dist/main.js`) → a DISPOSABLE local Postgres (never dev/prod —
// see e2e/global-setup.ts). Run from apps/admin:
//   npm run build -w apps/api && npm run build -w apps/admin && npm run test:e2e -w apps/admin
// OTP codes are captured through the API's test-only SMS sink (SMS_TEST_SINK_DIR, refused
// in production); TOTP codes are computed from the secret the enrollment page displays —
// no authentication shortcut exists.
//
// PLAYWRIGHT_CHROMIUM_EXECUTABLE lets you point at an already-installed Chromium when
// `npx playwright install chromium` can't download (e.g. a restricted network).
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: E2E.adminUrl,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}
  },
  webServer: [
    {
      command: "node dist/main.js",
      cwd: path.join(__dirname, "..", "api"),
      url: `${E2E.apiUrl}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: E2E.apiEnv
    },
    {
      command: "npx next start -p " + E2E.adminPort,
      cwd: __dirname,
      url: `${E2E.adminUrl}/sign-in`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: E2E.adminEnv
    }
  ]
});
