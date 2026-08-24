import { MESSAGE } from '../shared/constants.js';
import { startScoring, stopScoring, getScoringStatus, clearCache, restoreCheckpoint, } from './scoringEngine.js';
import { startAiEval } from './aiEvalEngine.js';
import { startSearch, handlePageExtracted } from './searchSession.js';
void restoreCheckpoint();
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case MESSAGE.START_SEARCH:
            startSearch(message.data)
                .then(() => sendResponse({ status: 'started' }))
                .catch((err) => sendResponse({ status: 'error', error: err.message }));
            return true;
        case MESSAGE.PAGE_EXTRACTED:
            void handlePageExtracted(message.data, sender.tab?.id);
            sendResponse({ status: 'ok' });
            return false;
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
        case MESSAGE.CLEAR_CACHE:
            void clearCache().then(() => sendResponse({ status: 'ok' }));
            return true;
        case MESSAGE.AI_EVALUATE:
            startAiEval(message.data)
                .then(() => sendResponse({ status: 'started' }))
                .catch((err) => sendResponse({ status: 'error', error: err.message }));
            return true;
        default:
            return false;
    }
});
