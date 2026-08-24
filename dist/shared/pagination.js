// Pure helpers for multi-page result scanning. No chrome.* / DOM here so the
// background session logic and the Node tests can both use them. The background
// session (background/searchSession.ts) owns the stateful navigation; this
// module owns the decisions: which URL a page lives at, how a page's results
// merge into the running set, and when to stop.
import { DEFAULT_SCAN_PAGES, MAX_SCAN_PAGES } from './constants.js';
export const PEOPLE_SEARCH_BASE = 'https://www.linkedin.com/search/results/people/';
/** Clamps a requested page count into [1, MAX_SCAN_PAGES]; junk → the default. */
export function clampScanPages(n) {
    const num = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : NaN;
    if (Number.isNaN(num))
        return DEFAULT_SCAN_PAGES;
    return Math.min(Math.max(num, 1), MAX_SCAN_PAGES);
}
/**
 * The people-search URL for a given page. Page 1 omits the `page` param so it
 * matches the URL the user would land on manually; later pages append `&page=N`.
 */
export function buildSearchUrl(query, page) {
    const base = PEOPLE_SEARCH_BASE + '?keywords=' + encodeURIComponent(query);
    return page <= 1 ? base : base + '&page=' + page;
}
/** Unions `incoming` into `existing` preserving order; reports how many were new. */
export function mergeProfiles(existing, incoming) {
    const seen = new Set(existing);
    const merged = existing.slice();
    let added = 0;
    for (const url of incoming) {
        if (!seen.has(url)) {
            seen.add(url);
            merged.push(url);
            added++;
        }
    }
    return { merged, added };
}
/**
 * Whether to fetch another page. Stop at the page cap, or as soon as a page
 * contributes nothing new — that means we've hit the last page (LinkedIn repeats
 * the final page's results when you page past the end) or are only seeing dupes.
 */
export function shouldContinuePaging(page, maxPages, addedThisPage) {
    return page < maxPages && addedThisPage > 0;
}
