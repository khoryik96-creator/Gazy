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

  // Scrapes the CURRENT page's profile URLs from the DOM. No messaging here: the
  // caller (content/index.ts) reports the result to the background, which owns
  // accumulation across pages and deciding what to tell the popup. The
  // empty-vs-nonempty decision (error vs results) is the background's too.
  function collectProfiles(): string[] {
    if (isExtracting) return extractedURLs;
    isExtracting = true;

    const root = resultRoot();
    const profileLinks: string[] = [];
    for (const sel of SELECTORS) {
      root.querySelectorAll(sel).forEach((link) => {
        const href = link.getAttribute('href');
        if (href && href.includes('/in/')) {
          const fullUrl = href.startsWith('https')
            ? href
            : 'https://www.linkedin.com' + href.split('?')[0];
          profileLinks.push(fullUrl);
        }
      });
      if (profileLinks.length > 0) break;
    }

    extractedURLs = [...new Set(profileLinks)];
    isExtracting = false;
    return extractedURLs;
  }

  function getExtractedURLs(): string[] {
    return extractedURLs;
  }

  // Detects a login / auth wall: LinkedIn redirects logged-out users to
  // /login or /authwall, or renders a sign-in form on the page.
  function loginWallPresent(): boolean {
    const path = window.location.pathname;
    if (path.includes('/login') || path.includes('/authwall') || path.includes('/checkpoint')) {
      return true;
    }
    return !!document.querySelector(
      'form.login__form, form[action*="login-submit"], input[name="session_password"]',
    );
  }

  // Cheap signals about the current page, used to explain an empty result set
  // (logged out vs layout change vs genuinely no matches). See pageDiagnostics.
  function pageSignals(): GazySignals {
    return {
      onSearchPage: window.location.href.includes('linkedin.com/search/results/people'),
      loginWall: loginWallPresent(),
      hasResultsContainer: RESULT_ROOTS.some((sel) => !!document.querySelector(sel)),
      matched: extractedURLs.length,
    };
  }

  return { collectProfiles, getExtractedURLs, pageSignals };
})();
