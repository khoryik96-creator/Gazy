const STOP_WORDS = new Set<string>([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not',
  'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from',
  'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would',
  'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which',
  'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
  'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see',
  'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think',
  'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
  'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
]);

function isStopword(word: string): boolean {
  return word.length <= 2 || STOP_WORDS.has(word) || /^\d+$/.test(word);
}

export function filterStopwords(words: string[]): string[] {
  return words.filter((w) => !isStopword(w));
}

export function extractKeywordsFromJD(jd: string): string {
  if (!jd) return '';
  const words = jd.toLowerCase().replace(/[^a-zA-Z0-9\s#+]/g, ' ').split(/\s+/);
  const wordScores: Record<string, number> = {};
  words.forEach((w) => {
    if (!isStopword(w)) wordScores[w] = (wordScores[w] || 0) + 1;
  });
  const sorted = Object.entries(wordScores).sort((a, b) => b[1] - a[1]).slice(0, 8).map((e) => e[0]);

  const phrases: string[] = [];
  const jdWords = jd.toLowerCase().split(/\s+/);
  for (let i = 0; i < jdWords.length - 2; i++) {
    const phrase = jdWords.slice(i, i + 3).join(' ');
    if (phrase.length > 5 && !STOP_WORDS.has(jdWords[i]) && !STOP_WORDS.has(jdWords[i + 1])) {
      phrases.push(phrase);
    }
  }

  const all = [...sorted, ...phrases];
  return [...new Set(all)].slice(0, 10).join(' ');
}

export function extractKeywordsFromBoolean(rule: string): string[] {
  if (!rule) return [];
  const matches = rule.match(/(["'])([^"']*)\1/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1).trim()).filter((k) => k.length > 0);
}

interface KeywordSources {
  manual?: string;
  booleanRule?: string;
  jd?: string;
}

/**
 * Single source of truth for deriving scoring keywords, shared by the popup
 * (query preview) and the background scoring engine (actual scoring) so the
 * two never drift apart.
 */
export function getScoringKeywords({ manual, booleanRule, jd }: KeywordSources): string[] {
  const manualKW = manual?.trim() || '';
  if (manualKW) return filterStopwords(manualKW.split(/\s+/));

  const boolKeywords = extractKeywordsFromBoolean(booleanRule || '');
  if (boolKeywords.length > 0) return boolKeywords;

  if (jd?.trim()) {
    return extractKeywordsFromJD(jd).split(/\s+/).filter((k) => k.length > 2);
  }

  return [];
}
