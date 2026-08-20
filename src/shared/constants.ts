export const MESSAGE = {
  START_SCORING: 'START_SCORING',
  STOP_SCORING: 'STOP_SCORING',
  GET_SCORING_STATUS: 'GET_SCORING_STATUS',
  CLEAR_CACHE: 'CLEAR_CACHE',
  SCORING_STARTED: 'SCORING_STARTED',
  SCORING_PROGRESS: 'SCORING_PROGRESS',
  SCORING_COMPLETE: 'SCORING_COMPLETE',
  PROFILES_FOUND: 'PROFILES_FOUND',
  EXTRACTION_ERROR: 'EXTRACTION_ERROR',
  EXTRACT_NOW: 'EXTRACT_NOW',
} as const;

export type MessageType = (typeof MESSAGE)[keyof typeof MESSAGE];

export const RETRY_COUNT = 3;
export const MIN_TEXT_LENGTH = 50;
export const PROFILE_TIMEOUT_MS = 60000;
export const CACHE_EXPIRY_MS = 86400000;

// Anti-detection pacing. All scraping delays are randomised within a range
// rather than fixed, so profile views don't arrive on a metronome (near-zero
// timing variance is one of the cheapest automation signals to detect).
// BATCH_SIZE 1 = one profile at a time (no simultaneous-tab bursts).
export const BATCH_SIZE = 1;
export const SCORING_DELAY_MIN_MS = 3000; // min gap between profiles
export const SCORING_DELAY_MAX_MS = 9000; // max gap between profiles
export const SCRAPE_DELAY_MIN_MS = 1500; // min settle time before scraping a loaded tab
export const SCRAPE_DELAY_MAX_MS = 4000; // max settle time before scraping a loaded tab
export const RETRY_DELAY_MIN_MS = 3000; // min backoff before retrying thin content
export const RETRY_DELAY_MAX_MS = 6000; // max backoff before retrying thin content
