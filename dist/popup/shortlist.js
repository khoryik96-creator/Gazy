import { getStorage, setStorage } from './storage.js';
/**
 * The saved shortlist of candidate profile URLs. Persisted in
 * chrome.storage.local under `shortlist` so it survives across sessions and is
 * independent of the current search results (starred URLs stay saved even after
 * Clear or a new search). Kept as a module-private Set for O(1) membership; the
 * stored form is a plain string[].
 */
const shortlisted = new Set();
export function isShortlisted(url) {
    return shortlisted.has(url);
}
export function shortlistCount() {
    return shortlisted.size;
}
/** Load the persisted shortlist into memory. Call once before the first render. */
export async function loadShortlist() {
    const { shortlist } = (await getStorage(['shortlist']));
    shortlisted.clear();
    (shortlist || []).forEach((u) => shortlisted.add(u));
}
/**
 * Toggle a URL's shortlist membership and persist.
 *
 * The in-memory Set is updated immediately so the caller can re-render at once,
 * but the WRITE re-reads storage first and applies only this URL's change. The
 * popup loads the shortlist when it opens and never re-syncs, so the dashboard
 * (or another popup) may have starred/unstarred other candidates since — writing
 * our whole stale snapshot would silently revert those.
 */
export function toggleShortlist(url) {
    const turningOn = !shortlisted.has(url);
    if (turningOn)
        shortlisted.add(url);
    else
        shortlisted.delete(url);
    void persistToggle(url, turningOn);
}
async function persistToggle(url, on) {
    const { shortlist } = (await getStorage(['shortlist']));
    const current = new Set(shortlist || []);
    if (on)
        current.add(url);
    else
        current.delete(url);
    await setStorage({ shortlist: [...current] });
}
