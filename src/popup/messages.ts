import { handleSearchMessage } from './searchUI.js';
import { handleScoringMessage } from './scoringUI.js';
import { handleAiEvalMessage } from './aiEvalUI.js';
import type { RuntimeMessage } from '../shared/types.js';

export function initMessageListener(): void {
  chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
    if (handleSearchMessage(message)) return;
    if (handleScoringMessage(message)) return;
    handleAiEvalMessage(message);
  });
}
