import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreOutcome, aiOutcome, outcomeLabel } from '../dist/shared/runReport.js';

test('scoreOutcome splits total into ok + failed', () => {
  assert.deepEqual(scoreOutcome(40, 3), { ok: 37, failed: 3, total: 40 });
  assert.deepEqual(scoreOutcome(5, 0), { ok: 5, failed: 0, total: 5 });
});

test('scoreOutcome clamps a nonsense failed count', () => {
  assert.deepEqual(scoreOutcome(4, 99), { ok: 0, failed: 4, total: 4 });
  assert.deepEqual(scoreOutcome(4, -1), { ok: 4, failed: 0, total: 4 });
});

test('aiOutcome counts errors as failures and skips absent urls', () => {
  const evals = {
    a: { score: 80 },
    b: { score: 0, error: 'DeepSeek 429: rate limited' },
    // c absent → not counted (stopped before reaching it)
  };
  assert.deepEqual(aiOutcome(['a', 'b', 'c'], evals), { ok: 1, failed: 1, total: 2 });
});

test('outcomeLabel omits the failed clause when nothing failed', () => {
  assert.equal(outcomeLabel('⭐', 'Scored', { ok: 5, failed: 0, total: 5 }), '⭐ Scored 5');
  assert.equal(
    outcomeLabel('⭐', 'Scored', { ok: 37, failed: 3, total: 40 }),
    '⭐ Scored 37 · ⚠️ 3 failed',
  );
});
