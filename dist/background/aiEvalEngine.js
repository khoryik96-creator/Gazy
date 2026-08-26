import { MESSAGE } from '../shared/constants.js';
import { fetchProfileData } from './profileFetcher.js';
import { evaluateProfile } from './deepseek.js';
import { normalizeAiUsage, addUsage } from '../shared/aiCost.js';
let running = false;
let stopRequested = false;
/**
 * Kicks off an AI-evaluation run and returns immediately; the run itself
 * (runAiEvalLoop) is detached. We must NOT make the caller await the whole loop:
 * the messaging layer acks 'started' synchronously, and if it awaited instead,
 * the MV3 service worker could be recycled before the (potentially long, network-
 * bound) loop finished, so the ack would never arrive — surfacing as
 * "Failed to start: unknown" in the UI. Progress/results come over their own
 * messages and storage.
 */
export function startAiEval(req) {
    if (running)
        return;
    running = true;
    stopRequested = false;
    void runAiEvalLoop(req);
}
/** Requests the in-flight AI-evaluation run stop after the current profile. */
export function stopAiEval() {
    stopRequested = true;
}
/**
 * Evaluates each profile with DeepSeek, sequentially. Profile text comes from
 * fetchProfileData, which serves from the 24h cache when the profile was already
 * scraped for keyword scoring — so a normal "score, then AI-evaluate" flow makes
 * no extra LinkedIn requests. Emits AI_EVAL_PROGRESS after each profile and
 * AI_EVAL_COMPLETE at the end; a per-profile failure is recorded, not fatal.
 */
async function runAiEvalLoop(req) {
    // Start from any AI evals + cost usage already saved, so evaluating a subset
    // (e.g. from the dashboard) merges rather than wipes the rest.
    const stored = (await chrome.storage.local.get(['aiEvals', 'aiUsage']));
    const results = { ...(stored.aiEvals || {}) };
    let usage = normalizeAiUsage(stored.aiUsage);
    const total = req.profiles.length;
    let index = 0;
    try {
        for (const url of req.profiles) {
            if (stopRequested)
                break; // user hit Stop — leave what's done, bail out
            index++;
            let entry;
            try {
                const data = await fetchProfileData(url);
                const result = await evaluateProfile({
                    apiKey: req.apiKey,
                    model: req.model,
                    jd: req.jd,
                    profileText: data.fullText,
                });
                entry = result.entry;
                usage = addUsage(usage, req.model, result.inputTokens, result.outputTokens);
            }
            catch (e) {
                entry = { score: 0, reason: '', matched: [], missing: [], error: e.message };
            }
            results[url] = entry;
            // Persist from the background so results + cost survive the popup closing
            // and are picked up live by the dashboard.
            await chrome.storage.local.set({ aiEvals: results, aiUsage: usage });
            void chrome.runtime
                .sendMessage({
                type: MESSAGE.AI_EVAL_PROGRESS,
                currentIndex: index,
                total,
                results,
                progress: Math.round((index / total) * 100),
            })
                .catch(() => { });
        }
    }
    finally {
        running = false;
    }
    void chrome.runtime.sendMessage({ type: MESSAGE.AI_EVAL_COMPLETE, results }).catch(() => { });
}
