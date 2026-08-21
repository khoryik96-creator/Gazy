import { dom } from './dom.js';
import { state } from './state.js';
import { setStatus } from './status.js';
import { renderProfiles } from './render.js';
import { clearFormData } from './formData.js';
import { removeStorage } from './storage.js';
import { exportCSV, copyAllURLs } from './csvExport.js';
import { initSearchButton } from './searchUI.js';
import { initScoreButton } from './scoringUI.js';
import { MESSAGE } from '../shared/constants.js';

export function initButtons(): void {
  initSearchButton();
  initScoreButton();

  dom.exportBtn.addEventListener('click', exportCSV);
  dom.copyAllBtn.addEventListener('click', () => void copyAllURLs());

  dom.clearBtn.addEventListener('click', () => {
    clearFormData();
    state.extractedProfiles = [];
    state.profileScores = {};
    void removeStorage(['profiles', 'profileScores', 'formData']);
    renderProfiles();
    setStatus('Cleared', 'info');
  });

  dom.clearCacheBtn.addEventListener('click', () => {
    if (!confirm('Clear all cached profile data and scores? This will not delete your templates.')) return;
    chrome.runtime.sendMessage({ type: MESSAGE.CLEAR_CACHE }, (response?: { status?: string; error?: string }) => {
      if (response && response.status === 'ok') {
        state.profileScores = {};
        void removeStorage(['profileScores', 'scoringProgress']);
        renderProfiles();
        setStatus('🧹 Cache cleared!', 'success');
      } else {
        setStatus('❌ Failed to clear cache: ' + (response?.error || 'unknown error'), 'error');
      }
    });
  });
}
