import { MESSAGE } from '../shared/constants.js';
import {
  startScoring,
  stopScoring,
  getScoringStatus,
  clearCache,
  restoreCheckpoint,
} from './scoringEngine.js';
import { startAiEval, stopAiEval } from './aiEvalEngine.js';
import { startSearch, handlePageExtracted } from './searchSession.js';
import type { RuntimeMessage, ScoringRequest, AiEvalRequest } from '../shared/types.js';

void restoreCheckpoint();

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  switch (message.type) {
    case MESSAGE.START_SEARCH:
      startSearch(message.data as { query: string; maxPages?: number })
        .then(() => sendResponse({ status: 'started' }))
        .catch((err: Error) => sendResponse({ status: 'error', error: err.message }));
      return true;

    case MESSAGE.PAGE_EXTRACTED:
      void handlePageExtracted(message.data, sender.tab?.id);
      sendResponse({ status: 'ok' });
      return false;

    case MESSAGE.START_SCORING:
      // Ack synchronously: the engine kicks off a detached loop and returns at
      // once, so we don't hold the message channel open across a long run (which
      // an MV3 worker restart would break → "Failed to start: unknown").
      try {
        startScoring(message.data as ScoringRequest);
        sendResponse({ status: 'started' });
      } catch (err) {
        sendResponse({ status: 'error', error: (err as Error).message });
      }
      return false;

    case MESSAGE.STOP_SCORING:
      stopScoring();
      sendResponse({ status: 'stopped' });
      return false;

    case MESSAGE.STOP_AI_EVAL:
      stopAiEval();
      sendResponse({ status: 'stopped' });
      return false;

    case MESSAGE.GET_SCORING_STATUS:
      sendResponse(getScoringStatus());
      return false;

    case MESSAGE.CLEAR_CACHE:
      void clearCache().then(() => sendResponse({ status: 'ok' }));
      return true;

    case MESSAGE.AI_EVALUATE:
      // Ack synchronously (see START_SCORING): the engine detaches its run, so the
      // channel isn't held open across a long, network-bound evaluation that a
      // worker restart would break → "Failed to start: unknown".
      try {
        startAiEval(message.data as AiEvalRequest);
        sendResponse({ status: 'started' });
      } catch (err) {
        sendResponse({ status: 'error', error: (err as Error).message });
      }
      return false;

    default:
      return false;
  }
});
