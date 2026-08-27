// Pure helpers to summarise how a scoring / AI-evaluation run went, so the
// dashboard can show "N scored · M failed" instead of a bare "complete". No
// chrome.* / DOM — unit-tested directly.

import type { AiEvalMap } from './types.js';

export interface RunOutcome {
  ok: number;
  failed: number;
  total: number;
}

/**
 * Scoring outcome from the run size and the engine's failed count. `ok` is the
 * remainder (successfully scraped + scored). Clamped so a stale/oversized
 * failedCount can't produce a negative ok.
 */
export function scoreOutcome(total: number, failed: number): RunOutcome {
  const f = Math.max(0, Math.min(failed, total));
  return { ok: total - f, failed: f, total };
}

/**
 * AI-evaluation outcome over the run's target URLs, read from the eval map:
 * an entry with `error` set is a failure; an entry without is a success;
 * a URL with no entry at all is neither (skipped/stopped) and not counted.
 */
export function aiOutcome(urls: string[], evals: AiEvalMap): RunOutcome {
  let ok = 0;
  let failed = 0;
  for (const u of urls) {
    const e = evals[u];
    if (!e) continue;
    if (e.error) failed++;
    else ok++;
  }
  return { ok, failed, total: ok + failed };
}

/**
 * A short status line for a finished run, e.g. "⭐ Scored 40 · ⚠️ 3 failed" or
 * "✦ Evaluated 12" when nothing failed. `verb` is the past-tense action word.
 */
export function outcomeLabel(icon: string, verb: string, o: RunOutcome): string {
  const base = icon + ' ' + verb + ' ' + o.ok;
  return o.failed > 0 ? base + ' · ⚠️ ' + o.failed + ' failed' : base;
}
