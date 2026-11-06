import { defineConfig } from '@playwright/test';

// Most tests run in Node; the --browser checks launch Chromium themselves.
export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  reporter: 'list',
});
