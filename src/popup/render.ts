import { dom } from './dom.js';
import { state } from './state.js';
import { setStorage } from './storage.js';
import { setStatus } from './status.js';
import { scoreEntry } from './scores.js';
import { isShortlisted, toggleShortlist } from './shortlist.js';

export function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function renderProfiles(): void {
  const hideZero = dom.hideZeroCheck.checked;
  const shortlistOnly = dom.shortlistOnlyCheck.checked;
  const scores = state.profileScores;
  let visibleCount = 0;
  let html = '';

  state.extractedProfiles.forEach((url, i) => {
    const entry = scoreEntry(scores, url);
    const score = entry?.score;
    // Only hide genuine zero matches, never failed scrapes — a failed fetch
    // isn't evidence the candidate is a poor match.
    if (hideZero && score === 0 && entry?.success !== false) return;
    if (shortlistOnly && !isShortlisted(url)) return;
    visibleCount++;

    const starred = isShortlisted(url);
    const starBtn =
      '<button class="btn-icon star' +
      (starred ? ' on' : '') +
      '" data-url="' +
      escapeHtml(url) +
      '" title="' +
      (starred ? 'Remove from shortlist' : 'Add to shortlist') +
      '">' +
      (starred ? '⭐' : '☆') +
      '</button>';

    const rawName = url.split('/in/')[1]?.split('/')[0] || 'Profile ' + (i + 1);
    const safeName = escapeHtml(rawName);
    const debugText = entry?.debug;
    let scoreDisplay = '—';
    if (entry) {
      if (entry.success === false) {
        // Scrape failed (login wall / timeout / error) — distinct from a real 0
        // so the recruiter doesn't discard a candidate we simply couldn't read.
        scoreDisplay = '<span class="score-fail">⚠️ failed</span>';
      } else if (score === 0) {
        scoreDisplay = '<span class="score-zero">0% ❌</span>';
      } else {
        scoreDisplay = '<span class="score-good">' + score + '%</span>';
      }
    }
    const debugBtn = debugText
      ? '<button class="btn-icon debug-btn" data-debug="' +
        encodeURIComponent(debugText) +
        '" style="cursor:pointer;font-size:12px;">🔍</button>'
      : '';

    // Optional DeepSeek evaluation: a purple AI score + a 💡 "why" button.
    const ai = state.aiEvals[url];
    let aiDisplay = '';
    let whyBtn = '';
    if (ai) {
      if (ai.error) {
        aiDisplay = '<span class="profile-ai err" title="' + escapeHtml(ai.error) + '">✨⚠️</span>';
      } else {
        aiDisplay = '<span class="profile-ai">✨' + ai.score + '%</span>';
        const why =
          ai.reason +
          (ai.matched.length ? '\n\n✅ Matched: ' + ai.matched.join(', ') : '') +
          (ai.missing.length ? '\n\n❌ Missing: ' + ai.missing.join(', ') : '');
        whyBtn =
          '<button class="btn-icon ai-why" data-why="' +
          encodeURIComponent(why) +
          '" style="cursor:pointer;font-size:12px;">💡</button>';
      }
    }

    html +=
      '<div class="profile-item" data-index="' +
      i +
      '">' +
      '<a href="' +
      escapeHtml(url) +
      '" target="_blank" class="profile-url" title="' +
      escapeHtml(url) +
      '">👤 ' +
      safeName +
      '</a>' +
      '<span class="profile-score">' +
      scoreDisplay +
      '</span>' +
      aiDisplay +
      '<div class="profile-actions">' +
      starBtn +
      whyBtn +
      debugBtn +
      '<button class="btn-icon copy" data-url="' +
      escapeHtml(url) +
      '">📋</button>' +
      '<button class="btn-icon remove" data-index="' +
      i +
      '">✕</button>' +
      '</div></div>';
  });

  dom.resultsContainer.innerHTML =
    html || '<div class="empty-state"><p>No profiles match the current filter.</p></div>';
  dom.profileCount.textContent =
    visibleCount + ' profiles shown (of ' + state.extractedProfiles.length + ')';

  wireResultRowActions();
}

function wireResultRowActions(): void {
  dom.resultsContainer.querySelectorAll<HTMLButtonElement>('.debug-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      alert(decodeURIComponent(target.dataset.debug || ''));
    });
  });

  dom.resultsContainer.querySelectorAll<HTMLButtonElement>('.ai-why').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      alert(decodeURIComponent(target.dataset.why || ''));
    });
  });

  dom.resultsContainer.querySelectorAll<HTMLButtonElement>('.btn-icon.star').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      toggleShortlist(target.dataset.url || '');
      renderProfiles();
    });
  });

  dom.resultsContainer.querySelectorAll<HTMLButtonElement>('.btn-icon.copy').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      void navigator.clipboard.writeText(target.dataset.url || '').then(() => {
        setStatus('URL copied!', 'success');
        setTimeout(() => setStatus('Ready', 'info'), 2000);
      });
    });
  });

  dom.resultsContainer.querySelectorAll<HTMLButtonElement>('.btn-icon.remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const idx = parseInt(target.dataset.index || '', 10);
      state.extractedProfiles.splice(idx, 1);
      void setStorage({ profiles: state.extractedProfiles });
      renderProfiles();
      setStatus('Profile removed', 'info');
    });
  });
}

dom.hideZeroCheck.addEventListener('change', renderProfiles);
dom.shortlistOnlyCheck.addEventListener('change', renderProfiles);
