// AI-evaluation cost tracking. DeepSeek's OpenAI-compatible responses report
// token usage — including how many prompt tokens were cache HITS (billed at a
// lower rate) vs misses — which we accumulate per model; cost is then estimated
// from editable per-token prices and converted to MYR with an editable FX rate.
// Pure and shared (no chrome/DOM) so the arithmetic is unit-tested.

import type { AiModel } from './types.js';

export interface ModelUsage {
  calls: number;
  /** Total prompt (input) tokens, cache hits + misses. */
  inputTokens: number;
  /** Of `inputTokens`, how many were cache hits (cheaper). */
  cachedInputTokens: number;
  outputTokens: number;
}

export interface AiUsage {
  chat: ModelUsage; // deepseek-chat
  reasoner: ModelUsage; // deepseek-reasoner
}

/** USD per 1,000,000 tokens, per model / direction. Editable in the Cost tab. */
export interface AiPrices {
  chatIn: number; // cache-miss input
  chatCached: number; // cache-hit input
  chatOut: number;
  reasonerIn: number;
  reasonerCached: number;
  reasonerOut: number;
}

// DeepSeek list prices at time of writing (USD / 1M tokens). Estimates — the UI
// lets the user correct them. Cache-hit input is billed much cheaper than a miss.
export const DEFAULT_PRICES: AiPrices = {
  chatIn: 0.27,
  chatCached: 0.07,
  chatOut: 1.1,
  reasonerIn: 0.55,
  reasonerCached: 0.14,
  reasonerOut: 2.19,
};

export const DEFAULT_USD_TO_MYR = 4.7;

export function emptyModelUsage(): ModelUsage {
  return { calls: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };
}

export function emptyAiUsage(): AiUsage {
  return { chat: emptyModelUsage(), reasoner: emptyModelUsage() };
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
}

function normalizeModelUsage(raw: unknown): ModelUsage {
  const r = (raw ?? {}) as Partial<ModelUsage>;
  return {
    calls: num(r.calls),
    inputTokens: num(r.inputTokens),
    cachedInputTokens: num(r.cachedInputTokens),
    outputTokens: num(r.outputTokens),
  };
}

/** Tolerant loader for whatever is in storage. */
export function normalizeAiUsage(raw: unknown): AiUsage {
  const r = (raw ?? {}) as Partial<AiUsage>;
  return { chat: normalizeModelUsage(r.chat), reasoner: normalizeModelUsage(r.reasoner) };
}

export function normalizePrices(raw: unknown): AiPrices {
  const r = (raw ?? {}) as Partial<AiPrices>;
  return {
    chatIn: price(r.chatIn, DEFAULT_PRICES.chatIn),
    chatCached: price(r.chatCached, DEFAULT_PRICES.chatCached),
    chatOut: price(r.chatOut, DEFAULT_PRICES.chatOut),
    reasonerIn: price(r.reasonerIn, DEFAULT_PRICES.reasonerIn),
    reasonerCached: price(r.reasonerCached, DEFAULT_PRICES.reasonerCached),
    reasonerOut: price(r.reasonerOut, DEFAULT_PRICES.reasonerOut),
  };
}

// Unlike `num`, a stored 0 is a legitimate price (e.g. a free cache-hit rate);
// only non-numbers / negatives fall back to the default.
function price(v: unknown, dflt: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : dflt;
}

/** Records one call's token usage against the right model. Immutable. */
export function addUsage(
  u: AiUsage,
  model: AiModel,
  inputTokens: number,
  outputTokens: number,
  cachedTokens = 0,
): AiUsage {
  const key: keyof AiUsage = model === 'deepseek-reasoner' ? 'reasoner' : 'chat';
  const prev = u[key];
  const next = emptyAiUsage();
  next.chat = { ...u.chat };
  next.reasoner = { ...u.reasoner };
  next[key] = {
    calls: prev.calls + 1,
    inputTokens: prev.inputTokens + num(inputTokens),
    cachedInputTokens: prev.cachedInputTokens + num(cachedTokens),
    outputTokens: prev.outputTokens + num(outputTokens),
  };
  return next;
}

/** Per-1M-token prices for one model (named to avoid positional-arg mistakes). */
export interface ModelPrice {
  in: number; // cache-miss input
  cached: number; // cache-hit input
  out: number;
}

/** Estimated USD for one model's usage, splitting input into cache hits/misses. */
export function modelCostUsd(m: ModelUsage, p: ModelPrice): number {
  const cached = Math.min(m.cachedInputTokens, m.inputTokens);
  const miss = m.inputTokens - cached;
  return (miss / 1e6) * p.in + (cached / 1e6) * p.cached + (m.outputTokens / 1e6) * p.out;
}

export function chatPrice(p: AiPrices): ModelPrice {
  return { in: p.chatIn, cached: p.chatCached, out: p.chatOut };
}

export function reasonerPrice(p: AiPrices): ModelPrice {
  return { in: p.reasonerIn, cached: p.reasonerCached, out: p.reasonerOut };
}

/** Estimated USD across both models. */
export function totalCostUsd(u: AiUsage, p: AiPrices): number {
  return modelCostUsd(u.chat, chatPrice(p)) + modelCostUsd(u.reasoner, reasonerPrice(p));
}

export function totalCalls(u: AiUsage): number {
  return u.chat.calls + u.reasoner.calls;
}
