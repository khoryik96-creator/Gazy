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
    AI_EVALUATE: 'AI_EVALUATE',
    STOP_AI_EVAL: 'STOP_AI_EVAL',
    AI_EVAL_PROGRESS: 'AI_EVAL_PROGRESS',
    AI_EVAL_COMPLETE: 'AI_EVAL_COMPLETE',
    START_SEARCH: 'START_SEARCH',
    SEARCH_PROGRESS: 'SEARCH_PROGRESS',
    PAGE_EXTRACTED: 'PAGE_EXTRACTED',
};
/** DeepSeek's OpenAI-compatible chat-completions endpoint. */
export const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
/** Cap on how much scraped profile text we send per AI evaluation (bounds cost). */
export const AI_MAX_PROFILE_CHARS = 6000;
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
// DeepSeek API retry: on a 429 (rate limit) or transient 5xx, retry the call a
// few times with exponential backoff before recording the profile as failed.
// Dashboard: coalesce bursts of storage writes into one reload+render. Long
// enough to merge a burst (and a local write's duplicate render), short enough to
// feel instant.
export const STORAGE_RELOAD_DEBOUNCE_MS = 120;
export const AI_RETRY_COUNT = 3;
export const AI_RETRY_DELAY_MIN_MS = 1000;
export const AI_RETRY_DELAY_MAX_MS = 2500;
// Multi-page result scanning. A LinkedIn people-search page holds ~10 results;
// to reach more candidates we walk the paginated URL (&page=N) one page at a
// time, pausing a randomised gap between page turns for the same anti-detection
// reason the per-profile scraping delays exist.
export const DEFAULT_SCAN_PAGES = 10; // pages scanned per search unless changed
export const MAX_SCAN_PAGES = 10; // upper bound on the Pages setting
export const PAGE_NAV_DELAY_MIN_MS = 2500; // min gap before loading the next page
export const PAGE_NAV_DELAY_MAX_MS = 6000; // max gap before loading the next page
