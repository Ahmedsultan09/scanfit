import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
const installedChrome =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath =
  process.env.SCANFIT_CHROME ??
  (existsSync(installedChrome) ? installedChrome : undefined);
export default defineConfig({
  testDir: "tests/browser",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: "http://127.0.0.1:5173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
    },
    ...(process.env.SCANFIT_ALL_BROWSERS
      ? [
          { name: "firefox", use: { ...devices["Desktop Firefox"] } },
          { name: "webkit", use: { ...devices["Desktop Safari"] } },
        ]
      : []),
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
