import { BATCH_SIZE, SCORING_DELAY_MIN_MS, SCORING_DELAY_MAX_MS, MESSAGE, } from '../shared/constants.js';
import { randomDelayMs, sleep } from '../shared/timing.js';
import { fetchProfileData } from './profileFetcher.js';
import { computeScore } from './scoring.js';
import { compileBooleanRule } from '../shared/booleanExpression.js';
import { profileCache } from './cache.js';
import { getStorage } from '../shared/storage.js';
import { mergeIntoStored } from '../shared/resultMerge.js';
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
    if (!chrome.storage.session)
        return;
    const { isRunning, currentIndex, profiles, scores, failedCount } = scoringState;
    await chrome.storage.session.set({
        [SESSION_KEY]: { isRunning, currentIndex, total: profiles.length, scores, failedCount },
    });
}
/**
 * Durably persist scores to chrome.storage.local from the BACKGROUND, so they
 * survive the popup closing (Chrome closes the popup the instant you switch
 * tabs) and are readable by the dashboard. Previously only the popup wrote this
 * on SCORING_COMPLETE — if the popup was shut, scores were lost.
 *
 * `scoringState.scores` is seeded from storage at the start of the run (see
 * seedScoresFromStorage), so writing it back preserves candidates outside this
 * run — a subset run must never wipe everyone else's scores.
 */
async function persistScoresLocal() {
    await chrome.storage.local.set({ profileScores: scoringState.scores });
}
/**
 * Seed the run's score map with everything already saved, so a run covering only
 * a SUBSET of candidates (dashboard "Retry failed" / "Score selected" / a folder
 * view) merges into the stored map instead of replacing it. Mirrors
 * runAiEvalLoop, which seeds from stored aiEvals for the same reason.
 */
async function seedScoresFromStorage() {
    const stored = await getStorage(['profileScores']);
    scoringState.scores = mergeIntoStored(stored.profileScores, scoringState.scores);
}
export async function restoreCheckpoint() {
    if (!chrome.storage.session)
        return;
    const stored = await chrome.storage.session.get(SESSION_KEY);
    const saved = stored[SESSION_KEY];
    if (saved && saved.isRunning) {
        // The worker restarted mid-run; the in-flight batch loop is gone, so mark it stopped
        // rather than falsely claiming to still be scoring.
        scoringState.scores = saved.scores || {};
        scoringState.failedCount = saved.failedCount || 0;
        scoringState.currentIndex = saved.currentIndex || 0;
        // Keep the total accurate so a reopened popup shows "scored X of Y" from the
        // checkpoint instead of "of 0" (getScoringStatus reports profiles.length).
        scoringState.profiles = new Array(saved.total || 0).fill('');
        scoringState.isRunning = false;
        await checkpoint();
    }
}
async function processBatch(batch, keywords, booleanMatches, countryFilter) {
    const results = await Promise.all(batch.map(async (url) => {
        try {
            const data = await fetchProfileData(url);
            const score = computeScore(data, keywords, booleanMatches, countryFilter);
            return {
                url,
                score,
                location: data.location || '',
                debug: (data.fullText || '').slice(0, 200),
                success: true,
            };
        }
        catch (e) {
            return {
                url,
                score: 0,
                location: '',
                debug: 'ERROR: ' + e.message,
                success: false,
            };
        }
    }));
    return results;
}
/**
 * Kicks off a scoring run and returns immediately. The actual loop runs detached
 * (runScoringLoop) — critically, we do NOT make the caller await the whole run.
 * The messaging layer acks 'started' synchronously; if it instead awaited the
 * loop, the MV3 service worker could be recycled before the loop finished and
 * the ack would never arrive, surfacing as "Failed to start: unknown" in the UI.
 * Validation (an invalid Boolean rule) throws synchronously so the caller can
 * still report it as a start error.
 */
export function startScoring(data) {
    if (scoringState.isRunning)
        return;
    // Compile the Boolean rule ONCE for the whole run (not per profile). Done before
    // any state is marked running, so an invalid rule throws cleanly here and the
    // caller shows the error — instead of every profile throwing mid-run. (The popup
    // also pre-validates; this is the defence-in-depth backstop.)
    const booleanMatches = compileBooleanRule(data.booleanRule);
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
    chrome.runtime
        .sendMessage({ type: MESSAGE.SCORING_STARTED, total: scoringState.profiles.length })
        .catch(() => { });
    void runScoringLoop(booleanMatches);
}
async function runScoringLoop(booleanMatches) {
    // Must happen before the first persist, or this run would overwrite the scores
    // of every candidate it doesn't cover.
    await seedScoresFromStorage();
    await checkpoint();
    const total = scoringState.profiles.length;
    let completed = 0;
    while (completed < total && !scoringState.stopRequested) {
        const batch = scoringState.profiles.slice(completed, completed + BATCH_SIZE);
        const results = await processBatch(batch, scoringState.keywords, booleanMatches, scoringState.countryFilter);
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
            if (!result.success)
                scoringState.failedCount++;
        }
        completed += batch.length;
        scoringState.currentIndex = completed;
        await checkpoint();
        await persistScoresLocal();
        const elapsed = Date.now() - scoringState.startTime;
        const avgTimePerProfile = elapsed / completed;
        const remaining = total - completed;
        const eta = avgTimePerProfile * remaining;
        const etaStr = eta > 60000 ? Math.round(eta / 60000) + 'm' : Math.round(eta / 1000) + 's';
        chrome.runtime
            .sendMessage({
            type: MESSAGE.SCORING_PROGRESS,
            currentIndex: completed,
            total,
            scores: scoringState.scores,
            failedCount: scoringState.failedCount,
            eta: etaStr,
            progress: Math.round((completed / total) * 100),
        })
            .catch(() => { });
        if (completed < total && !scoringState.stopRequested) {
            // Randomised gap between profiles so views don't land on a fixed interval.
            await sleep(randomDelayMs(SCORING_DELAY_MIN_MS, SCORING_DELAY_MAX_MS));
        }
    }
    scoringState.isRunning = false;
    await checkpoint();
    await persistScoresLocal();
    chrome.runtime
        .sendMessage({
        type: MESSAGE.SCORING_COMPLETE,
        scores: scoringState.scores,
        failedCount: scoringState.failedCount,
    })
        .catch(() => { });
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
    if (chrome.storage.session)
        await chrome.storage.session.remove(SESSION_KEY);
}
