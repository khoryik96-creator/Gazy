import { dom } from './dom.js';
import { state } from './state.js';
import { setStatus } from './status.js';
import { renderProfiles } from './render.js';
import { getAiKey, getAiModel } from './settings.js';
import { MESSAGE } from '../shared/constants.js';
import { setStorage } from './storage.js';
import type { RuntimeMessage, AiEvalMap } from '../shared/types.js';

function requirementsText(): string {
  return (
    dom.jdInput.value.trim() || dom.keywordsInput.value.trim() || dom.booleanRuleInput.value.trim()
  );
}

function setEvaluating(on: boolean): void {
  state.isEvaluating = on;
  dom.aiEvalBtn.disabled = on;
  dom.aiEvalBtn.textContent = on ? '✨ Evaluating…' : '✨ AI Evaluate';
}

export function initAiEvalButton(): void {
  dom.aiEvalBtn.addEventListener('click', () => {
    if (state.isEvaluating) return;

    if (state.extractedProfiles.length === 0) {
      setStatus('No profiles to evaluate. Search first.', 'error');
      return;
    }

    const apiKey = getAiKey();
    if (!apiKey) {
      setStatus('Add your DeepSeek API key in ⚙️ settings first.', 'error');
      dom.settingsPanel.style.display = 'flex';
      return;
    }

    const jd = requirementsText();
    if (!jd) {
      setStatus('Add a job description or keywords for the AI to judge against.', 'error');
      return;
    }

    const model = getAiModel();
    const count = state.extractedProfiles.length;
    if (
      !confirm(
        'Send ' +
          count +
          ' profile(s) to DeepSeek (' +
          model +
          ') for AI evaluation?\n\nThis uses your API key and sends profile text to DeepSeek. ' +
          'Remove profiles first to spend less.',
      )
    ) {
      return;
    }

    setEvaluating(true);
    setStatus('✨ AI evaluating with ' + model + '…', 'info');
    chrome.runtime.sendMessage(
      {
        type: MESSAGE.AI_EVALUATE,
        data: { profiles: state.extractedProfiles, jd, apiKey, model },
      },
      (response?: { status?: string; error?: string }) => {
        if (!response || response.status !== 'started') {
          setEvaluating(false);
          setStatus('❌ Failed to start AI evaluation: ' + (response?.error || 'unknown'), 'error');
        }
      },
    );
  });
}

export function handleAiEvalMessage(message: RuntimeMessage): boolean {
  if (message.type === MESSAGE.AI_EVAL_PROGRESS) {
    state.aiEvals = message.results as AiEvalMap;
    renderProfiles();
    const pct = message.progress as number;
    setStatus(
      '✨ AI evaluating ' + String(message.currentIndex) + '/' + String(message.total) + '…',
      'info',
    );
    dom.progressBar.value = pct;
    return true;
  }

  if (message.type === MESSAGE.AI_EVAL_COMPLETE) {
    state.aiEvals = message.results as AiEvalMap;
    renderProfiles();
    void setStorage({ aiEvals: state.aiEvals });
    setEvaluating(false);
    setStatus('✨ AI evaluation complete!', 'success');
    return true;
  }

  return false;
}
