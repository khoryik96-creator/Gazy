import { MESSAGE } from '../shared/constants.js';
import {
  startScoring,
  stopScoring,
  getScoringStatus,
  clearCache,
  restoreCheckpoint,
} from './scoringEngine.js';
import { startAiEval } from './aiEvalEngine.js';
import type { RuntimeMessage, ScoringRequest, AiEvalRequest } from '../shared/types.js';

void restoreCheckpoint();

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  switch (message.type) {
    case MESSAGE.START_SCORING:
      startScoring(message.data as ScoringRequest)
        .then(() => sendResponse({ status: 'started' }))
        .catch((err: Error) => sendResponse({ status: 'error', error: err.message }));
      return true;

    case MESSAGE.STOP_SCORING:
      stopScoring();
      sendResponse({ status: 'stopped' });
      return false;

    case MESSAGE.GET_SCORING_STATUS:
      sendResponse(getScoringStatus());
      return false;

    case MESSAGE.PROFILES_FOUND:
      void chrome.runtime.sendMessage(message).catch(() => {});
      sendResponse({ status: 'ok' });
      return false;

    case MESSAGE.CLEAR_CACHE:
      void clearCache().then(() => sendResponse({ status: 'ok' }));
      return true;

    case MESSAGE.AI_EVALUATE:
      startAiEval(message.data as AiEvalRequest)
        .then(() => sendResponse({ status: 'started' }))
        .catch((err: Error) => sendResponse({ status: 'error', error: err.message }));
      return true;

    default:
      return false;
  }
});
