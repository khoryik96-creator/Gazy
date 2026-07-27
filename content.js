console.log('🔍 LinkedIn Profile Finder content script loaded');
const SCROLL_COUNT = 10;
const SCROLL_DELAY = 1500;
let extractedURLs = [];
let isExtracting = false;

function extractProfiles() {
  if (isExtracting) return;
  isExtracting = true;
  console.log('Starting profile extraction...');
  let profileLinks = [];
  const selectors = [
    'a[data-anonymize="profile-name"]',
    '.search-result__info a[href*="/in/"]',
    '.reusable-search__result-container a[href*="/in/"]',
    'a[href*="/in/"]:not([href*="search"]):not([href*="school"])'
  ];
  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.includes('/in/')) {
        const fullUrl = href.startsWith('https') ? href : 'https://www.linkedin.com' + href.split('?')[0];
        profileLinks.push(fullUrl);
      }
    });
    if (profileLinks.length > 0) break;
  }
  extractedURLs = [...new Set(profileLinks)];
  console.log('Found ' + extractedURLs.length + ' profile URLs');
  if (extractedURLs.length === 0) {
    chrome.runtime.sendMessage({ type: 'EXTRACTION_ERROR', data: 'No profiles found. Try refreshing or scrolling manually.' });
  } else {
    chrome.runtime.sendMessage({ type: 'PROFILES_FOUND', data: extractedURLs });
  }
  isExtracting = false;
  return extractedURLs;
}

function autoScrollAndExtract() {
  let scrollCount = 0;
  const statusDiv = document.createElement('div');
  statusDiv.style.cssText = 'position:fixed;top:20px;right:20px;background:#0a66c2;color:white;padding:12px 20px;border-radius:8px;font-family:-apple-system,sans-serif;font-size:14px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;gap:12px;opacity:0;transition:opacity 0.3s;';
  statusDiv.textContent = '🔄 Loading profiles... 0%';
  document.body.appendChild(statusDiv);
  setTimeout(() => statusDiv.style.opacity = '1', 100);

  const scrollInterval = setInterval(() => {
    scrollCount++;
    const progress = Math.min(Math.round((scrollCount / SCROLL_COUNT) * 100), 100);
    statusDiv.textContent = '🔄 Loading profiles... ' + progress + '%';
    window.scrollBy(0, 500);
    const scrollHeight = document.documentElement.scrollHeight;
    const scrollTop = window.scrollY + window.innerHeight;
    if (scrollTop >= scrollHeight - 100 || scrollCount >= SCROLL_COUNT) {
      clearInterval(scrollInterval);
      statusDiv.textContent = '✅ Extracting profiles...';
      setTimeout(() => {
        extractProfiles();
        statusDiv.textContent = '✅ Found ' + extractedURLs.length + ' profiles!';
        setTimeout(() => { statusDiv.style.opacity = '0'; setTimeout(() => statusDiv.remove(), 300); }, 3000);
      }, 500);
    }
  }, SCROLL_DELAY);

  setTimeout(() => {
    if (extractedURLs.length === 0) {
      clearInterval(scrollInterval);
      extractProfiles();
      statusDiv.textContent = '⚠️ Found ' + extractedURLs.length + ' profiles (partial)';
      setTimeout(() => { statusDiv.style.opacity = '0'; setTimeout(() => statusDiv.remove(), 300); }, 3000);
    }
  }, SCROLL_COUNT * SCROLL_DELAY + 5000);
}

if (window.location.href.includes('linkedin.com/search/results/people')) {
  if (document.readyState === 'complete') setTimeout(autoScrollAndExtract, 2000);
  else window.addEventListener('load', () => setTimeout(autoScrollAndExtract, 2000));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'EXTRACT_NOW') {
    extractProfiles();
    sendResponse({ status: 'extracting', count: extractedURLs.length });
  }
  return true;
});
console.log('✅ LinkedIn Profile Finder ready!');
