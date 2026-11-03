import { defineConfig } from "@playwright/test";

/**
 * E2E runs against the PRODUCTION build (which injects the strict CSP), served
 * by vite preview on 4173. That way the privacy rule #4 audit — zero external
 * network requests — is verified under the same policy users will run.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
