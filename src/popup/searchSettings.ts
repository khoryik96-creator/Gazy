import { dom } from './dom.js';
import { getStorage, setStorage } from './storage.js';
import { clampScanPages } from '../shared/pagination.js';
import { DEFAULT_SCAN_PAGES, MAX_SCAN_PAGES } from '../shared/constants.js';

// The "Pages to scan" setting: how many LinkedIn result pages a search walks
// (~10 candidates per page). Persisted so it sticks across popup opens.

let scanPages = DEFAULT_SCAN_PAGES;

/** The current page-count setting, always within [1, MAX_SCAN_PAGES]. */
export function getScanPages(): number {
  return scanPages;
}

export function initScanPages(): void {
  dom.scanPagesInput.max = String(MAX_SCAN_PAGES);

  dom.scanPagesInput.addEventListener('change', () => {
    scanPages = clampScanPages(parseInt(dom.scanPagesInput.value, 10));
    dom.scanPagesInput.value = String(scanPages);
    void setStorage({ scanPages });
  });

  void (async () => {
    const { scanPages: stored } = (await getStorage(['scanPages'])) as { scanPages?: number };
    scanPages = clampScanPages(stored);
    dom.scanPagesInput.value = String(scanPages);
  })();
}
