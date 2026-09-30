import { defineConfig } from '@playwright/test';

// BASE_URL points the same suite at a deployed copy (Docker, staging, GitHub Pages).
const external = process.env.BASE_URL;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: external ?? 'http://127.0.0.1:5177', channel: 'chrome', acceptDownloads: true },
  webServer: external
    ? undefined
    : { command: 'npm run dev', url: 'http://127.0.0.1:5177', reuseExistingServer: true, timeout: 60_000 },
});
