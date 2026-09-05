// The persistence contract for per-candidate run results (keyword scores, AI
// evaluations). Pure — no chrome.* / DOM — so the invariant below is unit-tested.
//
// THE INVARIANT: a run may cover only a SUBSET of candidates. The dashboard can
// score/evaluate just the selection ("Score selected"), just the failures
// ("Retry failed"), or just one folder's members. Persisting such a run must
// MERGE into what's already saved — writing the run's map alone would silently
// erase the results for every candidate outside the run.
//
// This bit scoring for real: startScoring resets its map to {} and the engine
// wrote `{ profileScores: <run's map> }`, so a single "Retry failed" wiped the
// scores of every candidate that had succeeded. Both engines now go through here.

/**
 * Merge a run's results over the results already stored, keyed by profile URL.
 * Entries from `incoming` win for URLs the run touched; every other stored entry
 * is preserved untouched. Tolerates `stored` being absent (first run).
 */
export function mergeIntoStored<T>(
  stored: Record<string, T> | undefined,
  incoming: Record<string, T>,
): Record<string, T> {
  return { ...(stored || {}), ...incoming };
}
