import { dom } from './dom.js';
import { state } from './state.js';
import { setStatus } from './status.js';
import { renderProfiles } from './render.js';
import { getCurrentScoringKeywords } from './searchQuery.js';
import { MESSAGE } from '../shared/constants.js';
import { setStorage } from './storage.js';

function enterScoringUI() {
  state.isScoring = true;
  dom.scoreBtn.textContent = '⏹️ Stop';
  dom.scoreBtn.classList.add('stop');
  dom.progressArea.style.display = 'flex';
  dom.progressBar.value = 0;
  dom.progressLabel.textContent = '0%';
}

function exitScoringUI() {
  state.isScoring = false;
  dom.scoreBtn.textContent = '⭐ Score Profiles';
  dom.scoreBtn.classList.remove('stop');
  dom.progressArea.style.display = 'none';
}

export function initScoreButton() {
  dom.scoreBtn.addEventListener('click', () => {
    if (state.isScoring) {
      if (confirm('Stop scoring? Progress will be lost.')) {
        chrome.runtime.sendMessage({ type: MESSAGE.STOP_SCORING });
        setStatus('⏹️ Stopping scoring...', 'info');
        exitScoringUI();
      }
      return;
    }

    if (state.extractedProfiles.length === 0) {
      setStatus('No profiles to score. Search first.', 'error');
      return;
    }

    const keywords = getCurrentScoringKeywords();
    if (keywords.length === 0) {
      setStatus('No keywords to score with. Please provide a JD, Boolean rule, or manual keywords.', 'error');
      return;
    }

    chrome.runtime.sendMessage({
      type: MESSAGE.START_SCORING,
      data: {
        profiles: state.extractedProfiles,
        keywords,
        booleanRule: dom.booleanRuleInput.value,
        countryFilter: dom.countryFilterInput.value,
      },
    }, (response) => {
      if (response && response.status === 'started') {
        setStatus('⏳ Scoring started in background...', 'info');
        enterScoringUI();
        dom.etaLabel.textContent = 'ETA: --';
      } else {
        setStatus('❌ Failed to start scoring: ' + (response?.error || 'unknown error'), 'error');
      }
    });
  });
}

export function handleScoringMessage(message) {
  if (message.type === MESSAGE.SCORING_STARTED) {
    setStatus('⏳ Scoring ' + message.total + ' profiles in background...', 'info');
    enterScoringUI();
    return true;
  }

  if (message.type === MESSAGE.SCORING_PROGRESS) {
    const pct = message.progress ?? Math.round((message.currentIndex / message.total) * 100);
    dom.progressBar.value = pct;
    dom.progressLabel.textContent = pct + '%';
    if (message.eta) dom.etaLabel.textContent = 'ETA: ' + message.eta;
    setStatus('⏳ Scoring ' + message.currentIndex + '/' + message.total + ' (' + pct + '%)...', 'info');
    state.profileScores = message.scores;
    renderProfiles();
    return true;
  }

  if (message.type === MESSAGE.SCORING_COMPLETE) {
    state.profileScores = message.scores;
    renderProfiles();
    setStatus('✅ Scoring complete! (' + message.failedCount + ' profiles failed)', 'success');
    exitScoringUI();
    setStorage({ profileScores: message.scores });
    return true;
  }

  return false;
}
