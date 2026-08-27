import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

// Absolute path to the built extension (npm run build writes here).
const DIST = resolve('dist');
const EXECUTABLE_PATH = process.env.PW_CHROMIUM_PATH || undefined;

async function launchWithExtension() {
  return chromium.launchPersistentContext('', {
    executablePath: EXECUTABLE_PATH,
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

// Seed the same chrome.storage.local shape the popup writes, then wait for the
// dashboard's storage.onChanged listener to re-render the table.
const SEED = {
  profiles: [
    'https://www.linkedin.com/in/alice',
    'https://www.linkedin.com/in/bob',
    'https://www.linkedin.com/in/carol',
  ],
  profileScores: {
    'https://www.linkedin.com/in/alice': { success: true, score: 80, location: 'Berlin' },
    'https://www.linkedin.com/in/bob': { success: true, score: 40, location: 'Paris' },
    'https://www.linkedin.com/in/carol': { success: true, score: 60, location: 'Madrid' },
  },
  aiEvals: {
    'https://www.linkedin.com/in/alice': { score: 90 },
  },
  shortlist: ['https://www.linkedin.com/in/bob'],
  folders: {
    order: ['Frontend'],
    members: { Frontend: ['https://www.linkedin.com/in/carol'] },
  },
};

test.beforeAll(() => {
  if (!existsSync(resolve(DIST, 'manifest.json'))) {
    throw new Error('dist/ not built — run `npm run build` before the e2e tests.');
  }
});

test('dashboard renders seeded candidates, sorts, switches views, and selects in bulk', async () => {
  const context = await launchWithExtension();
  try {
    const id = await extensionId(context);
    const page = await context.newPage();

    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`chrome-extension://${id}/dashboard/dashboard.html`);

    // Seed storage from the page (chrome-extension origin has chrome.storage).
    // The dashboard's onChanged listener re-renders, so the rows appear.
    await page.evaluate((seed) => chrome.storage.local.set(seed), SEED);

    // All three working-results candidates render.
    const rows = page.locator('#tbody tr');
    await expect(rows).toHaveCount(3);

    // Default sort is keyword score, highest first → Alice (80) is row 1.
    await expect(rows.first().locator('.cand-link')).toHaveText('alice');

    // Clicking the Score header flips direction → lowest first → Bob (40) top.
    await page.locator('th[data-sort="kw"]').click();
    await expect(rows.first().locator('.cand-link')).toHaveText('bob');
    // A direction arrow is now shown on that header.
    await expect(page.locator('th[data-sort="kw"]')).toContainText(/[▲▼]/);

    // Shortlist tab shows only the one starred candidate (Bob).
    await page.locator('#tabShort').click();
    await expect(page.locator('#tbody tr')).toHaveCount(1);
    await expect(page.locator('#tbody tr .cand-link')).toHaveText('bob');

    // The seeded folder chip appears and filters to its one member (Carol).
    await page.locator('#tabAll').click();
    const folderChip = page.locator('#folderBar .folder-chip', { hasText: 'Frontend' });
    await expect(folderChip).toHaveCount(1);
    await folderChip.click();
    await expect(page.locator('#tbody tr')).toHaveCount(1);
    await expect(page.locator('#tbody tr .cand-link')).toHaveText('carol');

    // Bulk selection: select-all reveals the bulk action bar with the count.
    await page.locator('#tabAll').click();
    await expect(page.locator('#tbody tr')).toHaveCount(3);
    await page.locator('#selectAll').click();
    await expect(page.locator('#bulkBar')).toBeVisible();
    await expect(page.locator('#bulkCount')).toHaveText('3 selected');

    // "Retry failed" stays hidden when nothing failed...
    await expect(page.locator('#retryFailedBtn')).toBeHidden();
    // ...and appears (with a count) once a candidate has a failed scrape.
    await page.evaluate(
      (u) =>
        chrome.storage.local.set({
          profileScores: {
            [u]: { success: false, score: 0, location: '' },
          },
        }),
      SEED.profiles[0],
    );
    await expect(page.locator('#retryFailedBtn')).toBeVisible();
    await expect(page.locator('#retryFailedBtn')).toContainText('Retry failed (1)');

    expect(errors, `dashboard threw: ${errors.join('; ')}`).toEqual([]);
  } finally {
    await context.close();
  }
});

test('workspace backup downloads valid JSON that excludes the API key', async () => {
  const context = await launchWithExtension();
  try {
    const id = await extensionId(context);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/dashboard/dashboard.html`);

    // Seed some data plus a secret key that must NOT end up in the backup.
    await page.evaluate(
      (seed) => chrome.storage.local.set({ ...seed, aiKey: 'sk-secret-should-not-export' }),
      SEED,
    );
    await expect(page.locator('#tbody tr')).toHaveCount(3);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#backupBtn').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^gazy-workspace-\d{4}-\d{2}-\d{2}\.json$/);

    const stream = await download.createReadStream();
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    const text = Buffer.concat(chunks).toString('utf8');

    const parsed = JSON.parse(text);
    expect(parsed.format).toBe('gazy-workspace');
    expect(parsed.data.profiles).toHaveLength(3);
    expect(text).not.toContain('sk-secret-should-not-export'); // key never exported
  } finally {
    await context.close();
  }
});
