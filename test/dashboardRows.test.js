import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  universeUrls,
  buildRows,
  buildRow,
  sortRows,
  inView,
  viewScopeName,
  failedScrapeUrls,
} from '../dist/dashboard/rows.js';

const U = {
  a: 'https://www.linkedin.com/in/alice',
  b: 'https://www.linkedin.com/in/bob',
  c: 'https://www.linkedin.com/in/carol',
};

const folders = (order, members) => ({ order, members });

test('universeUrls: results first, then folder/shortlist extras, de-duplicated', () => {
  const out = universeUrls([U.a], folders(['F'], { F: [U.a, U.b] }), new Set([U.c]));
  assert.deepEqual(out, [U.a, U.b, U.c]); // a (result) first; b (folder), c (shortlist) appended once
});

test('buildRow: keyword + AI labels and folder membership', () => {
  const row = buildRow(U.a, {
    scores: { [U.a]: { success: true, score: 80, location: 'Berlin' } },
    aiEvals: { [U.a]: { score: 90 } },
    shortlist: new Set([U.a]),
    folders: folders(['F'], { F: [U.a] }),
  });
  assert.equal(row.name, 'alice');
  assert.equal(row.kw, 80);
  assert.equal(row.kwLabel, '80%');
  assert.equal(row.ai, 90);
  assert.equal(row.location, 'Berlin');
  assert.equal(row.shortlisted, true);
  assert.deepEqual(row.folders, ['F']);
});

test('buildRow: a failed scrape is not a numeric score', () => {
  const row = buildRow(U.a, {
    scores: { [U.a]: { success: false, score: 0, location: '' } },
    aiEvals: {},
    shortlist: new Set(),
    folders: folders([], {}),
  });
  assert.equal(row.kw, null);
  assert.equal(row.kwClass, 'score-fail');
});

test('sortRows: numeric desc, with unscored (null) always last', () => {
  const rows = buildRows([U.a, U.b, U.c], {
    scores: {
      [U.a]: { success: true, score: 40, location: '' },
      [U.b]: { success: true, score: 80, location: '' },
      // carol unscored → kw null
    },
    aiEvals: {},
    shortlist: new Set(),
    folders: folders([], {}),
  });
  const desc = sortRows(rows, 'kw', -1).map((r) => r.name);
  assert.deepEqual(desc, ['bob', 'alice', 'carol']); // 80, 40, null-last
  const asc = sortRows(rows, 'kw', 1).map((r) => r.name);
  assert.deepEqual(asc, ['alice', 'bob', 'carol']); // 40, 80, null STILL last
});

test('inView: All is results-only; folder view is that folder only', () => {
  const sets = {
    profilesSet: new Set([U.a]),
    shortlist: new Set([U.b]),
    folders: folders(['F'], { F: [U.c] }),
  };
  assert.equal(inView({ kind: 'all' }, U.a, sets), true);
  assert.equal(inView({ kind: 'all' }, U.c, sets), false); // folder-saved, not in results
  assert.equal(inView({ kind: 'shortlist' }, U.b, sets), true);
  assert.equal(inView({ kind: 'folder', name: 'F' }, U.c, sets), true);
  assert.equal(inView({ kind: 'folder', name: 'F' }, U.a, sets), false);
});

test('viewScopeName: folder name for folder view, else the kind', () => {
  assert.equal(viewScopeName({ kind: 'all' }), 'all');
  assert.equal(viewScopeName({ kind: 'shortlist' }), 'shortlist');
  assert.equal(viewScopeName({ kind: 'folder', name: 'Frontend' }), 'Frontend');
});

test('failedScrapeUrls: only success===false counts; scored and unscored do not', () => {
  const scores = {
    [U.a]: { success: false, score: 0, location: '' }, // failed scrape
    [U.b]: { success: true, score: 70, location: '' }, // scored fine
    // carol: never scored (absent)
  };
  assert.deepEqual(failedScrapeUrls([U.a, U.b, U.c], scores), [U.a]);
  assert.deepEqual(failedScrapeUrls([U.b, U.c], scores), []); // nothing failed
});
