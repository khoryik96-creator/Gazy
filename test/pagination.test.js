import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampScanPages,
  buildSearchUrl,
  mergeProfiles,
  shouldContinuePaging,
  PEOPLE_SEARCH_BASE,
} from '../dist/shared/pagination.js';
import { DEFAULT_SCAN_PAGES, MAX_SCAN_PAGES } from '../dist/shared/constants.js';

test('clampScanPages bounds to [1, MAX] and defaults junk', () => {
  assert.equal(clampScanPages(5), 5);
  assert.equal(clampScanPages(0), 1);
  assert.equal(clampScanPages(-3), 1);
  assert.equal(clampScanPages(999), MAX_SCAN_PAGES);
  assert.equal(clampScanPages(3.9), 3); // floored
  assert.equal(clampScanPages(undefined), DEFAULT_SCAN_PAGES);
  assert.equal(clampScanPages('nope'), DEFAULT_SCAN_PAGES);
  assert.equal(clampScanPages(NaN), DEFAULT_SCAN_PAGES);
});

test('buildSearchUrl omits page param on page 1, appends after', () => {
  assert.equal(buildSearchUrl('react dev', 1), PEOPLE_SEARCH_BASE + '?keywords=react%20dev');
  assert.equal(buildSearchUrl('react dev', 0), PEOPLE_SEARCH_BASE + '?keywords=react%20dev');
  assert.equal(buildSearchUrl('react', 3), PEOPLE_SEARCH_BASE + '?keywords=react&page=3');
});

test('buildSearchUrl encodes special characters', () => {
  assert.equal(
    buildSearchUrl('"React" AND C++', 2),
    PEOPLE_SEARCH_BASE + '?keywords=%22React%22%20AND%20C%2B%2B&page=2',
  );
});

test('mergeProfiles unions in order and counts new additions', () => {
  const r1 = mergeProfiles(['a', 'b'], ['b', 'c', 'd']);
  assert.deepEqual(r1.merged, ['a', 'b', 'c', 'd']);
  assert.equal(r1.added, 2);

  const r2 = mergeProfiles(['a', 'b'], ['a', 'b']); // all dupes
  assert.deepEqual(r2.merged, ['a', 'b']);
  assert.equal(r2.added, 0);

  const r3 = mergeProfiles([], ['x']);
  assert.deepEqual(r3.merged, ['x']);
  assert.equal(r3.added, 1);
});

test('mergeProfiles dedupes repeats within the incoming batch', () => {
  const r = mergeProfiles([], ['x', 'x', 'y']);
  assert.deepEqual(r.merged, ['x', 'y']);
  assert.equal(r.added, 2);
});

test('shouldContinuePaging stops at the cap or when nothing new was added', () => {
  assert.equal(shouldContinuePaging(1, 10, 8), true);
  assert.equal(shouldContinuePaging(10, 10, 8), false); // at cap
  assert.equal(shouldContinuePaging(3, 10, 0), false); // no new results
  assert.equal(shouldContinuePaging(1, 1, 8), false); // single-page scan
});
