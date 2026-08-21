import type { ScoresMap, AiEvalMap } from '../shared/types.js';

interface PopupState {
  extractedProfiles: string[];
  profileScores: ScoresMap;
  aiEvals: AiEvalMap;
  isSearching: boolean;
  isScoring: boolean;
  isEvaluating: boolean;
}

/** Central popup UI state. Keep this the single mutable source of truth for popup.js modules. */
export const state: PopupState = {
  extractedProfiles: [],
  profileScores: {},
  aiEvals: {},
  isSearching: false,
  isScoring: false,
  isEvaluating: false,
};
