/**
 * Small timing helpers shared by the scraping/scoring path. Kept pure (no
 * chrome.* / DOM) so both the background modules and the Node tests can use them.
 */

/**
 * A random integer in the inclusive range [min, max], used to jitter scraping
 * delays. Randomised (rather than fixed) inter-request timing is what keeps the
 * scraper from viewing profiles on a detectable, machine-regular cadence.
 * Tolerates min/max passed in either order.
 */
export function randomDelayMs(min, max) {
  let lo = Math.ceil(Math.min(min, max));
  let hi = Math.floor(Math.max(min, max));
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/** Promise that resolves after `ms` milliseconds. */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
