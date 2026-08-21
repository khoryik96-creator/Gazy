import { handleSearchMessage } from './searchUI.js';
import { handleScoringMessage } from './scoringUI.js';
import type { RuntimeMessage } from '../shared/types.js';

export function initMessageListener(): void {
  chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
    if (!handleSearchMessage(message)) handleScoringMessage(message);
  });
}
