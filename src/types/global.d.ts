// Ambient types for the classic (non-module) content scripts, which share a
// single global scope and communicate through `window.__gazy` rather than
// ES imports (Chrome can't declare content_scripts as modules).

interface GazyExtractor {
  extractProfiles(): string[];
  getExtractedURLs(): string[];
}

interface GazyAutoscroll {
  run(extractProfiles: () => string[]): void;
}

interface GazyNamespace {
  extractor?: GazyExtractor;
  autoscroll?: GazyAutoscroll;
}

interface Window {
  __gazy: GazyNamespace;
}
