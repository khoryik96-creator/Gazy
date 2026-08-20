import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomDelayMs } from '../src/shared/timing.js';

test('randomDelayMs stays within the inclusive range', () => {
  for (let i = 0; i < 1000; i++) {
    const v = randomDelayMs(3000, 9000);
    assert.ok(v >= 3000 && v <= 9000, `out of range: ${v}`);
    assert.equal(Number.isInteger(v), true);
  }
});

test('randomDelayMs tolerates reversed bounds', () => {
  const v = randomDelayMs(9000, 3000);
  assert.ok(v >= 3000 && v <= 9000);
});

test('randomDelayMs with equal bounds returns that value', () => {
  assert.equal(randomDelayMs(2000, 2000), 2000);
});

test('randomDelayMs actually varies (not a fixed constant)', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(randomDelayMs(1500, 4000));
  // Astronomically unlikely to collapse to one value if it's really random.
  assert.ok(seen.size > 5, `expected spread, got ${seen.size} distinct values`);
});
