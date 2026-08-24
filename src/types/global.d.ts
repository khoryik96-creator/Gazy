// Ambient types for the classic (non-module) content scripts, which share a
// single global scope and communicate through `window.__gazy` rather than
// ES imports (Chrome can't declare content_scripts as modules).

interface GazyExtractor {
  collectProfiles(): string[];
  getExtractedURLs(): string[];
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
