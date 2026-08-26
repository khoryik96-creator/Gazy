import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyAiUsage,
  normalizeAiUsage,
  normalizePrices,
  addUsage,
  modelCostUsd,
  totalCostUsd,
  totalCalls,
  DEFAULT_PRICES,
} from '../dist/shared/aiCost.js';

test('addUsage records against the right model and counts calls', () => {
  let u = emptyAiUsage();
  u = addUsage(u, 'deepseek-chat', 1000, 200);
  u = addUsage(u, 'deepseek-chat', 500, 100);
  u = addUsage(u, 'deepseek-reasoner', 2000, 800);
  assert.deepEqual(u.chat, { calls: 2, inputTokens: 1500, outputTokens: 300 });
  assert.deepEqual(u.reasoner, { calls: 1, inputTokens: 2000, outputTokens: 800 });
  assert.equal(totalCalls(u), 3);
});

test('addUsage is immutable and ignores junk token counts', () => {
  const u0 = emptyAiUsage();
  const u1 = addUsage(u0, 'deepseek-chat', NaN, -5);
  assert.deepEqual(u0.chat, { calls: 0, inputTokens: 0, outputTokens: 0 });
  assert.deepEqual(u1.chat, { calls: 1, inputTokens: 0, outputTokens: 0 });
});

test('modelCostUsd / totalCostUsd compute per-million pricing', () => {
  const m = { calls: 1, inputTokens: 1_000_000, outputTokens: 500_000 };
  assert.equal(modelCostUsd(m, 0.27, 1.1), 0.27 + 0.55);

  let u = emptyAiUsage();
  u = addUsage(u, 'deepseek-chat', 1_000_000, 1_000_000);
  const cost = totalCostUsd(u, DEFAULT_PRICES);
  assert.ok(Math.abs(cost - (DEFAULT_PRICES.chatIn + DEFAULT_PRICES.chatOut)) < 1e-9);
});

test('normalizeAiUsage / normalizePrices tolerate junk', () => {
  assert.deepEqual(normalizeAiUsage(null), emptyAiUsage());
  assert.deepEqual(normalizeAiUsage({ chat: { calls: 3 } }).chat, {
    calls: 3,
    inputTokens: 0,
    outputTokens: 0,
  });
  const p = normalizePrices({ chatIn: 0 }); // 0 falls back to default
  assert.equal(p.chatIn, DEFAULT_PRICES.chatIn);
});
