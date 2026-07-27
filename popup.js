console.log('✅ popup.js loaded');
const jdInput = document.getElementById('jdInput');
const keywordsInput = document.getElementById('keywordsInput');
const booleanRuleInput = document.getElementById('booleanRule');
const countryFilterInput = document.getElementById('countryFilter');
const searchBtn = document.getElementById('searchBtn');
const clearBtn = document.getElementById('clearBtn');
const copyAllBtn = document.getElementById('copyAllBtn');
const scoreBtn = document.getElementById('scoreBtn');
const exportBtn = document.getElementById('exportBtn');
const resultsContainer = document.getElementById('resultsContainer');
const profileCount = document.getElementById('profileCount');
const status = document.getElementById('status');
const progressArea = document.getElementById('progressArea');
const progressBar = document.getElementById('progressBar');
const progressLabel = document.getElementById('progressLabel');
const etaLabel = document.getElementById('etaLabel');
const hideZeroCheck = document.getElementById('hideZero');
const themeToggle = document.getElementById('themeToggle');
const templateSelect = document.getElementById('templateSelect');
const saveTemplateBtn = document.getElementById('saveTemplateBtn');
const loadTemplateBtn = document.getElementById('loadTemplateBtn');
const deleteTemplateBtn = document.getElementById('deleteTemplateBtn');
const clearCacheBtn = document.getElementById('clearCacheBtn');

let extractedProfiles = [];
let isSearching = false;
let isScoring = false;

const STOP_WORDS = ['the','be','to','of','and','a','in','that','have','i','it','for','not','on','with','he','as','you','do','at','this','but','his','by','from','they','we','say','her','she','or','an','will','my','one','all','would','there','their','what','so','up','out','if','about','who','get','which','go','me','when','make','can','like','time','no','just','him','know','take','people','into','year','your','good','some','could','them','see','other','than','then','now','look','only','come','its','over','think','also','back','after','use','two','how','our','work','first','well','way','even','new','want','because','any','these','give','day','most','us'];

function filterStopwords(words) {
  return words.filter(w => w.length > 2 && !STOP_WORDS.includes(w) && !/^\d+$/.test(w));
}

function extractKeywordsFromJD(jd) {
  if (!jd) return '';
  const words = jd.toLowerCase().replace(/[^a-zA-Z0-9\s#+]/g, ' ').split(/\s+/);
  const wordScores = {};
  words.forEach(w => {
    if (w.length > 2 && !STOP_WORDS.includes(w) && !/^\d+$/.test(w)) {
      wordScores[w] = (wordScores[w] || 0) + 1;
    }
  });
  const sorted = Object.entries(wordScores).sort((a,b) => b[1] - a[1]).slice(0,8).map(e => e[0]);
  const phrases = [];
  const jdWords = jd.toLowerCase().split(/\s+/);
  for (let i = 0; i < jdWords.length - 2; i++) {
    const phrase = jdWords.slice(i, i + 3).join(' ');
    if (phrase.length > 5 && !STOP_WORDS.includes(jdWords[i]) && !STOP_WORDS.includes(jdWords[i+1])) {
      phrases.push(phrase);
    }
  }
  const all = [...sorted, ...phrases];
  return [...new Set(all)].slice(0, 10).join(' ');
}

function extractKeywordsFromBoolean(rule) {
  if (!rule) return [];
  const matches = rule.match(/(["'])([^"']*)\1/g);
  if (!matches) return [];
  return matches.map(m => m.slice(1, -1).trim()).filter(k => k.length > 0);
}

function getSearchQuery() {
  let manual = keywordsInput.value.trim();
  if (manual) return manual;
  let rule = booleanRuleInput.value.trim();
  if (rule) return rule;
  if (jdInput.value.trim()) return extractKeywordsFromJD(jdInput.value);
  return '';
}

function getScoringKeywords() {
  let manual = keywordsInput.value.trim();
  if (manual) {
    let words = manual.split(/\s+/);
    return filterStopwords(words);
  }
  let rule = booleanRuleInput.value.trim();
  if (rule) {
    let matches = rule.match(/(["'])([^"']*)\1/g);
    if (matches) return matches.map(m => m.slice(1, -1).trim()).filter(k => k.length > 0);
  }
  if (jdInput.value.trim()) {
    let fromJD = extractKeywordsFromJD(jdInput.value);
    return fromJD.split(/\s+/).filter(k => k.length > 2);
  }
  return [];
}

chrome.storage.local.get(['profiles', 'profileScores', 'theme', 'templates'], result => {
  if (result.profiles) {
    extractedProfiles = result.profiles;
    window.profileScores = result.profileScores || {};
    renderProfiles();
  }
  if (result.theme === 'dark') {
    document.body.classList.add('dark');
    themeToggle.textContent = '☀️';
  }
  loadTemplateDropdown();
});

function saveFormData() {
  const data = {
    jd: jdInput.value,
    keywords: keywordsInput.value,
    booleanRule: booleanRuleInput.value,
    country: countryFilterInput.value,
  };
  chrome.storage.local.set({ formData: data });
}

function loadFormData() {
  chrome.storage.local.get(['formData'], result => {
    const d = result.formData;
    if (d) {
      if (d.jd) jdInput.value = d.jd;
      if (d.keywords) keywordsInput.value = d.keywords;
      if (d.booleanRule) booleanRuleInput.value = d.booleanRule;
      if (d.country) countryFilterInput.value = d.country;
    }
  });
}

jdInput.addEventListener('input', saveFormData);
keywordsInput.addEventListener('input', saveFormData);
booleanRuleInput.addEventListener('input', saveFormData);
countryFilterInput.addEventListener('input', saveFormData);
loadFormData();

themeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark');
  chrome.storage.local.set({ theme: isDark ? 'dark' : 'light' });
  themeToggle.textContent = isDark ? '☀️' : '🌙';
});

function loadTemplateDropdown() {
  chrome.storage.local.get(['templates'], result => {
    const templates = result.templates || {};
    templateSelect.innerHTML = '<option value="">-- Load Template --</option>';
    for (const name in templates) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      templateSelect.appendChild(opt);
    }
  });
}

function saveTemplate() {
  const name = prompt('Enter template name:');
  if (!name) return;
  chrome.storage.local.get(['templates'], result => {
    const templates = result.templates || {};
    if (templates[name]) {
      if (!confirm('Template "' + name + '" already exists. Overwrite?')) return;
    }
    templates[name] = {
      jd: jdInput.value,
      keywords: keywordsInput.value,
      booleanRule: booleanRuleInput.value,
      country: countryFilterInput.value,
    };
    chrome.storage.local.set({ templates }, () => {
      loadTemplateDropdown();
      setStatus('✅ Template saved: ' + name, 'success');
    });
  });
}

function loadTemplate() {
  const name = templateSelect.value;
  if (!name) {
    setStatus('Please select a template to load.', 'error');
    return;
  }
  chrome.storage.local.get(['templates'], result => {
    const templates = result.templates || {};
    const template = templates[name];
    if (!template) {
      setStatus('Template not found.', 'error');
      return;
    }
    jdInput.value = template.jd || '';
    keywordsInput.value = template.keywords || '';
    booleanRuleInput.value = template.booleanRule || '';
    countryFilterInput.value = template.country || '';
    saveFormData();
    setStatus('📂 Loaded template: ' + name, 'success');
  });
}

function deleteTemplate() {
  const name = templateSelect.value;
  if (!name) {
    setStatus('Please select a template to delete.', 'error');
    return;
  }
  if (!confirm('Delete template "' + name + '"?')) return;
  chrome.storage.local.get(['templates'], result => {
    const templates = result.templates || {};
    delete templates[name];
    chrome.storage.local.set({ templates }, () => {
      loadTemplateDropdown();
      setStatus('🗑️ Deleted template: ' + name, 'success');
    });
  });
}

saveTemplateBtn.addEventListener('click', saveTemplate);
loadTemplateBtn.addEventListener('click', loadTemplate);
deleteTemplateBtn.addEventListener('click', deleteTemplate);

clearCacheBtn.addEventListener('click', () => {
  if (!confirm('Clear all cached profile data and scores? This will not delete your templates.')) return;
  chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' }, response => {
    if (response && response.status === 'ok') {
      window.profileScores = {};
      chrome.storage.local.remove(['profileScores', 'scoringProgress']);
      renderProfiles();
      setStatus('🧹 Cache cleared!', 'success');
    } else {
      setStatus('❌ Failed to clear cache: ' + (response?.error || 'unknown error'), 'error');
    }
  });
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

searchBtn.addEventListener('click', async () => {
  if (isSearching) return;
  const query = getSearchQuery();
  if (!query) {
    setStatus('Please enter keywords, a Boolean rule, or a job description.', 'error');
    return;
  }
  extractedProfiles = [];
  window.profileScores = {};
  renderProfiles();
  isSearching = true;
  searchBtn.disabled = true;
  setStatus('Searching LinkedIn...', 'info');

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || !tab.id) {
    setStatus('No active tab found.', 'error');
    isSearching = false;
    searchBtn.disabled = false;
    return;
  }
  const searchURL = 'https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent(query);
  await chrome.tabs.update(tab.id, { url: searchURL });
  setStatus('Waiting for profile extraction...', 'info');
});

scoreBtn.addEventListener('click', () => {
  if (isScoring) {
    if (confirm('Stop scoring? Progress will be lost.')) {
      chrome.runtime.sendMessage({ type: 'STOP_SCORING' });
      setStatus('⏹️ Stopping scoring...', 'info');
      isScoring = false;
      scoreBtn.textContent = '⭐ Score Profiles';
      scoreBtn.classList.remove('stop');
      progressArea.style.display = 'none';
    }
    return;
  }
  if (extractedProfiles.length === 0) {
    setStatus('No profiles to score. Search first.', 'error');
    return;
  }
  const keywords = getScoringKeywords();
  if (keywords.length === 0) {
    setStatus('No keywords to score with. Please provide a JD, Boolean rule, or manual keywords.', 'error');
    return;
  }
  const booleanRule = booleanRuleInput.value;
  const countryFilter = countryFilterInput.value;

  chrome.runtime.sendMessage({
    type: 'START_SCORING',
    data: {
      profiles: extractedProfiles,
      keywords,
      booleanRule,
      countryFilter,
    },
  }, response => {
    if (response && response.status === 'started') {
      setStatus('⏳ Scoring started in background...', 'info');
      isScoring = true;
      scoreBtn.textContent = '⏹️ Stop';
      scoreBtn.classList.add('stop');
      progressArea.style.display = 'flex';
      progressBar.value = 0;
      progressLabel.textContent = '0%';
      etaLabel.textContent = 'ETA: --';
    } else {
      setStatus('❌ Failed to start scoring: ' + (response?.error || 'unknown error'), 'error');
    }
  });
});

chrome.runtime.onMessage.addListener(message => {
  if (message.type === 'SCORING_STARTED') {
    setStatus('⏳ Scoring ' + message.total + ' profiles in background...', 'info');
    isScoring = true;
    scoreBtn.textContent = '⏹️ Stop';
    scoreBtn.classList.add('stop');
    progressArea.style.display = 'flex';
    progressBar.value = 0;
    progressLabel.textContent = '0%';
  }
  if (message.type === 'SCORING_PROGRESS') {
    const pct = message.progress || Math.round((message.currentIndex / message.total) * 100);
    progressBar.value = pct;
    progressLabel.textContent = pct + '%';
    if (message.eta) etaLabel.textContent = 'ETA: ' + message.eta;
    setStatus('⏳ Scoring ' + message.currentIndex + '/' + message.total + ' (' + pct + '%)...', 'info');
    window.profileScores = message.scores;
    renderProfiles();
  }
  if (message.type === 'SCORING_COMPLETE') {
    window.profileScores = message.scores;
    renderProfiles();
    setStatus('✅ Scoring complete! (' + message.failedCount + ' profiles failed)', 'success');
    isScoring = false;
    scoreBtn.textContent = '⭐ Score Profiles';
    scoreBtn.classList.remove('stop');
    progressArea.style.display = 'none';
    chrome.storage.local.set({ profileScores: message.scores });
  }
  if (message.type === 'PROFILES_FOUND') {
    extractedProfiles = message.data;
    chrome.storage.local.set({ profiles: extractedProfiles });
    renderProfiles();
    isSearching = false;
    searchBtn.disabled = false;
    setStatus('Found ' + extractedProfiles.length + ' profiles', 'success');
  }
  if (message.type === 'EXTRACTION_ERROR') {
    isSearching = false;
    searchBtn.disabled = false;
    setStatus('Error: ' + message.data, 'error');
  }
});

function renderProfiles() {
  const hideZero = hideZeroCheck.checked;
  let visibleCount = 0;
  let html = '';
  const scores = window.profileScores || {};

  extractedProfiles.forEach((url, i) => {
    const score = scores[url];
    if (hideZero && score !== undefined && score === 0) return;
    visibleCount++;
    const rawName = url.split('/in/')[1]?.split('/')[0] || 'Profile ' + (i+1);
    const safeName = escapeHtml(rawName);
    const debugText = scores[url + '_debug'];
    let scoreDisplay = '—';
    if (score !== undefined && score !== null) {
      if (score === 0) scoreDisplay = '<span style="color:#dc3545; font-weight:bold;">0% ❌</span>';
      else scoreDisplay = '<span style="color:#28a745; font-weight:bold;">' + score + '%</span>';
    }
    const debugBtn = debugText ? '<button class="btn-icon debug-btn" data-debug="' + encodeURIComponent(debugText) + '" style="cursor:pointer;font-size:12px;">🔍</button>' : '';

    html += '<div class="profile-item" data-index="' + i + '">' +
      '<a href="' + escapeHtml(url) + '" target="_blank" class="profile-url" title="' + escapeHtml(url) + '">👤 ' + safeName + '</a>' +
      '<span class="profile-score">' + scoreDisplay + '</span>' +
      '<div class="profile-actions">' + debugBtn +
      '<button class="btn-icon copy" data-url="' + escapeHtml(url) + '">📋</button>' +
      '<button class="btn-icon remove" data-index="' + i + '">✕</button>' +
      '</div></div>';
  });
  resultsContainer.innerHTML = html || '<div class="empty-state"><p>No profiles match the current filter.</p></div>';
  profileCount.textContent = visibleCount + ' profiles shown (of ' + extractedProfiles.length + ')';

  document.querySelectorAll('.debug-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const text = decodeURIComponent(e.target.dataset.debug);
      alert(text);
    });
  });

  document.querySelectorAll('.btn-icon.copy').forEach(btn => {
    btn.addEventListener('click', async e => {
      await navigator.clipboard.writeText(e.target.dataset.url);
      setStatus('URL copied!', 'success');
      setTimeout(() => setStatus('Ready', 'info'), 2000);
    });
  });

  document.querySelectorAll('.btn-icon.remove').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = parseInt(e.target.dataset.index);
      extractedProfiles.splice(idx, 1);
      chrome.storage.local.set({ profiles: extractedProfiles });
      renderProfiles();
      setStatus('Profile removed', 'info');
    });
  });
}

hideZeroCheck.addEventListener('change', renderProfiles);

exportBtn.addEventListener('click', () => {
  if (!extractedProfiles.length) {
    setStatus('No profiles to export.', 'error');
    return;
  }
  const scores = window.profileScores || {};
  let csv = 'URL,Name,Score,Location\\n';
  extractedProfiles.forEach(url => {
    const name = url.split('/in/')[1]?.split('/')[0] || 'Unknown';
    const score = scores[url] !== undefined ? scores[url] : '—';
    const location = scores[url + '_location'] || '';
    csv += '"' + url + '","' + name + '",' + score + ',"' + location + '"\\n';
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'profiles_' + Date.now() + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus('📊 CSV exported!', 'success');
});

copyAllBtn.addEventListener('click', async () => {
  if (!extractedProfiles.length) { setStatus('No profiles to copy', 'error'); return; }
  await navigator.clipboard.writeText(extractedProfiles.join('\\n'));
  setStatus('Copied ' + extractedProfiles.length + ' URLs!', 'success');
  setTimeout(() => setStatus('Ready', 'info'), 2000);
});

clearBtn.addEventListener('click', () => {
  jdInput.value = '';
  keywordsInput.value = '';
  booleanRuleInput.value = '';
  countryFilterInput.value = '';
  extractedProfiles = [];
  window.profileScores = {};
  chrome.storage.local.remove(['profiles', 'profileScores', 'formData']);
  renderProfiles();
  setStatus('Cleared', 'info');
});

function setStatus(msg, type = 'info') {
  if (!status) return;
  status.textContent = msg;
  status.className = 'status' + (type === 'error' ? ' error' : '') + (type === 'success' ? ' success' : '');
}
