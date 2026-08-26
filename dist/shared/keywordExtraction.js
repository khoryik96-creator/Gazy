import { ruleTerms } from './booleanExpression.js';
const STOP_WORDS = new Set([
    'the',
    'be',
    'to',
    'of',
    'and',
    'a',
    'in',
    'that',
    'have',
    'i',
    'it',
    'for',
    'not',
    'on',
    'with',
    'he',
    'as',
    'you',
    'do',
    'at',
    'this',
    'but',
    'his',
    'by',
    'from',
    'they',
    'we',
    'say',
    'her',
    'she',
    'or',
    'an',
    'will',
    'my',
    'one',
    'all',
    'would',
    'there',
    'their',
    'what',
    'so',
    'up',
    'out',
    'if',
    'about',
    'who',
    'get',
    'which',
    'go',
    'me',
    'when',
    'make',
    'can',
    'like',
    'time',
    'no',
    'just',
    'him',
    'know',
    'take',
    'people',
    'into',
    'year',
    'your',
    'good',
    'some',
    'could',
    'them',
    'see',
    'other',
    'than',
    'then',
    'now',
    'look',
    'only',
    'come',
    'its',
    'over',
    'think',
    'also',
    'back',
    'after',
    'use',
    'two',
    'how',
    'our',
    'work',
    'first',
    'well',
    'way',
    'even',
    'new',
    'want',
    'because',
    'any',
    'these',
    'give',
    'day',
    'most',
    'us',
]);
// Requirement terms we deliberately don't score against: education / degrees and
// language proficiency. These describe eligibility, not the role's skills, and
// otherwise inflate cross-role false positives (a JD's "Bachelor's degree,
// fluent in English" shouldn't reward every profile that mentions a degree or
// English). Applied only to JD-derived keywords — a keyword or Boolean the user
// types explicitly is always respected.
const IGNORED_JD_TERMS = new Set([
    // Education / degrees
    'degree',
    'degrees',
    'bachelor',
    'bachelors',
    'master',
    'masters',
    'phd',
    'doctorate',
    'doctoral',
    'mba',
    'bsc',
    'msc',
    'beng',
    'meng',
    'diploma',
    'diplomas',
    'undergraduate',
    'postgraduate',
    'graduate',
    'graduated',
    'graduation',
    'university',
    'universities',
    'college',
    'education',
    'educational',
    'gpa',
    'cgpa',
    'qualification',
    'qualifications',
    'honours',
    'honors',
    'accredited',
    'major',
    'coursework',
    // Language proficiency
    'language',
    'languages',
    'fluent',
    'fluency',
    'proficiency',
    'proficient',
    'bilingual',
    'multilingual',
    'native',
    'speaker',
    'speaking',
    'verbal',
    'english',
    'malay',
    'bahasa',
    'mandarin',
    'chinese',
    'cantonese',
    'tamil',
    'hindi',
    'spanish',
    'french',
    'german',
    'japanese',
    'korean',
    'arabic',
    'portuguese',
    'russian',
    'italian',
    'dutch',
    'thai',
    'vietnamese',
    'indonesian',
    'tagalog',
    'urdu',
    'bengali',
]);
function isStopword(word) {
    return word.length <= 2 || STOP_WORDS.has(word) || /^\d+$/.test(word);
}
/** True for words we drop from JD-derived keywords: stopwords + ignored terms. */
function isJdNoise(word) {
    return isStopword(word) || IGNORED_JD_TERMS.has(word);
}
export function filterStopwords(words) {
    return words.filter((w) => !isStopword(w));
}
export function extractKeywordsFromJD(jd) {
    if (!jd)
        return '';
    const words = jd
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s#+]/g, ' ')
        .split(/\s+/);
    const wordScores = {};
    words.forEach((w) => {
        if (!isJdNoise(w))
            wordScores[w] = (wordScores[w] || 0) + 1;
    });
    const sorted = Object.entries(wordScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map((e) => e[0]);
    const phrases = [];
    const jdWords = jd.toLowerCase().split(/\s+/);
    for (let i = 0; i < jdWords.length - 2; i++) {
        const trio = jdWords.slice(i, i + 3);
        const phrase = trio.join(' ');
        // Skip a phrase that leads with a stopword or contains an ignored term.
        if (phrase.length > 5 &&
            !STOP_WORDS.has(jdWords[i]) &&
            !STOP_WORDS.has(jdWords[i + 1]) &&
            !trio.some((w) => IGNORED_JD_TERMS.has(w.replace(/[^a-z0-9#+]/g, '')))) {
            phrases.push(phrase);
        }
    }
    const all = [...sorted, ...phrases];
    return [...new Set(all)].slice(0, 10).join(' ');
}
export function extractKeywordsFromBoolean(rule) {
    if (!rule)
        return [];
    // All terms in the rule (quoted phrases AND bare single words), so scoring picks
    // up e.g. `REST AND API` even when nothing is quoted. Best-effort: a rule that
    // can't tokenize yields no keywords rather than throwing here.
    try {
        return ruleTerms(rule)
            .map((t) => t.trim())
            .filter((k) => k.length > 0);
    }
    catch {
        return [];
    }
}
/**
 * Single source of truth for deriving scoring keywords, shared by the popup
 * (query preview) and the background scoring engine (actual scoring) so the
 * two never drift apart.
 */
export function getScoringKeywords({ manual, booleanRule, jd }) {
    const manualKW = manual?.trim() || '';
    if (manualKW)
        return filterStopwords(manualKW.split(/\s+/));
    const boolKeywords = extractKeywordsFromBoolean(booleanRule || '');
    if (boolKeywords.length > 0)
        return boolKeywords;
    if (jd?.trim()) {
        return extractKeywordsFromJD(jd)
            .split(/\s+/)
            .filter((k) => k.length > 2);
    }
    return [];
}
