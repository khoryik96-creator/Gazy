import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeIntoStored } from '../dist/shared/resultMerge.js';

const A = 'https://www.linkedin.com/in/alice';
const B = 'https://www.linkedin.com/in/bob';
const C = 'https://www.linkedin.com/in/carol';

test('a subset run PRESERVES the results of candidates it did not cover', () => {
  // The exact bug this guards: "Retry failed" / "Score selected" / folder-view
  // scoring only produces entries for its own targets. Persisting that map alone
  // erased everyone else.
  const stored = {
    [A]: { score: 80, success: true },
    [B]: { score: 40, success: true },
    [C]: { score: 60, success: true },
  };
  const runCoveredOnlyBob = { [B]: { score: 95, success: true } };

  const merged = mergeIntoStored(stored, runCoveredOnlyBob);

  assert.equal(merged[B].score, 95, "the run's own result wins");
  assert.equal(merged[A].score, 80, 'alice was not in the run and must survive');
  assert.equal(merged[C].score, 60, 'carol was not in the run and must survive');
  assert.deepEqual(Object.keys(merged).sort(), [A, B, C].sort());
});

test('tolerates no stored results yet (first ever run)', () => {
  const incoming = { [A]: { score: 10, success: true } };
  assert.deepEqual(mergeIntoStored(undefined, incoming), incoming);
  assert.deepEqual(mergeIntoStored({}, incoming), incoming);
});

test('an empty run leaves the stored results untouched', () => {
  const stored = { [A]: { score: 80, success: true } };
  assert.deepEqual(mergeIntoStored(stored, {}), stored);
});

test('does not mutate either input', () => {
  const stored = { [A]: { score: 80, success: true } };
  const incoming = { [B]: { score: 40, success: true } };
  const merged = mergeIntoStored(stored, incoming);
  merged[C] = { score: 1, success: true };
  assert.deepEqual(Object.keys(stored), [A]);
  assert.deepEqual(Object.keys(incoming), [B]);
});
