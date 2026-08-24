import { MESSAGE, PAGE_NAV_DELAY_MIN_MS, PAGE_NAV_DELAY_MAX_MS } from '../shared/constants.js';
import { buildSearchUrl, mergeProfiles, shouldContinuePaging, clampScanPages, } from '../shared/pagination.js';
import { randomDelayMs, sleep } from '../shared/timing.js';
let session = null;
/** Begins a search: records the session and navigates the active tab to page 1. */
export async function startSearch(req) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id)
        throw new Error('No active tab found.');
    session = {
        tabId: tab.id,
        query: req.query,
        maxPages: clampScanPages(req.maxPages),
        page: 1,
        collected: [],
        done: false,
    };
    await chrome.tabs.update(tab.id, { url: buildSearchUrl(req.query, 1) });
}
/**
 * Handles one page's extracted URLs. With no active session for the reporting
 * tab (e.g. the user browsed to a search manually), this falls back to the old
 * single-page behaviour. Otherwise it accumulates and drives pagination.
 */
export async function handlePageExtracted(urls, tabId) {
    const list = Array.isArray(urls) ? urls : [];
    if (!session || session.done || tabId !== session.tabId) {
        if (list.length > 0)
            send({ type: MESSAGE.PROFILES_FOUND, data: list });
        else
            send({
                type: MESSAGE.EXTRACTION_ERROR,
                data: 'No profiles found. Try refreshing or scrolling manually.',
            });
        return;
    }
    const { merged, added } = mergeProfiles(session.collected, list);
    session.collected = merged;
    send({
        type: MESSAGE.SEARCH_PROGRESS,
        page: session.page,
        maxPages: session.maxPages,
        total: merged.length,
    });
    if (shouldContinuePaging(session.page, session.maxPages, added)) {
        session.page++;
        await sleep(randomDelayMs(PAGE_NAV_DELAY_MIN_MS, PAGE_NAV_DELAY_MAX_MS));
        // A new search (or a manual navigation) may have replaced/ended the session
        // while we were waiting — don't navigate a stale one.
        if (!session || session.done || session.tabId !== tabId)
            return;
        await chrome.tabs.update(session.tabId, { url: buildSearchUrl(session.query, session.page) });
        return;
    }
    // Done: persist the union and hand the final list to the popup.
    session.done = true;
    const final = session.collected;
    await chrome.storage.local.set({ profiles: final });
    if (final.length > 0)
        send({ type: MESSAGE.PROFILES_FOUND, data: final });
    else
        send({ type: MESSAGE.EXTRACTION_ERROR, data: 'No profiles found. Try a different search.' });
    session = null;
}
function send(message) {
    void chrome.runtime.sendMessage(message).catch(() => { });
}
