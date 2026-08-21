"use strict";
window.__gazy = window.__gazy || {};
window.__gazy.autoscroll = (() => {
    const SCROLL_COUNT = 10;
    const SCROLL_DELAY = 1500;
    function createStatusBanner() {
        const el = document.createElement('div');
        el.style.cssText =
            'position:fixed;top:20px;right:20px;background:#0a66c2;color:white;' +
                'padding:12px 20px;border-radius:8px;font-family:-apple-system,sans-serif;font-size:14px;' +
                'z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;gap:12px;' +
                'opacity:0;transition:opacity 0.3s;';
        el.textContent = '🔄 Loading profiles... 0%';
        document.body.appendChild(el);
        setTimeout(() => {
            el.style.opacity = '1';
        }, 100);
        return el;
    }
    function dismiss(el) {
        setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 300);
        }, 3000);
    }
    /** Auto-scrolls the results page to trigger LinkedIn's lazy loading, then extracts. */
    function run(extractProfiles) {
        let scrollCount = 0;
        let extracted = false;
        const statusEl = createStatusBanner();
        // The fallback timer is a safety net for when scrolling never "completes".
        // Once the scroll loop finishes and extracts, cancel it — otherwise it fires
        // too and extracts a second time (a duplicate EXTRACTION_ERROR when the search
        // genuinely returned no results).
        let fallbackTimer;
        const scrollInterval = setInterval(() => {
            scrollCount++;
            const progress = Math.min(Math.round((scrollCount / SCROLL_COUNT) * 100), 100);
            statusEl.textContent = '🔄 Loading profiles... ' + progress + '%';
            window.scrollBy(0, 500);
            const scrollHeight = document.documentElement.scrollHeight;
            const scrollTop = window.scrollY + window.innerHeight;
            if (scrollTop >= scrollHeight - 100 || scrollCount >= SCROLL_COUNT) {
                clearInterval(scrollInterval);
                clearTimeout(fallbackTimer);
                statusEl.textContent = '✅ Extracting profiles...';
                setTimeout(() => {
                    if (extracted)
                        return;
                    extracted = true;
                    const urls = extractProfiles();
                    statusEl.textContent = '✅ Found ' + urls.length + ' profiles!';
                    dismiss(statusEl);
                }, 500);
            }
        }, SCROLL_DELAY);
        fallbackTimer = setTimeout(() => {
            if (extracted)
                return;
            extracted = true;
            clearInterval(scrollInterval);
            const urls = extractProfiles();
            statusEl.textContent = '⚠️ Found ' + urls.length + ' profiles (partial)';
            dismiss(statusEl);
        }, SCROLL_COUNT * SCROLL_DELAY + 5000);
    }
    return { run };
})();
