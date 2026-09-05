import { MESSAGE } from '../shared/constants.js';
import { fetchProfileData } from './profileFetcher.js';
import { evaluateProfile } from './deepseek.js';
import { normalizeAiUsage, addUsage } from '../shared/aiCost.js';
import { getStorage } from '../shared/storage.js';
import { mergeIntoStored } from '../shared/resultMerge.js';
import type { AiEvalEntry, AiEvalMap, AiEvalRequest } from '../shared/types.js';

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
export function startAiEval(req: AiEvalRequest): void {
  if (running) return;
  running = true;
  stopRequested = false;
  void runAiEvalLoop(req);
}

/** Requests the in-flight AI-evaluation run stop after the current profile. */
export function stopAiEval(): void {
  stopRequested = true;
}

/**
 * Evaluates each profile with DeepSeek, sequentially. Profile text comes from
 * fetchProfileData, which serves from the 24h cache when the profile was already
 * scraped for keyword scoring — so a normal "score, then AI-evaluate" flow makes
 * no extra LinkedIn requests. Emits AI_EVAL_PROGRESS after each profile and
 * AI_EVAL_COMPLETE at the end; a per-profile failure is recorded, not fatal.
 */
async function runAiEvalLoop(req: AiEvalRequest): Promise<void> {
  // Start from any AI evals already saved, so evaluating a subset (e.g. from the
  // dashboard) merges rather than wipes the rest. Cost usage is NOT seeded here —
  // it's re-read per profile below so a mid-run reset isn't clobbered.
  const stored = await getStorage(['aiEvals']);
  const results: AiEvalMap = mergeIntoStored<AiEvalMap[string]>(stored.aiEvals, {});
  const total = req.profiles.length;
  let index = 0;

  try {
    for (const url of req.profiles) {
      if (stopRequested) break; // user hit Stop — leave what's done, bail out
      index++;
      let entry: AiEvalEntry;
      // Token cost of THIS call, applied to stored usage below; null when the
      // call failed (a failure costs nothing).
      let spent: { input: number; output: number; cached: number } | null = null;
      try {
        const data = await fetchProfileData(url);
        const result = await evaluateProfile({
          apiKey: req.apiKey,
          model: req.model,
          jd: req.jd,
          profileText: data.fullText,
        });
        entry = result.entry;
        spent = {
          input: result.inputTokens,
          output: result.outputTokens,
          cached: result.cachedTokens,
        };
      } catch (e) {
        entry = { score: 0, reason: '', matched: [], missing: [], error: (e as Error).message };
      }
      results[url] = entry;

      // Re-read usage and add only this call's tokens, rather than writing a
      // running total seeded at the start of the run: on a long run the user may
      // hit "Reset counters" in the Cost tab, and a stale total would silently
      // undo that reset on the next profile.
      const current = await getStorage(['aiUsage']);
      const usage = spent
        ? addUsage(
            normalizeAiUsage(current.aiUsage),
            req.model,
            spent.input,
            spent.output,
            spent.cached,
          )
        : normalizeAiUsage(current.aiUsage);

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
        .catch(() => {});
    }
  } finally {
    running = false;
  }

  void chrome.runtime.sendMessage({ type: MESSAGE.AI_EVAL_COMPLETE, results }).catch(() => {});
}
