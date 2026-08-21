import { defineConfig } from '@playwright/test';

// E2E smoke tests live in e2e/ and drive the *built* extension in dist/, so the
// build must run first (npm run test:e2e does that). Kept separate from the unit
// tests and the fast `check` gate because loading a real browser extension is
// heavier and slower than the pure-logic tests.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
});
