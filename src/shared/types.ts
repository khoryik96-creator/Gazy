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

/** DeepSeek model choice for the optional AI evaluation. */
export type AiModel = 'deepseek-chat' | 'deepseek-reasoner';

/** One profile's AI evaluation result (keyed by URL). */
export interface AiEvalEntry {
  /** 0-100 fit score from the model. */
  score: number;
  /** One-line rationale. */
  reason: string;
  /** Skills/requirements the profile clearly meets. */
  matched: string[];
  /** Requirements the profile is missing. */
  missing: string[];
  /** Set when the evaluation failed (no key, network, bad response). */
  error?: string;
}

/** The AI-evaluation map passed in progress messages and stored in popup state. */
export type AiEvalMap = Record<string, AiEvalEntry>;

/** Payload sent from the popup to kick off an AI evaluation run. */
export interface AiEvalRequest {
  profiles: string[];
  /** The requirements text (job description, or keywords/Boolean as a fallback). */
  jd: string;
  apiKey: string;
  model: AiModel;
}
