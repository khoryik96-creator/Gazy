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
/** Toggle a URL's shortlist membership and persist. */
export function toggleShortlist(url) {
    if (shortlisted.has(url))
        shortlisted.delete(url);
    else
        shortlisted.add(url);
    void setStorage({ shortlist: [...shortlisted] });
}
