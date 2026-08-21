import { dom } from './dom.js';
import { state } from './state.js';
import { setStatus } from './status.js';
import { renderProfiles } from './render.js';
import { getCurrentScoringKeywords } from './searchQuery.js';
import { MESSAGE } from '../shared/constants.js';
import { compileBooleanRule } from '../shared/booleanExpression.js';
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
                void chrome.runtime.sendMessage({ type: MESSAGE.STOP_SCORING });
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
        // Validate the Boolean rule ONCE up front. Without this, an invalid rule
        // (e.g. unquoted `React AND AWS`, a trailing `AND`, or unbalanced parens)
        // makes computeScore throw for every profile, so the whole run shows
        // "⚠️ failed" with a cryptic per-row error and no hint that the rule is at
        // fault. Surface a clear message and don't start instead.
        const booleanRule = dom.booleanRuleInput.value;
        if (booleanRule.trim()) {
            try {
                compileBooleanRule(booleanRule);
            }
            catch (e) {
                setStatus('❌ Invalid Boolean rule: ' + e.message, 'error');
                return;
            }
        }
        chrome.runtime.sendMessage({
            type: MESSAGE.START_SCORING,
            data: {
                profiles: state.extractedProfiles,
                keywords,
                booleanRule,
                countryFilter: dom.countryFilterInput.value,
            },
        }, (response) => {
            if (response && response.status === 'started') {
                setStatus('⏳ Scoring started in background...', 'info');
                enterScoringUI();
                dom.etaLabel.textContent = 'ETA: --';
            }
            else {
                setStatus('❌ Failed to start scoring: ' + (response?.error || 'unknown error'), 'error');
            }
        });
    });
}
/**
 * On popup open, ask the background whether a scoring run is in flight and, if
 * so, restore the progress UI. Without this the whole checkpoint machinery in
 * scoringEngine.ts never surfaces — a popup reopened mid-run showed an idle
 * "Score Profiles" button and a hidden progress bar even though scoring was
 * still going.
 */
export function rehydrateScoringStatus() {
    chrome.runtime.sendMessage({ type: MESSAGE.GET_SCORING_STATUS }, (status) => {
        if (chrome.runtime.lastError || !status)
            return;
        if (status.scores && Object.keys(status.scores).length > 0) {
            state.profileScores = status.scores;
            renderProfiles();
        }
        if (status.isRunning) {
            enterScoringUI();
            const total = status.total || 0;
            const pct = total ? Math.round((status.currentIndex / total) * 100) : 0;
            dom.progressBar.value = pct;
            dom.progressLabel.textContent = pct + '%';
            setStatus('⏳ Scoring ' + status.currentIndex + '/' + total + ' (' + pct + '%)...', 'info');
        }
    });
}
export function handleScoringMessage(message) {
    if (message.type === MESSAGE.SCORING_STARTED) {
        setStatus('⏳ Scoring ' + String(message.total) + ' profiles in background...', 'info');
        enterScoringUI();
        return true;
    }
    if (message.type === MESSAGE.SCORING_PROGRESS) {
        const currentIndex = message.currentIndex;
        const totalMsg = message.total;
        const pct = message.progress ?? Math.round((currentIndex / totalMsg) * 100);
        dom.progressBar.value = pct;
        dom.progressLabel.textContent = pct + '%';
        if (message.eta)
            dom.etaLabel.textContent = 'ETA: ' + message.eta;
        setStatus('⏳ Scoring ' + currentIndex + '/' + totalMsg + ' (' + pct + '%)...', 'info');
        state.profileScores = message.scores;
        renderProfiles();
        return true;
    }
    if (message.type === MESSAGE.SCORING_COMPLETE) {
        state.profileScores = message.scores;
        renderProfiles();
        setStatus('✅ Scoring complete! (' + String(message.failedCount) + ' profiles failed)', 'success');
        exitScoringUI();
        void setStorage({ profileScores: message.scores });
        return true;
    }
    return false;
}
