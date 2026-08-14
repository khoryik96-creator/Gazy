import { BATCH_SIZE, SCORING_DELAY_MS, MESSAGE } from '../shared/constants.js';
import { fetchProfileData } from './profileFetcher.js';
import { computeScore } from './scoring.js';
import { profileCache } from './cache.js';

const SESSION_KEY = 'scoringCheckpoint';

let scoringState = {
  isRunning: false,
  profiles: [],
  scores: {},
  currentIndex: 0,
  failedCount: 0,
  keywords: [],
  booleanRule: '',
  countryFilter: '',
  stopRequested: false,
  startTime: 0,
};

/**
 * MV3 service workers can be recycled mid-run. Checkpointing lets a popup
 * reopened after a worker restart still see accurate progress via
 * getScoringStatus(), instead of silently reporting "not running".
 */
async function checkpoint() {
  if (!chrome.storage.session) return;
  const { isRunning, currentIndex, profiles, scores, failedCount } = scoringState;
  await chrome.storage.session.set({
    [SESSION_KEY]: { isRunning, currentIndex, total: profiles.length, scores, failedCount },
  });
}

export async function restoreCheckpoint() {
  if (!chrome.storage.session) return;
  const { [SESSION_KEY]: saved } = await chrome.storage.session.get(SESSION_KEY);
  if (saved && saved.isRunning) {
    // The worker restarted mid-run; the in-flight batch loop is gone, so mark it stopped
    // rather than falsely claiming to still be scoring.
    scoringState.scores = saved.scores || {};
    scoringState.failedCount = saved.failedCount || 0;
    scoringState.currentIndex = saved.currentIndex || 0;
    // Keep the total accurate so a reopened popup shows "scored X of Y" from the
    // checkpoint instead of "of 0" (getScoringStatus reports profiles.length).
    scoringState.profiles = new Array(saved.total || 0).fill(null);
    scoringState.isRunning = false;
    await checkpoint();
  }
}

async function processBatch(batch, keywords, booleanRule, countryFilter) {
  const results = await Promise.all(batch.map(async (url) => {
    try {
      const data = await fetchProfileData(url);
      const score = computeScore(data, keywords, booleanRule, countryFilter);
      return {
        url,
        score,
        location: data.location || '',
        debug: (data.fullText || '').slice(0, 200),
        success: true,
      };
    } catch (e) {
      return { url, score: 0, location: '', debug: 'ERROR: ' + e.message, success: false };
    }
  }));
  return results;
}

export async function startScoring(data) {
  if (scoringState.isRunning) return;

  scoringState = {
    isRunning: true,
    profiles: data.profiles,
    scores: {},
    currentIndex: 0,
    failedCount: 0,
    keywords: data.keywords,
    booleanRule: data.booleanRule,
    countryFilter: data.countryFilter,
    stopRequested: false,
    startTime: Date.now(),
  };

  chrome.runtime.sendMessage({ type: MESSAGE.SCORING_STARTED, total: scoringState.profiles.length }).catch(() => {});
  await checkpoint();

  const total = scoringState.profiles.length;
  let completed = 0;

  while (completed < total && !scoringState.stopRequested) {
    const batch = scoringState.profiles.slice(completed, completed + BATCH_SIZE);
    const results = await processBatch(batch, scoringState.keywords, scoringState.booleanRule, scoringState.countryFilter);

    for (const result of results) {
      // One structured entry per URL — score, scraped location (for CSV export),
      // the first 200 chars scraped (debug button), and whether the scrape itself
      // succeeded (so the UI can tell a real 0 from a failed fetch).
      scoringState.scores[result.url] = {
        score: result.score,
        location: result.location,
        debug: result.debug,
        success: result.success,
      };
      if (!result.success) scoringState.failedCount++;
    }

    completed += batch.length;
    scoringState.currentIndex = completed;
    await checkpoint();

    const elapsed = Date.now() - scoringState.startTime;
    const avgTimePerProfile = elapsed / completed;
    const remaining = total - completed;
    const eta = avgTimePerProfile * remaining;
    const etaStr = eta > 60000 ? Math.round(eta / 60000) + 'm' : Math.round(eta / 1000) + 's';

    chrome.runtime.sendMessage({
      type: MESSAGE.SCORING_PROGRESS,
      currentIndex: completed,
      total,
      scores: scoringState.scores,
      failedCount: scoringState.failedCount,
      eta: etaStr,
      progress: Math.round((completed / total) * 100),
    }).catch(() => {});

    if (completed < total && !scoringState.stopRequested) {
      await new Promise((r) => setTimeout(r, SCORING_DELAY_MS));
    }
  }

  scoringState.isRunning = false;
  await checkpoint();
  chrome.runtime.sendMessage({
    type: MESSAGE.SCORING_COMPLETE,
    scores: scoringState.scores,
    failedCount: scoringState.failedCount,
  }).catch(() => {});
}

export function stopScoring() {
  scoringState.stopRequested = true;
}

export function getScoringStatus() {
  return {
    isRunning: scoringState.isRunning,
    currentIndex: scoringState.currentIndex,
    total: scoringState.profiles.length,
    scores: scoringState.scores,
    failedCount: scoringState.failedCount,
  };
}

export async function clearCache() {
  profileCache.clear();
  await chrome.storage.local.remove(['profileScores', 'scoringProgress']);
  if (chrome.storage.session) await chrome.storage.session.remove(SESSION_KEY);
}
