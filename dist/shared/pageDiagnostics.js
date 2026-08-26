// Turns a few cheap signals gathered from a LinkedIn results page into a
// user-facing explanation for WHY a page yielded no profiles. Pure (no DOM /
// chrome.*) so it's unit-tested directly and shared between the content script's
// raw signal-gathering and the background's messaging.
//
// The point is to distinguish the three very different "0 results" causes, which
// otherwise all look identical to the user:
//   • logged out       → an actionable "log in" message
//   • layout changed    → the results list isn't where Gazy expects (LinkedIn
//     redesign, or the page hadn't finished loading) — tell the user, so a real
//     genuine-empty search isn't confused with a broken scraper
//   • genuinely empty   → the search really had no matches
/**
 * Returns a message explaining an empty page, or '' when the page is NOT empty
 * (matched > 0) and no explanation is needed.
 */
export function diagnoseEmptyPage(s) {
    if (s.matched > 0)
        return '';
    if (s.loginWall) {
        return 'You appear to be logged out of LinkedIn. Log in, then run the search again.';
    }
    // On a search page with no recognisable results container, the scraper can't
    // find the list at all — most likely a LinkedIn layout change (or the page is
    // still loading). Flag it as such rather than as "no matches".
    if (s.onSearchPage && !s.hasResultsContainer) {
        return "Couldn't find LinkedIn's results list — the page may still be loading, or LinkedIn changed its layout. Refresh and try again; if it keeps happening, Gazy needs an update.";
    }
    return 'No profiles found for this search. Try broadening your keywords or location.';
}
