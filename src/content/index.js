// Bootstraps the content script: triggers auto-scroll+extraction on the LinkedIn
// people-search results page, and answers on-demand extraction requests from the popup.
console.log('🔍 LinkedIn Profile Finder content script loaded');

const { extractor, autoscroll } = window.__gazy;

if (window.location.href.includes('linkedin.com/search/results/people')) {
  const start = () => setTimeout(() => autoscroll.run(extractor.extractProfiles), 2000);
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'EXTRACT_NOW') {
    const urls = extractor.extractProfiles();
    sendResponse({ status: 'extracting', count: urls.length });
  }
  return true;
});

console.log('✅ LinkedIn Profile Finder ready!');
