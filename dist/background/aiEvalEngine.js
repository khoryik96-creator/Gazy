import { MESSAGE } from '../shared/constants.js';
import { fetchProfileData } from './profileFetcher.js';
import { evaluateProfile } from './deepseek.js';
let running = false;
/**
 * Evaluates each profile with DeepSeek, sequentially. Profile text comes from
 * fetchProfileData, which serves from the 24h cache when the profile was already
 * scraped for keyword scoring — so a normal "score, then AI-evaluate" flow makes
 * no extra LinkedIn requests. Emits AI_EVAL_PROGRESS after each profile and
 * AI_EVAL_COMPLETE at the end; a per-profile failure is recorded, not fatal.
 */
export async function startAiEval(req) {
    if (running)
        return;
    running = true;
    const results = {};
    const total = req.profiles.length;
    let index = 0;
    try {
        for (const url of req.profiles) {
            index++;
            let entry;
            try {
                const data = await fetchProfileData(url);
                entry = await evaluateProfile({
                    apiKey: req.apiKey,
                    model: req.model,
                    jd: req.jd,
                    profileText: data.fullText,
                });
            }
            catch (e) {
                entry = { score: 0, reason: '', matched: [], missing: [], error: e.message };
            }
            results[url] = entry;
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
