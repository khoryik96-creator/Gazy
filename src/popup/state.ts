import type { ScoresMap } from '../shared/types.js';

interface PopupState {
  extractedProfiles: string[];
  profileScores: ScoresMap;
  isSearching: boolean;
  isScoring: boolean;
}

/** Central popup UI state. Keep this the single mutable source of truth for popup.js modules. */
export const state: PopupState = {
  extractedProfiles: [],
  profileScores: {},
  isSearching: false,
  isScoring: false,
};
