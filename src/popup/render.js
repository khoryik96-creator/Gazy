import { dom } from './dom.js';
import { state } from './state.js';
import { setStorage } from './storage.js';
import { setStatus } from './status.js';

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function renderProfiles() {
  const hideZero = dom.hideZeroCheck.checked;
  const scores = state.profileScores;
  let visibleCount = 0;
  let html = '';

  state.extractedProfiles.forEach((url, i) => {
    const score = scores[url];
    if (hideZero && score === 0) return;
    visibleCount++;

    const rawName = url.split('/in/')[1]?.split('/')[0] || 'Profile ' + (i + 1);
    const safeName = escapeHtml(rawName);
    const debugText = scores[url + '_debug'];
    let scoreDisplay = '—';
    if (score !== undefined && score !== null) {
      scoreDisplay = score === 0
        ? '<span style="color:#dc3545; font-weight:bold;">0% ❌</span>'
        : '<span style="color:#28a745; font-weight:bold;">' + score + '%</span>';
    }
    const debugBtn = debugText
      ? '<button class="btn-icon debug-btn" data-debug="' + encodeURIComponent(debugText) + '" style="cursor:pointer;font-size:12px;">🔍</button>'
      : '';

    html += '<div class="profile-item" data-index="' + i + '">' +
      '<a href="' + escapeHtml(url) + '" target="_blank" class="profile-url" title="' + escapeHtml(url) + '">👤 ' + safeName + '</a>' +
      '<span class="profile-score">' + scoreDisplay + '</span>' +
      '<div class="profile-actions">' + debugBtn +
      '<button class="btn-icon copy" data-url="' + escapeHtml(url) + '">📋</button>' +
      '<button class="btn-icon remove" data-index="' + i + '">✕</button>' +
      '</div></div>';
  });

  dom.resultsContainer.innerHTML = html || '<div class="empty-state"><p>No profiles match the current filter.</p></div>';
  dom.profileCount.textContent = visibleCount + ' profiles shown (of ' + state.extractedProfiles.length + ')';

  wireResultRowActions();
}

function wireResultRowActions() {
  dom.resultsContainer.querySelectorAll('.debug-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      alert(decodeURIComponent(e.currentTarget.dataset.debug));
    });
  });

  dom.resultsContainer.querySelectorAll('.btn-icon.copy').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      await navigator.clipboard.writeText(e.currentTarget.dataset.url);
      setStatus('URL copied!', 'success');
      setTimeout(() => setStatus('Ready', 'info'), 2000);
    });
  });

  dom.resultsContainer.querySelectorAll('.btn-icon.remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      state.extractedProfiles.splice(idx, 1);
      setStorage({ profiles: state.extractedProfiles });
      renderProfiles();
      setStatus('Profile removed', 'info');
    });
  });
}

dom.hideZeroCheck.addEventListener('change', renderProfiles);
