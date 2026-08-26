import { AI_MAX_PROFILE_CHARS } from './constants.js';
/**
 * Pure prompt/parse helpers for the optional DeepSeek evaluation. Kept free of
 * chrome.* / fetch so they can be unit-tested in plain Node. The network call
 * lives in background/deepseek.ts.
 */
/** Builds the system + user messages sent to the chat-completions endpoint. */
export function buildEvaluationMessages(jd, profileText) {
    const system = 'You are a technical recruiter screening LinkedIn profiles against a role. ' +
        'Judge how well the candidate fits the requirements, weighting the actual ROLE and ' +
        'core responsibilities/skills most heavily. Reward relevant and transferable skills and ' +
        'seniority; do not reward keyword stuffing. ' +
        'IGNORE education, degrees, and language-proficiency requirements entirely — do not let ' +
        'them raise or lower the score, and do not list them in matched/missing. ' +
        'If the candidate is in a clearly different function from the role (e.g. a data scientist ' +
        'for a product owner role), score low even when generic keywords overlap. ' +
        'Respond with ONLY a JSON object of this exact shape, no prose, no markdown: ' +
        '{"score": <integer 0-100>, "reason": "<one sentence>", ' +
        '"matched": ["<requirement>", ...], "missing": ["<requirement>", ...]}. ' +
        'score is overall fit (100 = ideal).';
    const requirements = jd.trim() || '(no requirements provided)';
    const profile = profileText.slice(0, AI_MAX_PROFILE_CHARS).trim() || '(no profile text scraped)';
    const user = 'ROLE / REQUIREMENTS:\n' + requirements + '\n\n' + 'CANDIDATE PROFILE:\n' + profile;
    return { system, user };
}
function clampScore(value) {
    const n = typeof value === 'number' ? value : parseInt(String(value), 10);
    if (!Number.isFinite(n))
        return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
}
function toStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.map((v) => String(v)).filter((s) => s.trim().length > 0);
}
/**
 * Parses the model's reply into an AiEvalEntry. Tolerant: the model may wrap the
 * JSON in prose or a ```json fence, so we extract the first {...} block. Throws
 * only when no JSON object can be found at all.
 */
export function parseEvaluationResponse(raw) {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) {
        throw new Error('No JSON object found in model response.');
    }
    const json = raw.slice(start, end + 1);
    const parsed = JSON.parse(json);
    return {
        score: clampScore(parsed.score),
        reason: typeof parsed.reason === 'string' ? parsed.reason : '',
        matched: toStringArray(parsed.matched),
        missing: toStringArray(parsed.missing),
    };
}
