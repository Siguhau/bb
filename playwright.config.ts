import { defineConfig } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin.e2e@example.com";
const adminPassword =
  process.env.E2E_ADMIN_PASSWORD ?? "playwright-test-password";

process.env.E2E_ADMIN_EMAIL = adminEmail;
process.env.E2E_ADMIN_PASSWORD = adminPassword;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5174",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: [
    {
      command: "node scripts/start-e2e-backend.mjs",
      url: "http://127.0.0.1:3100/api/health",
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        DATABASE_URL: "file:./e2e.db",
        PORT: "3100",
        SHOP_TIME_ZONE: "Europe/Oslo",
        ADMIN_BOOTSTRAP_EMAIL: adminEmail,
        ADMIN_BOOTSTRAP_PASSWORD: adminPassword,
      },
    },
    {
      command:
        "pnpm --filter bouvet-bike-frontend dev --host 127.0.0.1 --port 5174",
      url: "http://127.0.0.1:5174/customer",
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        VITE_API_PROXY_TARGET: "http://127.0.0.1:3100",
      },
    },
  ],
});
