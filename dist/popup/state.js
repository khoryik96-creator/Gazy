/** Central popup UI state. Keep this the single mutable source of truth for popup.js modules. */
export const state = {
    extractedProfiles: [],
    profileScores: {},
    aiEvals: {},
    isSearching: false,
    isScoring: false,
    isEvaluating: false,
};
