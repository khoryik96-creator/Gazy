// Classic (non-module) content script. Namespaced on `window.__gazy` since
// content scripts share one global scope per injected file list.
window.__gazy = window.__gazy || {};

window.__gazy.extractor = (() => {
  // Specific selectors are tried first. The last, broad `a[href*="/in/"]` fallback
  // is scoped to a results container (see RESULT_ROOTS) rather than the whole
  // document, so it can't scrape the nav bar, "People you may know" sidebar, the
  // signed-in user's own menu, or the footer — all of which contain /in/ links.
  const SELECTORS = [
    'a[data-anonymize="profile-name"]',
    '.search-result__info a[href*="/in/"]',
    '.reusable-search__result-container a[href*="/in/"]',
    'a[href*="/in/"]:not([href*="search"]):not([href*="school"])',
  ];

  // Containers that, when present, hold only the search results list.
  const RESULT_ROOTS = [
    '.search-results-container',
    '.reusable-search__entity-result-list',
    'main',
  ];

  let extractedURLs: string[] = [];
  let isExtracting = false;

  function resultRoot(): ParentNode {
    for (const sel of RESULT_ROOTS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return document;
  }

  function extractProfiles(): string[] {
    if (isExtracting) return extractedURLs;
    isExtracting = true;

    const root = resultRoot();
    const profileLinks: string[] = [];
    for (const sel of SELECTORS) {
      root.querySelectorAll(sel).forEach((link) => {
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
      void chrome.runtime.sendMessage({ type: 'EXTRACTION_ERROR', data: 'No profiles found. Try refreshing or scrolling manually.' });
    } else {
      void chrome.runtime.sendMessage({ type: 'PROFILES_FOUND', data: extractedURLs });
    }

    isExtracting = false;
    return extractedURLs;
  }

  function getExtractedURLs(): string[] {
    return extractedURLs;
  }

  return { extractProfiles, getExtractedURLs };
})();
