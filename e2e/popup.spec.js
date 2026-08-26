import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

// Absolute path to the built extension (npm run build writes here).
const DIST = resolve('dist');

// Chromium binary. In CI, Playwright's own installed browser is used (leave
// PW_CHROMIUM_PATH unset). Locally / in the sandbox, point PW_CHROMIUM_PATH at a
// full Chromium (not headless_shell — that build can't load extensions).
const EXECUTABLE_PATH = process.env.PW_CHROMIUM_PATH || undefined;

async function launchWithExtension() {
  return chromium.launchPersistentContext('', {
    executablePath: EXECUTABLE_PATH,
    // headless:false + explicit --headless=new launches the full Chromium, which
    // (unlike the default headless_shell) can load an unpacked extension.
    headless: false,
    args: [
      '--headless=new',
      '--no-sandbox',
      `--disable-extensions-except=${DIST}`,
      `--load-extension=${DIST}`,
    ],
  });
}

async function extensionId(context) {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 20000 });
  return new URL(sw.url()).host;
}

test.beforeAll(() => {
  if (!existsSync(resolve(DIST, 'manifest.json'))) {
    throw new Error('dist/ not built — run `npm run build` before the e2e tests.');
  }
});

test('extension loads and its service worker registers', async () => {
  const context = await launchWithExtension();
  try {
    const id = await extensionId(context);
    expect(id).toMatch(/^[a-z]{32}$/);
  } finally {
    await context.close();
  }
});

test('popup renders its core controls without a JS error', async () => {
  const context = await launchWithExtension();
  try {
    const id = await extensionId(context);
    const page = await context.newPage();

    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`chrome-extension://${id}/popup/popup.html`);

    // The controls the whole UI hangs off of must be present.
    await expect(page.locator('#searchBtn')).toHaveCount(1);
    await expect(page.locator('#scoreBtn')).toHaveCount(1);
    await expect(page.locator('#exportBtn')).toHaveCount(1);
    await expect(page.locator('#jdInput')).toHaveCount(1);

    // Fresh popup shows the empty state (proves render.ts ran, not just static
    // HTML). Assert the element exists rather than its exact copy, which changes.
    await expect(page.locator('.empty-state')).toHaveCount(1);

    expect(errors, `popup threw: ${errors.join('; ')}`).toEqual([]);
  } finally {
    await context.close();
  }
});
