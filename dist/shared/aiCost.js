// AI-evaluation cost tracking. DeepSeek's OpenAI-compatible responses report
// token usage — including how many prompt tokens were cache HITS (billed at a
// lower rate) vs misses — which we accumulate per model; cost is then estimated
// from editable per-token prices and converted to MYR with an editable FX rate.
// Pure and shared (no chrome/DOM) so the arithmetic is unit-tested.
// DeepSeek list prices at time of writing (USD / 1M tokens). Estimates — the UI
// lets the user correct them. Cache-hit input is billed much cheaper than a miss.
export const DEFAULT_PRICES = {
    chatIn: 0.27,
    chatCached: 0.07,
    chatOut: 1.1,
    reasonerIn: 0.55,
    reasonerCached: 0.14,
    reasonerOut: 2.19,
};
export const DEFAULT_USD_TO_MYR = 4.7;
export function emptyModelUsage() {
    return { calls: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };
}
export function emptyAiUsage() {
    return { chat: emptyModelUsage(), reasoner: emptyModelUsage() };
}
function num(v) {
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
}
function normalizeModelUsage(raw) {
    const r = (raw ?? {});
    return {
        calls: num(r.calls),
        inputTokens: num(r.inputTokens),
        cachedInputTokens: num(r.cachedInputTokens),
        outputTokens: num(r.outputTokens),
    };
}
/** Tolerant loader for whatever is in storage. */
export function normalizeAiUsage(raw) {
    const r = (raw ?? {});
    return { chat: normalizeModelUsage(r.chat), reasoner: normalizeModelUsage(r.reasoner) };
}
export function normalizePrices(raw) {
    const r = (raw ?? {});
    return {
        chatIn: num(r.chatIn) || DEFAULT_PRICES.chatIn,
        chatCached: num(r.chatCached) || DEFAULT_PRICES.chatCached,
        chatOut: num(r.chatOut) || DEFAULT_PRICES.chatOut,
        reasonerIn: num(r.reasonerIn) || DEFAULT_PRICES.reasonerIn,
        reasonerCached: num(r.reasonerCached) || DEFAULT_PRICES.reasonerCached,
        reasonerOut: num(r.reasonerOut) || DEFAULT_PRICES.reasonerOut,
    };
}
/** Records one call's token usage against the right model. Immutable. */
export function addUsage(u, model, inputTokens, outputTokens, cachedTokens = 0) {
    const key = model === 'deepseek-reasoner' ? 'reasoner' : 'chat';
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
/** Estimated USD for one model's usage, splitting input into cache hits/misses. */
export function modelCostUsd(m, inPrice, cachedPrice, outPrice) {
    const cached = Math.min(m.cachedInputTokens, m.inputTokens);
    const miss = m.inputTokens - cached;
    return (miss / 1e6) * inPrice + (cached / 1e6) * cachedPrice + (m.outputTokens / 1e6) * outPrice;
}
/** Estimated USD across both models. */
export function totalCostUsd(u, p) {
    return (modelCostUsd(u.chat, p.chatIn, p.chatCached, p.chatOut) +
        modelCostUsd(u.reasoner, p.reasonerIn, p.reasonerCached, p.reasonerOut));
}
export function totalCalls(u) {
    return u.chat.calls + u.reasoner.calls;
}
