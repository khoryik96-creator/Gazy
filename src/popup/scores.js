/**
 * Reads one profile's score data out of the `profileScores` map in a
 * format-tolerant way.
 *
 * The current shape is a structured entry: `{ score, location, debug, success }`.
 * Older persisted runs (and the pre-refactor engine) used a flat map where
 * `scores[url]` was the number and `scores[url + '_debug']` held the debug text.
 * Normalising here means `render.js` / `csvExport.js` never branch on format,
 * and a stale `chrome.storage.local` entry from a previous version still renders
 * instead of throwing.
 *
 * Returns `null` when the URL hasn't been scored yet.
 */
export function scoreEntry(scores, url) {
  const value = scores?.[url];
  if (value === undefined || value === null) return null;

  if (typeof value === 'object') {
    return {
      score: value.score,
      location: value.location || '',
      debug: value.debug || '',
      success: value.success !== false,
    };
  }

  // Legacy flat format: value is the raw score number.
  return {
    score: value,
    location: '',
    debug: scores[url + '_debug'] || '',
    success: true,
  };
}
