// ===== BACKGROUND SCORING ENGINE =====
console.log('✅ Background service worker loaded');

const RETRY_COUNT = 3;
const MIN_TEXT_LENGTH = 50;
const PROFILE_TIMEOUT_MS = 60000;
const SCORING_DELAY_MS = 3000;
const BATCH_SIZE = 3;
const CACHE_EXPIRY_MS = 86400000;

let scoringState = {
  isRunning: false,
  profiles: [],
  scores: {},
  currentIndex: 0,
  failedCount: 0,
  keywords: [],
  booleanRule: '',
  countryFilter: '',
  stopRequested: false,
  startTime: 0,
};

const profileCache = new Map();

const STOP_WORDS = [
  'the','be','to','of','and','a','in','that','have','i','it','for','not',
  'on','with','he','as','you','do','at','this','but','his','by','from',
  'they','we','say','her','she','or','an','will','my','one','all','would',
  'there','their','what','so','up','out','if','about','who','get','which',
  'go','me','when','make','can','like','time','no','just','him','know',
  'take','people','into','year','your','good','some','could','them','see',
  'other','than','then','now','look','only','come','its','over','think',
  'also','back','after','use','two','how','our','work','first','well','way',
  'even','new','want','because','any','these','give','day','most','us'
];

function filterStopwords(words) {
  return words.filter(w => w.length > 2 && !STOP_WORDS.includes(w) && !/^\d+$/.test(w));
}

function extractKeywordsFromJD(jd) {
  const words = jd.toLowerCase().replace(/[^a-zA-Z0-9\s#+]/g, ' ').split(/\s+/);
  const wordScores = {};
  words.forEach(w => { if (w.length>2 && !STOP_WORDS.includes(w) && !/^\d+$/.test(w)) wordScores[w] = (wordScores[w]||0)+1; });
  const sorted = Object.entries(wordScores).sort((a,b)=>b[1]-a[1]).slice(0,8).map(e=>e[0]);
  const phrases = [];
  const jdWords = jd.toLowerCase().split(/\s+/);
  for (let i=0; i<jdWords.length-2; i++) {
    const phrase = jdWords.slice(i,i+3).join(' ');
    if (phrase.length>5 && !STOP_WORDS.includes(jdWords[i]) && !STOP_WORDS.includes(jdWords[i+1])) phrases.push(phrase);
  }
  const all = [...sorted, ...phrases];
  return [...new Set(all)].slice(0,10).join(' ');
}

function extractKeywordsFromBoolean(rule) {
  if (!rule) return [];
  const matches = rule.match(/(["'])([^"']*)\1/g);
  if (!matches) return [];
  return matches.map(m => m.slice(1, -1).trim()).filter(k => k.length > 0);
}

function getScoringKeywords(manual, booleanRule, jd) {
  let manualKW = manual?.trim() || '';
  if (manualKW) {
    const words = manualKW.split(/\s+/);
    return filterStopwords(words);
  }
  let boolKws = extractKeywordsFromBoolean(booleanRule || '');
  if (boolKws.length > 0) return boolKws;
  if (jd?.trim()) {
    let fromJD = extractKeywordsFromJD(jd);
    return fromJD.split(/\s+/).filter(k => k.length > 2);
  }
  return [];
}

function evaluateBoolean(profileText, rule) {
  if (!rule || !rule.trim()) return true;
  const sanitized = rule.replace(/[^a-zA-Z0-9\s'"()&|!]/g, '');
  const text = profileText.toLowerCase();
  let expr = sanitized.replace(/AND/g, '&&').replace(/OR/g, '||').replace(/NOT/g, '!');
  try {
    const fn = new Function(
      'text',
      'return !!(' + expr.replace(/"([^"]*)"/g, (m, p1) => 'text.includes("' + p1.toLowerCase() + '")') + ');'
    );
    return fn(text);
  } catch (e) {
    console.warn('Boolean syntax error:', e);
    throw new Error('Invalid Boolean rule syntax.');
  }
}

function computeScore(profileData, scoringKeywords, booleanRule, countryFilter) {
  if (!profileData) return 0;
  const text = profileData.fullText.toLowerCase();

  if (booleanRule && booleanRule.trim()) {
    try { if (!evaluateBoolean(text, booleanRule)) return 0; } catch (e) { throw e; }
  }

  if (countryFilter && countryFilter.trim()) {
    const loc = (profileData.location || '').toLowerCase();
    if (!loc.includes(countryFilter.toLowerCase().trim())) return 0;
  }

  let keywordScore = 0;
  const uniqueKeywords = [...new Set(scoringKeywords)];
  if (uniqueKeywords.length > 0) {
    let matchCount = 0;
    uniqueKeywords.forEach(kw => {
      const regex = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      const matches = text.match(regex);
      if (matches) matchCount += matches.length;
    });
    const maxPossible = uniqueKeywords.length * 3;
    keywordScore = Math.min(100, (matchCount / maxPossible) * 100);
  }

  let titleScore = 0;
  if (uniqueKeywords.length > 0 && profileData.headline) {
    const titleWords = uniqueKeywords.filter(k => k.length > 3);
    const headlineLower = profileData.headline.toLowerCase();
    titleWords.forEach(kw => {
      if (headlineLower.includes(kw)) titleScore += 10;
    });
    titleScore = Math.min(30, titleScore);
  }

  let expScore = 0;
  const expMatches = text.match(/\b(\d+)\s*(?:years?|yrs?)\b/gi);
  if (expMatches) {
    const years = expMatches.map(m => parseInt(m.match(/\d+/)[0], 10)).filter(y => y > 0 && y < 60);
    if (years.length > 0) {
      const avg = years.reduce((a, b) => a + b, 0) / years.length;
      if (avg >= 3 && avg <= 10) expScore = 20;
      else if (avg > 10) expScore = 15;
      else if (avg >= 1) expScore = 10;
    }
  }

  let finalScore = Math.round(Math.min(100, keywordScore * 0.6 + titleScore + expScore));
  if (isNaN(finalScore)) finalScore = 0;
  return finalScore;
}

function fetchProfileData(url, retryCount = 0) {
  return new Promise((resolve, reject) => {
    const cached = profileCache.get(url);
    if (cached && (Date.now() - cached.timestamp < CACHE_EXPIRY_MS)) {
      console.log('Cache hit for', url);
      resolve(cached.data);
      return;
    }

    chrome.tabs.create({ url, active: false }, (tab) => {
      if (!tab.id) {
        reject(new Error('Failed to create tab'));
        return;
      }

      let listener;
      let timeoutId;
      let resolved = false;

      const cleanup = () => {
        if (listener) chrome.tabs.onUpdated.removeListener(listener);
        if (timeoutId) clearTimeout(timeoutId);
        chrome.tabs.remove(tab.id, () => {
          if (chrome.runtime.lastError) {}
        });
      };

      const executeAndResolve = () => {
        if (resolved) return;
        resolved = true;
        cleanup();

        setTimeout(() => {
          chrome.scripting.executeScript(
            {
              target: { tabId: tab.id },
              func: () => {
                const loginForm = document.querySelector('form[action*="login"], .login-page, .login, input[name="session_password"], .login-form');
                if (loginForm) return { headline: '', location: '', fullText: 'LOGIN_PAGE', error: 'login' };
                const fullText = document.body?.innerText || document.documentElement?.textContent || '';
                const h1 = document.querySelector('h1');
                const headline = h1?.innerText?.trim() || '';
                let location = '';
                const locEl = document.querySelector(
                  '.pv-text-details__left-panel .text-body-small, ' +
                  '.pv-top-card--list .text-body-small, ' +
                  '.pv-top-card--list .t-black--light, ' +
                  '[data-view-name="profile-profile"] .text-body-small'
                );
                if (locEl) location = locEl.innerText.trim();
                if (!location) {
                  const topCard = document.querySelector('.pv-top-card--list');
                  if (topCard) {
                    const lines = topCard.innerText.split('\n').map(s => s.trim()).filter(s => s.length > 0);
                    if (lines.length > 2) {
                      const candidate = lines[lines.length - 1];
                      if (candidate && !candidate.includes('connection') && candidate.length < 50) location = candidate;
                    }
                  }
                }
                return { headline, location, fullText: fullText || document.documentElement?.textContent || '' };
              }
            },
            (results) => {
              cleanup();
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
              }
              if (results && results[0] && results[0].result) {
                const data = results[0].result;
                if (data.error === 'login') {
                  reject(new Error('LinkedIn login page detected. Please ensure you are logged in.'));
                  return;
                }
                if (data.fullText.length < MIN_TEXT_LENGTH && retryCount < RETRY_COUNT) {
                  console.warn('Short text (' + data.fullText.length + ' chars), retrying...');
                  setTimeout(() => {
                    fetchProfileData(url, retryCount + 1).then(resolve).catch(reject);
                  }, 3000);
                  return;
                }
                profileCache.set(url, { data, timestamp: Date.now() });
                resolve(data);
              } else {
                reject(new Error('No data extracted'));
              }
            }
          );
        }, 2000);
      };

      if (tab.status === 'complete') {
        executeAndResolve();
      } else {
        listener = (tabId, info) => {
          if (tabId === tab.id && info.status === 'complete') executeAndResolve();
        };
        chrome.tabs.onUpdated.addListener(listener);
      }

      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(new Error('Profile load timed out after 60 seconds.'));
        }
      }, PROFILE_TIMEOUT_MS);
    });
  });
}

async function processBatch(batch, keywords, booleanRule, countryFilter) {
  const promises = batch.map(async (url) => {
    try {
      const data = await fetchProfileData(url);
      const score = computeScore(data, keywords, booleanRule, countryFilter);
      return { url, score, debug: data.fullText.slice(0, 200), success: true };
    } catch (e) {
      console.warn('Failed to score:', url, e.message);
      return { url, score: 0, debug: 'ERROR: ' + e.message, success: false };
    }
  });
  return await Promise.all(promises);
}

async function startScoring(data) {
  if (scoringState.isRunning) return;

  scoringState.isRunning = true;
  scoringState.profiles = data.profiles;
  scoringState.scores = {};
  scoringState.currentIndex = 0;
  scoringState.failedCount = 0;
  scoringState.keywords = data.keywords;
  scoringState.booleanRule = data.booleanRule;
  scoringState.countryFilter = data.countryFilter;
  scoringState.stopRequested = false;
  scoringState.startTime = Date.now();

  console.log('Scoring started for', scoringState.profiles.length, 'profiles');
  chrome.runtime.sendMessage({ type: 'SCORING_STARTED', total: scoringState.profiles.length });

  let completed = 0;
  const total = scoringState.profiles.length;

  while (completed < total && !scoringState.stopRequested) {
    const batch = scoringState.profiles.slice(completed, completed + BATCH_SIZE);
    const results = await processBatch(
      batch,
      scoringState.keywords,
      scoringState.booleanRule,
      scoringState.countryFilter
    );

    for (const result of results) {
      scoringState.scores[result.url] = result.score;
      scoringState.scores[result.url + '_debug'] = result.debug;
      if (!result.success) scoringState.failedCount++;
    }

    completed += batch.length;
    scoringState.currentIndex = completed;

    const elapsed = Date.now() - scoringState.startTime;
    const avgTimePerProfile = elapsed / completed;
    const remaining = total - completed;
    const eta = avgTimePerProfile * remaining;
    const etaStr = eta > 60000 ? Math.round(eta / 60000) + 'm' : Math.round(eta / 1000) + 's';

    chrome.runtime.sendMessage({
      type: 'SCORING_PROGRESS',
      currentIndex: completed,
      total,
      scores: scoringState.scores,
      failedCount: scoringState.failedCount,
      eta: etaStr,
      progress: Math.round((completed / total) * 100),
    });

    if (completed < total && !scoringState.stopRequested) {
      await new Promise(r => setTimeout(r, SCORING_DELAY_MS));
    }
  }

  scoringState.isRunning = false;
  console.log('Scoring complete.');
  chrome.runtime.sendMessage({
    type: 'SCORING_COMPLETE',
    scores: scoringState.scores,
    failedCount: scoringState.failedCount,
  });
}

function stopScoring() {
  scoringState.stopRequested = true;
}

function clearCache() {
  profileCache.clear();
  chrome.storage.local.remove(['profileScores', 'scoringProgress']);
  console.log('Cache cleared.');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_SCORING') {
    startScoring(message.data).then(() => {
      sendResponse({ status: 'started' });
    }).catch((err) => {
      sendResponse({ status: 'error', error: err.message });
    });
    return true;
  }
  if (message.type === 'STOP_SCORING') {
    stopScoring();
    sendResponse({ status: 'stopped' });
    return false;
  }
  if (message.type === 'GET_SCORING_STATUS') {
    sendResponse({
      isRunning: scoringState.isRunning,
      currentIndex: scoringState.currentIndex,
      total: scoringState.profiles.length,
      scores: scoringState.scores,
      failedCount: scoringState.failedCount,
    });
    return false;
  }
  if (message.type === 'PROFILES_FOUND') {
    chrome.runtime.sendMessage(message);
    sendResponse({ status: 'ok' });
    return false;
  }
  if (message.type === 'CLEAR_CACHE') {
    clearCache();
    sendResponse({ status: 'ok' });
    return false;
  }
  return false;
});

console.log('✅ Background ready');
