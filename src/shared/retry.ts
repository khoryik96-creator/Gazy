// Retry policy for the profile scraper. Pure (no chrome.* / DOM / timers) so the
// classification and backoff math are unit-tested directly (test/retry.test.js)
// and shared between the fetcher and the tests.

import { randomDelayMs } from './timing.js';

// Why a scrape attempt failed, which decides whether retrying can help:
//  • thin-content — the page loaded but scraped too little text (often a slow
//    client-render); a retry after a pause frequently succeeds.
//  • transient    — an executeScript race, an empty result, or a load timeout;
//    usually a one-off, worth another attempt.
//  • fatal        — a login wall (or anything a retry can't fix); retrying just
//    burns tabs and time, so give up immediately.
export type ScrapeFailure = 'thin-content' | 'transient' | 'fatal';

/** Whether this failure kind is worth another attempt at all. */
export function isRetryable(failure: ScrapeFailure): boolean {
  return failure === 'thin-content' || failure === 'transient';
}

// HTTP statuses worth retrying on an API call: 429 (rate limited) and the
// transient 5xx gateway/overload family. A 4xx other than 429 (e.g. 401 bad key,
// 400 bad request) won't fix itself on a retry, so it's not retried.
const RETRYABLE_HTTP = new Set([429, 500, 502, 503, 504]);

export function isRetryableHttpStatus(status: number): boolean {
  return RETRYABLE_HTTP.has(status);
}

/** Whether to retry now: the failure is retryable AND we're under the attempt cap. */
export function shouldRetry(failure: ScrapeFailure, attempt: number, maxRetries: number): boolean {
  return isRetryable(failure) && attempt < maxRetries;
}

/**
 * Exponential backoff with jitter. `attempt` is 0-based: the pause grows as
 * roughly base·2^attempt, so successive retries wait longer (0 → base, 1 → 2×,
 * 2 → 4×), capped at `capMs`. The base is a random value in [minMs, maxMs], so
 * the scraper keeps its irregular, non-machine-like cadence rather than pausing
 * for a constant, detectable interval.
 */
export function backoffDelayMs(
  attempt: number,
  minMs: number,
  maxMs: number,
  capMs = 30000,
): number {
  const base = randomDelayMs(minMs, maxMs);
  const factor = Math.pow(2, Math.max(0, attempt));
  return Math.min(base * factor, capMs);
}
