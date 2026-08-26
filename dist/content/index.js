"use strict";
// Bootstraps the content script: triggers auto-scroll+extraction on the LinkedIn
// people-search results page, and answers on-demand extraction requests from the popup.
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
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.type === 'EXTRACT_NOW') {
        const urls = extractor ? extractor.collectProfiles() : [];
        sendResponse({ status: 'extracting', count: urls.length });
    }
    return true;
});
