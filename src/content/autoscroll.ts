window.__gazy = window.__gazy || {};

window.__gazy.autoscroll = (() => {
  const SCROLL_COUNT = 10;
  const SCROLL_DELAY = 1500;

  function createStatusBanner(): HTMLDivElement {
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

  function dismiss(el: HTMLElement): void {
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  /** Auto-scrolls the results page to trigger LinkedIn's lazy loading, then extracts. */
  function run(extractProfiles: () => string[]): void {
    let scrollCount = 0;
    const statusEl = createStatusBanner();

    const scrollInterval = setInterval(() => {
      scrollCount++;
      const progress = Math.min(Math.round((scrollCount / SCROLL_COUNT) * 100), 100);
      statusEl.textContent = '🔄 Loading profiles... ' + progress + '%';
      window.scrollBy(0, 500);

      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY + window.innerHeight;
      if (scrollTop >= scrollHeight - 100 || scrollCount >= SCROLL_COUNT) {
        clearInterval(scrollInterval);
        statusEl.textContent = '✅ Extracting profiles...';
        setTimeout(() => {
          const urls = extractProfiles();
          statusEl.textContent = '✅ Found ' + urls.length + ' profiles!';
          dismiss(statusEl);
        }, 500);
      }
    }, SCROLL_DELAY);

    setTimeout(
      () => {
        if (window.__gazy.extractor!.getExtractedURLs().length === 0) {
          clearInterval(scrollInterval);
          const urls = extractProfiles();
          statusEl.textContent = '⚠️ Found ' + urls.length + ' profiles (partial)';
          dismiss(statusEl);
        }
      },
      SCROLL_COUNT * SCROLL_DELAY + 5000,
    );
  }

  return { run };
})();
