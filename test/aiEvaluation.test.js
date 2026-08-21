import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEvaluationMessages, parseEvaluationResponse } from '../dist/shared/aiEvaluation.js';

test('buildEvaluationMessages includes the requirements and profile text', () => {
  const { system, user } = buildEvaluationMessages('React and AWS', 'Senior React engineer');
  assert.match(system, /JSON/);
  assert.match(user, /React and AWS/);
  assert.match(user, /Senior React engineer/);
});

test('buildEvaluationMessages truncates very long profile text', () => {
  const long = 'x'.repeat(20000);
  const { user } = buildEvaluationMessages('role', long);
  // Should be capped well below the raw length.
  assert.ok(user.length < 10000, `expected truncation, got ${user.length}`);
});

test('parseEvaluationResponse reads a clean JSON object', () => {
  const entry = parseEvaluationResponse(
    '{"score": 82, "reason": "Strong match", "matched": ["React"], "missing": ["AWS"]}',
  );
  assert.equal(entry.score, 82);
  assert.equal(entry.reason, 'Strong match');
  assert.deepEqual(entry.matched, ['React']);
  assert.deepEqual(entry.missing, ['AWS']);
});

test('parseEvaluationResponse tolerates prose / markdown fences around the JSON', () => {
  const raw =
    'Here is my assessment:\n```json\n{"score": 40, "reason": "partial"}\n```\nHope that helps.';
  const entry = parseEvaluationResponse(raw);
  assert.equal(entry.score, 40);
  assert.equal(entry.reason, 'partial');
  assert.deepEqual(entry.matched, []); // missing fields default to empty
});

test('parseEvaluationResponse clamps out-of-range or non-integer scores', () => {
  assert.equal(parseEvaluationResponse('{"score": 150}').score, 100);
  assert.equal(parseEvaluationResponse('{"score": -5}').score, 0);
  assert.equal(parseEvaluationResponse('{"score": 73.6}').score, 74);
  assert.equal(parseEvaluationResponse('{"score": "not a number"}').score, 0);
});

test('parseEvaluationResponse throws when there is no JSON object', () => {
  assert.throws(() => parseEvaluationResponse('the model refused to answer'));
});
