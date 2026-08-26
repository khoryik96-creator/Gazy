import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRetryable, shouldRetry, backoffDelayMs } from '../dist/shared/retry.js';

test('isRetryable: thin-content and transient are retryable; fatal is not', () => {
  assert.equal(isRetryable('thin-content'), true);
  assert.equal(isRetryable('transient'), true);
  assert.equal(isRetryable('fatal'), false);
});

test('shouldRetry: retries a recoverable failure only while under the attempt cap', () => {
  assert.equal(shouldRetry('transient', 0, 3), true);
  assert.equal(shouldRetry('transient', 2, 3), true);
  assert.equal(shouldRetry('transient', 3, 3), false); // hit the cap
  assert.equal(shouldRetry('thin-content', 1, 3), true);
});

test('shouldRetry: a fatal failure is never retried, even on attempt 0', () => {
  assert.equal(shouldRetry('fatal', 0, 3), false);
});

test('backoffDelayMs: grows ~2^attempt and stays within the jittered band', () => {
  // With a fixed base band [1000, 1000] the jitter is pinned, so the growth is exact.
  assert.equal(backoffDelayMs(0, 1000, 1000), 1000); // base
  assert.equal(backoffDelayMs(1, 1000, 1000), 2000); // 2×
  assert.equal(backoffDelayMs(2, 1000, 1000), 4000); // 4×
});

test('backoffDelayMs: never exceeds the cap', () => {
  assert.equal(backoffDelayMs(10, 1000, 1000, 5000), 5000);
});

test('backoffDelayMs: result stays in a sane range across random bases', () => {
  for (let i = 0; i < 200; i++) {
    const d = backoffDelayMs(1, 3000, 6000);
    // attempt 1 → 2× a base in [3000,6000] → [6000,12000].
    assert.ok(d >= 6000 && d <= 12000, `out of range: ${d}`);
  }
});
