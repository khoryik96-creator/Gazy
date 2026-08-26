// Retry policy for the profile scraper. Pure (no chrome.* / DOM / timers) so the
// classification and backoff math are unit-tested directly (test/retry.test.js)
// and shared between the fetcher and the tests.
import { randomDelayMs } from './timing.js';
/** Whether this failure kind is worth another attempt at all. */
export function isRetryable(failure) {
    return failure === 'thin-content' || failure === 'transient';
}
/** Whether to retry now: the failure is retryable AND we're under the attempt cap. */
export function shouldRetry(failure, attempt, maxRetries) {
    return isRetryable(failure) && attempt < maxRetries;
}
/**
 * Exponential backoff with jitter. `attempt` is 0-based: the pause grows as
 * roughly base·2^attempt, so successive retries wait longer (0 → base, 1 → 2×,
 * 2 → 4×), capped at `capMs`. The base is a random value in [minMs, maxMs], so
 * the scraper keeps its irregular, non-machine-like cadence rather than pausing
 * for a constant, detectable interval.
 */
export function backoffDelayMs(attempt, minMs, maxMs, capMs = 30000) {
    const base = randomDelayMs(minMs, maxMs);
    const factor = Math.pow(2, Math.max(0, attempt));
    return Math.min(base * factor, capMs);
}
