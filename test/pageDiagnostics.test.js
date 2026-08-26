import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseEmptyPage } from '../dist/shared/pageDiagnostics.js';

const base = { onSearchPage: true, loginWall: false, hasResultsContainer: true, matched: 0 };

test('a non-empty page needs no explanation', () => {
  assert.equal(diagnoseEmptyPage({ ...base, matched: 5 }), '');
});

test('a login wall gives an actionable log-in message', () => {
  const msg = diagnoseEmptyPage({ ...base, loginWall: true });
  assert.match(msg, /logged out|log in/i);
});

test('search page with no results container reads as a layout change, not "no matches"', () => {
  const msg = diagnoseEmptyPage({ ...base, hasResultsContainer: false });
  assert.match(msg, /layout|loading|update/i);
});

test('a genuinely empty result set suggests broadening the search', () => {
  const msg = diagnoseEmptyPage(base);
  assert.match(msg, /no profiles found/i);
  assert.doesNotMatch(msg, /layout/i);
});

test('login wall takes precedence over a missing container', () => {
  const msg = diagnoseEmptyPage({ ...base, loginWall: true, hasResultsContainer: false });
  assert.match(msg, /logged out|log in/i);
});
