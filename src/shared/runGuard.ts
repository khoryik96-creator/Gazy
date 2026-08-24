// Guards against accidentally kicking off an expensive run over a large set.
// Scoring visits every profile in the background (time + LinkedIn footprint);
// AI evaluation sends one request per profile (API credits). These pure helpers
// decide when a run is "large" and produce the warning text the UIs put in their
// confirm() dialogs. No chrome.* / DOM here so the Node tests can cover them.

/** Runs above this many candidates get an explicit heads-up before starting. */
export const LARGE_RUN_THRESHOLD = 25;

/** Rough per-profile seconds for a background scoring run (scrape + paced gap). */
const AVG_SCORE_SECONDS = 8;

export function isLargeRun(count: number): boolean {
  return count > LARGE_RUN_THRESHOLD;
}

/** Rough wall-clock minutes to score `count` profiles (min 1). */
export function estimateScoreMinutes(count: number): number {
  return Math.max(1, Math.round((count * AVG_SCORE_SECONDS) / 60));
}

/**
 * A warning line to prepend to a confirm() for a large run, or '' when the set
 * is small enough not to bother the user. `kind` picks the cost being flagged.
 */
export function largeRunWarning(count: number, kind: 'score' | 'ai'): string {
  if (!isLargeRun(count)) return '';
  if (kind === 'score') {
    return (
      '⚠️ Scoring ' +
      count +
      ' candidates visits each LinkedIn profile in the background (~' +
      estimateScoreMinutes(count) +
      ' min) and is a heavier footprint on your account.\n\n'
    );
  }
  return (
    '⚠️ Evaluating ' +
    count +
    ' candidates sends that many requests to DeepSeek and uses your API credits.\n\n'
  );
}
