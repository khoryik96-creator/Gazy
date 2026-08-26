import {
  RETRY_COUNT,
  MIN_TEXT_LENGTH,
  PROFILE_TIMEOUT_MS,
  SCRAPE_DELAY_MIN_MS,
  SCRAPE_DELAY_MAX_MS,
  RETRY_DELAY_MIN_MS,
  RETRY_DELAY_MAX_MS,
} from '../shared/constants.js';
import { randomDelayMs } from '../shared/timing.js';
import { shouldRetry, backoffDelayMs } from '../shared/retry.js';
import type { ScrapeFailure } from '../shared/retry.js';
import { profileCache } from './cache.js';
import { extractProfilePageData } from './pageExtractor.js';
import type { ProfilePageData } from '../shared/types.js';

/**
 * Opens `url` in a background tab, scrapes it, and caches the result.
 *
 * Retries with exponential backoff on recoverable failures — thin/slow-rendered
 * content, plus transient errors (executeScript races, empty results, load
 * timeouts) — up to RETRY_COUNT attempts. A login wall is fatal: it rejects
 * immediately, since another attempt can't fix it.
 *
 * The tab is only closed once scraping has actually finished (success, error, or timeout) —
 * closing it earlier means chrome.scripting.executeScript runs against a tab that no longer
 * exists, which was a bug in the original implementation.
 */
export function fetchProfileData(url: string, retryCount = 0): Promise<ProfilePageData> {
  return new Promise((resolve, reject) => {
    const cached = profileCache.get(url);
    if (cached) {
      resolve(cached);
      return;
    }

    chrome.tabs.create({ url, active: false }, (tab) => {
      if (!tab.id) {
        reject(new Error('Failed to create tab'));
        return;
      }
      const tabId = tab.id;

      // Structural type for the bits of the onUpdated changeInfo we read, so we
      // don't depend on the exact @types/chrome member name across versions.
      let updatedListener: ((tabId: number, info: { status?: string }) => void) | null = null;
      let timeoutId: ReturnType<typeof setTimeout>;
      let settled = false;
      let scraping = false;

      const removeUpdatedListener = () => {
        if (updatedListener) {
          chrome.tabs.onUpdated.removeListener(updatedListener);
          updatedListener = null;
        }
      };

      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        removeUpdatedListener();
        clearTimeout(timeoutId);
        chrome.tabs.remove(tabId, () => {
          if (chrome.runtime.lastError) {
            /* tab already gone; ignore */
          }
        });
        action();
      };

      // Close the tab, then either schedule a backed-off retry (recoverable
      // failures under the attempt cap) or reject with the given error.
      const fail = (failure: ScrapeFailure, err: Error) => {
        finish(() => {
          if (shouldRetry(failure, retryCount, RETRY_COUNT)) {
            setTimeout(
              () => {
                fetchProfileData(url, retryCount + 1)
                  .then(resolve)
                  .catch(reject);
              },
              backoffDelayMs(retryCount, RETRY_DELAY_MIN_MS, RETRY_DELAY_MAX_MS),
            );
          } else {
            reject(err);
          }
        });
      };

      const scrapeTab = () => {
        if (scraping || settled) return;
        scraping = true;
        removeUpdatedListener();

        // Randomised settle time before scraping, so a loaded tab isn't read
        // after a constant delay every single time.
        setTimeout(
          () => {
            chrome.scripting.executeScript(
              { target: { tabId }, func: extractProfilePageData },
              (results) => {
                // Transient: the injected script raced the tab or returned nothing.
                if (chrome.runtime.lastError) {
                  fail('transient', new Error(chrome.runtime.lastError.message));
                  return;
                }
                if (!results || !results[0] || !results[0].result) {
                  fail('transient', new Error('No data extracted'));
                  return;
                }

                const data = results[0].result;
                // Fatal: a login wall won't clear on a retry — surface it now.
                if (data.error === 'login') {
                  fail(
                    'fatal',
                    new Error('LinkedIn login page detected. Please ensure you are logged in.'),
                  );
                  return;
                }
                // Thin content: retry while under the cap, else accept what we got.
                if (data.fullText.length < MIN_TEXT_LENGTH && retryCount < RETRY_COUNT) {
                  fail('thin-content', new Error('Thin profile content'));
                  return;
                }

                profileCache.set(url, data);
                finish(() => resolve(data));
              },
            );
          },
          randomDelayMs(SCRAPE_DELAY_MIN_MS, SCRAPE_DELAY_MAX_MS),
        );
      };

      if (tab.status === 'complete') {
        scrapeTab();
      } else {
        updatedListener = (updatedId, info) => {
          if (updatedId === tabId && info.status === 'complete') scrapeTab();
        };
        chrome.tabs.onUpdated.addListener(updatedListener);
      }

      timeoutId = setTimeout(() => {
        // A hung/slow load is transient — retry it rather than failing outright.
        fail('transient', new Error('Profile load timed out after 60 seconds.'));
      }, PROFILE_TIMEOUT_MS);
    });
  });
}
