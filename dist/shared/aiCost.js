// AI-evaluation cost tracking. DeepSeek's OpenAI-compatible responses report
// token usage, which we accumulate per model; cost is then estimated from
// editable per-token prices and converted to MYR with an editable FX rate. Pure
// and shared (no chrome/DOM) so the arithmetic is unit-tested.
// DeepSeek list prices at time of writing (USD / 1M tokens). Estimates — the UI
// lets the user correct them.
export const DEFAULT_PRICES = {
    chatIn: 0.27,
    chatOut: 1.1,
    reasonerIn: 0.55,
    reasonerOut: 2.19,
};
export const DEFAULT_USD_TO_MYR = 4.7;
export function emptyModelUsage() {
    return { calls: 0, inputTokens: 0, outputTokens: 0 };
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
        chatOut: num(r.chatOut) || DEFAULT_PRICES.chatOut,
        reasonerIn: num(r.reasonerIn) || DEFAULT_PRICES.reasonerIn,
        reasonerOut: num(r.reasonerOut) || DEFAULT_PRICES.reasonerOut,
    };
}
/** Records one call's token usage against the right model. Immutable. */
export function addUsage(u, model, inputTokens, outputTokens) {
    const key = model === 'deepseek-reasoner' ? 'reasoner' : 'chat';
    const prev = u[key];
    const next = emptyAiUsage();
    next.chat = { ...u.chat };
    next.reasoner = { ...u.reasoner };
    next[key] = {
        calls: prev.calls + 1,
        inputTokens: prev.inputTokens + num(inputTokens),
        outputTokens: prev.outputTokens + num(outputTokens),
    };
    return next;
}
/** Estimated USD for one model's usage. */
export function modelCostUsd(m, inPrice, outPrice) {
    return (m.inputTokens / 1e6) * inPrice + (m.outputTokens / 1e6) * outPrice;
}
/** Estimated USD across both models. */
export function totalCostUsd(u, p) {
    return (modelCostUsd(u.chat, p.chatIn, p.chatOut) +
        modelCostUsd(u.reasoner, p.reasonerIn, p.reasonerOut));
}
export function totalCalls(u) {
    return u.chat.calls + u.reasoner.calls;
}
