import { handleSearchMessage } from './searchUI.js';
import { handleScoringMessage } from './scoringUI.js';
export function initMessageListener() {
    chrome.runtime.onMessage.addListener((message) => {
        if (!handleSearchMessage(message))
            handleScoringMessage(message);
    });
}
