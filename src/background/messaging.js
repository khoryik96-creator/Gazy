import { MESSAGE } from '../shared/constants.js';
import { startScoring, stopScoring, getScoringStatus, clearCache, restoreCheckpoint } from './scoringEngine.js';

restoreCheckpoint();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case MESSAGE.START_SCORING:
      startScoring(message.data)
        .then(() => sendResponse({ status: 'started' }))
        .catch((err) => sendResponse({ status: 'error', error: err.message }));
      return true;

    case MESSAGE.STOP_SCORING:
      stopScoring();
      sendResponse({ status: 'stopped' });
      return false;

    case MESSAGE.GET_SCORING_STATUS:
      sendResponse(getScoringStatus());
      return false;

    case MESSAGE.PROFILES_FOUND:
      chrome.runtime.sendMessage(message).catch(() => {});
      sendResponse({ status: 'ok' });
      return false;

    case MESSAGE.CLEAR_CACHE:
      clearCache().then(() => sendResponse({ status: 'ok' }));
      return true;

    default:
      return false;
  }
});
