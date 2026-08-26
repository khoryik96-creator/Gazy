// Ambient types for the classic (non-module) content scripts, which share a
// single global scope and communicate through `window.__gazy` rather than
// ES imports (Chrome can't declare content_scripts as modules).

// Raw signals about why a results page may be empty. Kept structurally in sync
// with shared/pageDiagnostics.ts PageSignals (the content script can't ES-import
// that module type, so it's duck-typed across the message boundary).
interface GazySignals {
  onSearchPage: boolean;
  loginWall: boolean;
  hasResultsContainer: boolean;
  matched: number;
}

interface GazyExtractor {
  collectProfiles(): string[];
  getExtractedURLs(): string[];
  pageSignals(): GazySignals;
}

interface GazyAutoscroll {
  run(collectProfiles: () => string[]): void;
}

interface GazyNamespace {
  extractor?: GazyExtractor;
  autoscroll?: GazyAutoscroll;
}

interface Window {
  __gazy: GazyNamespace;
}
