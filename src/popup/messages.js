import { handleSearchMessage } from './searchUI.js';
import { handleScoringMessage } from './scoringUI.js';

export function initMessageListener() {
  chrome.runtime.onMessage.addListener((message) => {
    handleSearchMessage(message) || handleScoringMessage(message);
  });
}
