"use strict";
// Bootstraps the content script: on a LinkedIn people-search results page it
// auto-scrolls, scrapes the page, and reports it to the background, which owns
// accumulation across pages and what to surface to the UI (see searchSession.ts).
const { extractor, autoscroll } = window.__gazy;
// Scrape this page and report it to the background, which accumulates results
// across pages and decides what to surface to the popup (see searchSession.ts).
function reportPage() {
    const urls = extractor ? extractor.collectProfiles() : [];
    // Attach page signals so the background can explain an empty page (logged out
    // / layout changed / genuinely no results) instead of a generic message.
    const signals = extractor ? extractor.pageSignals() : undefined;
    void chrome.runtime.sendMessage({ type: 'PAGE_EXTRACTED', data: urls, signals });
    return urls;
}
if (window.location.href.includes('linkedin.com/search/results/people') &&
    extractor &&
    autoscroll) {
    const start = () => setTimeout(() => autoscroll.run(reportPage), 2000);
    if (document.readyState === 'complete')
        start();
    else
        window.addEventListener('load', start);
}
// (An EXTRACT_NOW on-demand handler used to live here. It became inert when the
// content script stopped emitting results itself — it scraped but reported
// nothing — and no caller remained, so it was removed rather than left as a
// silent no-op. Page scraping now flows only through reportPage above.)
