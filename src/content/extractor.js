// Classic (non-module) content script. Namespaced on `window.__gazy` since
// content scripts share one global scope per injected file list.
window.__gazy = window.__gazy || {};

window.__gazy.extractor = (() => {
  const SELECTORS = [
    'a[data-anonymize="profile-name"]',
    '.search-result__info a[href*="/in/"]',
    '.reusable-search__result-container a[href*="/in/"]',
    'a[href*="/in/"]:not([href*="search"]):not([href*="school"])',
  ];

  let extractedURLs = [];
  let isExtracting = false;

  function extractProfiles() {
    if (isExtracting) return extractedURLs;
    isExtracting = true;

    let profileLinks = [];
    for (const sel of SELECTORS) {
      document.querySelectorAll(sel).forEach((link) => {
        const href = link.getAttribute('href');
        if (href && href.includes('/in/')) {
          const fullUrl = href.startsWith('https') ? href : 'https://www.linkedin.com' + href.split('?')[0];
          profileLinks.push(fullUrl);
        }
      });
      if (profileLinks.length > 0) break;
    }

    extractedURLs = [...new Set(profileLinks)];

    if (extractedURLs.length === 0) {
      chrome.runtime.sendMessage({ type: 'EXTRACTION_ERROR', data: 'No profiles found. Try refreshing or scrolling manually.' });
    } else {
      chrome.runtime.sendMessage({ type: 'PROFILES_FOUND', data: extractedURLs });
    }

    isExtracting = false;
    return extractedURLs;
  }

  function getExtractedURLs() {
    return extractedURLs;
  }

  return { extractProfiles, getExtractedURLs };
})();
