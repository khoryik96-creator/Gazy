// Re-exported from shared/ so the popup and the dashboard read scores identically.
// Kept as a popup-local module path so existing imports (render, csvExport) are unchanged.
export { scoreEntry } from '../shared/scoreView.js';
