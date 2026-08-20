// Shared domain types used across background, popup, and content contexts.

/** Data scraped from a single LinkedIn profile page. */
export interface ProfilePageData {
  headline: string;
  location: string;
  fullText: string;
  /** Present only on the login-wall short-circuit. */
  error?: 'login';
}

/** One profile's scoring result as stored in the scores map (keyed by URL). */
export interface ScoreEntry {
  score: number;
  location: string;
  /** First ~200 chars scraped, shown by the 🔍 debug button. */
  debug: string;
  /** false when the scrape itself failed (login wall / timeout / error). */
  success: boolean;
}

/** The scores map persisted to storage and passed in progress messages. */
export type ScoresMap = Record<string, ScoreEntry>;

/** Payload sent from the popup to kick off a scoring run. */
export interface ScoringRequest {
  profiles: string[];
  keywords: string[];
  booleanRule: string;
  countryFilter: string;
}

/** A saved search template. */
export interface Template {
  jd: string;
  keywords: string;
  booleanRule: string;
  country: string;
}

/** A message flowing over chrome.runtime; `type` is a MESSAGE value, rest is payload. */
export interface RuntimeMessage {
  type: string;
  [key: string]: unknown;
}

/** Response shape from GET_SCORING_STATUS. */
export interface ScoringStatus {
  isRunning: boolean;
  currentIndex: number;
  total: number;
  scores: ScoresMap;
  failedCount: number;
}
