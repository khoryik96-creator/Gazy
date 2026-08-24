import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LARGE_RUN_THRESHOLD,
  isLargeRun,
  estimateScoreMinutes,
  largeRunWarning,
} from '../dist/shared/runGuard.js';

test('isLargeRun triggers strictly above the threshold', () => {
  assert.equal(isLargeRun(LARGE_RUN_THRESHOLD), false);
  assert.equal(isLargeRun(LARGE_RUN_THRESHOLD + 1), true);
  assert.equal(isLargeRun(0), false);
});

test('estimateScoreMinutes is at least 1 and scales with count', () => {
  assert.equal(estimateScoreMinutes(0), 1);
  assert.ok(estimateScoreMinutes(100) > estimateScoreMinutes(30));
});

test('largeRunWarning is empty for small runs', () => {
  assert.equal(largeRunWarning(LARGE_RUN_THRESHOLD, 'score'), '');
  assert.equal(largeRunWarning(5, 'ai'), '');
});

test('largeRunWarning mentions the count and the relevant cost', () => {
  const score = largeRunWarning(50, 'score');
  assert.match(score, /50/);
  assert.match(score, /LinkedIn/);
  assert.match(score, /min/);

  const ai = largeRunWarning(50, 'ai');
  assert.match(ai, /50/);
  assert.match(ai, /DeepSeek/);
  assert.match(ai, /credits/);
});
