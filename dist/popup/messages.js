import { handleSearchMessage } from './searchUI.js';
import { handleScoringMessage } from './scoringUI.js';
import { handleAiEvalMessage } from './aiEvalUI.js';
export function initMessageListener() {
    chrome.runtime.onMessage.addListener((message) => {
        if (handleSearchMessage(message))
            return;
        if (handleScoringMessage(message))
            return;
        handleAiEvalMessage(message);
    });
}
