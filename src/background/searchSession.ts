import { MESSAGE, PAGE_NAV_DELAY_MIN_MS, PAGE_NAV_DELAY_MAX_MS } from '../shared/constants.js';
import {
  buildSearchUrl,
  mergeProfiles,
  shouldContinuePaging,
  clampScanPages,
} from '../shared/pagination.js';
import { randomDelayMs, sleep } from '../shared/timing.js';
import { diagnoseEmptyPage } from '../shared/pageDiagnostics.js';
import type { PageSignals } from '../shared/pageDiagnostics.js';

// Drives a multi-page search from the background. The popup asks for a query and
// a page count; we navigate the active tab through the paginated result URLs one
// page at a time. Each page load makes the content script send PAGE_EXTRACTED
// with that page's profile URLs; we accumulate the union, report progress, and
// either advance to the next page (after a randomised pause) or finish.
//
// Keeping the loop here — rather than clicking "Next" inside the page — means we
// rely on LinkedIn's stable `&page=N` URL contract instead of fragile DOM
// buttons, and state survives the content script reloading on each navigation.

interface SearchSession {
  tabId: number;
  query: string;
  maxPages: number;
  page: number;
  collected: string[];
  done: boolean;
}

let session: SearchSession | null = null;

interface SearchRequest {
  query: string;
  maxPages?: number;
  /** Open a fresh tab for the search instead of navigating the active one. The
   *  dashboard sets this so a search launched from the dashboard tab doesn't
   *  navigate the dashboard away. */
  newTab?: boolean;
}

/**
 * Begins a search: records the session and loads page 1. From the popup we
 * navigate the active tab; from the dashboard (newTab) we open a dedicated tab
 * so the dashboard itself isn't navigated away.
 */
export async function startSearch(req: SearchRequest): Promise<void> {
  const url = buildSearchUrl(req.query, 1);
  let tabId: number;

  if (req.newTab) {
    const tab = await chrome.tabs.create({ url, active: true });
    if (!tab.id) throw new Error('Could not open a search tab.');
    tabId = tab.id;
  } else {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id) throw new Error('No active tab found.');
    tabId = tab.id;
    await chrome.tabs.update(tabId, { url });
  }

  session = {
    tabId,
    query: req.query,
    maxPages: clampScanPages(req.maxPages),
    page: 1,
    collected: [],
    done: false,
  };
}

/**
 * Handles one page's extracted URLs. With no active session for the reporting
 * tab (e.g. the user browsed to a search manually), this falls back to the old
 * single-page behaviour. Otherwise it accumulates and drives pagination.
 */
export async function handlePageExtracted(
  urls: unknown,
  tabId?: number,
  signals?: unknown,
): Promise<void> {
  const list = Array.isArray(urls) ? (urls as string[]) : [];

  if (!session || session.done || tabId !== session.tabId) {
    if (list.length > 0) send({ type: MESSAGE.PROFILES_FOUND, data: list });
    else send({ type: MESSAGE.EXTRACTION_ERROR, data: emptyMessage(signals, list.length) });
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
    if (!session || session.done || session.tabId !== tabId) return;
    await chrome.tabs.update(session.tabId, { url: buildSearchUrl(session.query, session.page) });
    return;
  }

  // Done: persist the union and hand the final list to the popup.
  session.done = true;
  const final = session.collected;
  await chrome.storage.local.set({ profiles: final });
  if (final.length > 0) send({ type: MESSAGE.PROFILES_FOUND, data: final });
  else send({ type: MESSAGE.EXTRACTION_ERROR, data: emptyMessage(signals, final.length) });
  session = null;
}

// Coerce the (untrusted) signals object from the content script into PageSignals
// with safe defaults, then explain the empty page. `matched` is forced to the
// authoritative count the background actually has, so a stale/garbage signal
// can't claim results exist when none were collected.
function emptyMessage(signals: unknown, matched: number): string {
  const s = (signals ?? {}) as Partial<PageSignals>;
  return diagnoseEmptyPage({
    onSearchPage: s.onSearchPage === true,
    loginWall: s.loginWall === true,
    hasResultsContainer: s.hasResultsContainer === true,
    matched,
  });
}

function send(message: object): void {
  void chrome.runtime.sendMessage(message).catch(() => {});
}
