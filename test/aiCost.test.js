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

test('addUsage records against the right model, tracks cache hits, counts calls', () => {
  let u = emptyAiUsage();
  u = addUsage(u, 'deepseek-chat', 1000, 200, 400); // 400 cached
  u = addUsage(u, 'deepseek-chat', 500, 100, 0);
  u = addUsage(u, 'deepseek-reasoner', 2000, 800, 1000);
  assert.deepEqual(u.chat, {
    calls: 2,
    inputTokens: 1500,
    cachedInputTokens: 400,
    outputTokens: 300,
  });
  assert.deepEqual(u.reasoner, {
    calls: 1,
    inputTokens: 2000,
    cachedInputTokens: 1000,
    outputTokens: 800,
  });
  assert.equal(totalCalls(u), 3);
});

test('addUsage is immutable and ignores junk token counts', () => {
  const u0 = emptyAiUsage();
  const u1 = addUsage(u0, 'deepseek-chat', NaN, -5, NaN);
  assert.deepEqual(u0.chat, { calls: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 });
  assert.deepEqual(u1.chat, { calls: 1, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 });
});

test('modelCostUsd splits input into cache hits (cheaper) and misses', () => {
  // 1M input of which 400k cached, 500k output.
  const m = { calls: 1, inputTokens: 1_000_000, cachedInputTokens: 400_000, outputTokens: 500_000 };
  const expected = (600_000 / 1e6) * 0.27 + (400_000 / 1e6) * 0.07 + (500_000 / 1e6) * 1.1;
  assert.ok(Math.abs(modelCostUsd(m, 0.27, 0.07, 1.1) - expected) < 1e-9);
});

test('totalCostUsd uses cache-hit pricing across models', () => {
  let u = emptyAiUsage();
  u = addUsage(u, 'deepseek-chat', 1_000_000, 0, 1_000_000); // all cached input
  const cost = totalCostUsd(u, DEFAULT_PRICES);
  assert.ok(Math.abs(cost - DEFAULT_PRICES.chatCached) < 1e-9);
});

test('normalizeAiUsage / normalizePrices tolerate junk', () => {
  assert.deepEqual(normalizeAiUsage(null), emptyAiUsage());
  assert.deepEqual(normalizeAiUsage({ chat: { calls: 3 } }).chat, {
    calls: 3,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
  });
  const p = normalizePrices({ chatIn: 0 }); // 0 falls back to default
  assert.equal(p.chatIn, DEFAULT_PRICES.chatIn);
  assert.equal(p.chatCached, DEFAULT_PRICES.chatCached);
});
