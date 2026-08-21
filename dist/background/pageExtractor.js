/**
 * Runs inside the scraped LinkedIn profile tab via chrome.scripting.executeScript.
 * Must be fully self-contained (serialized to the page, no closures over module scope).
 */
export function extractProfilePageData() {
    // Detect a genuine login / authwall — not just any element that happens to use
    // a `.login` class. The old selector matched `.login` anywhere, which can occur
    // on a normal signed-in profile page, wrongly failing real profiles. Prefer the
    // reliable signals: an auth-wall URL, or the actual password input.
    const path = window.location.pathname.toLowerCase();
    const onAuthUrl = /(?:^|\/)(?:login|authwall|checkpoint|uas)(?:\/|$)/.test(path);
    const hasPasswordField = !!document.querySelector('input[name="session_password"]');
    if (onAuthUrl || hasPasswordField) {
        return { headline: '', location: '', fullText: 'LOGIN_PAGE', error: 'login' };
    }
    const fullText = document.body?.innerText || document.documentElement?.textContent || '';
    const h1 = document.querySelector('h1');
    const headline = h1?.innerText?.trim() || '';
    let location = '';
    const locEl = document.querySelector('.pv-text-details__left-panel .text-body-small, ' +
        '.pv-top-card--list .text-body-small, ' +
        '.pv-top-card--list .t-black--light, ' +
        '[data-view-name="profile-profile"] .text-body-small, ' +
        // Newer top-card markup: the location sits in the details block, not the
        // (bold, non-inline) headline line.
        '.pv-text-details__left-panel .text-body-small:not(.inline), ' +
        '.mt2 .text-body-small.inline.t-black--light');
    if (locEl)
        location = locEl.innerText.trim();
    if (!location) {
        const topCard = document.querySelector('.pv-top-card--list');
        if (topCard) {
            const lines = topCard.innerText
                .split('\n')
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
            if (lines.length > 2) {
                const candidate = lines[lines.length - 1];
                if (candidate && !candidate.includes('connection') && candidate.length < 50)
                    location = candidate;
            }
        }
    }
    return { headline, location, fullText: fullText || document.documentElement?.textContent || '' };
}
