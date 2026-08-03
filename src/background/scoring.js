import { evaluateBoolean } from '../shared/booleanExpression.js';

/**
 * Scores a scraped profile against keywords/boolean rule/country filter.
 * Returns 0-100. Throws only on a malformed Boolean rule (surfaced to the UI).
 */
export function computeScore(profileData, scoringKeywords, booleanRule, countryFilter) {
  if (!profileData) return 0;
  const text = profileData.fullText.toLowerCase();

  if (booleanRule && booleanRule.trim()) {
    if (!evaluateBoolean(text, booleanRule)) return 0;
  }

  if (countryFilter && countryFilter.trim()) {
    const needle = countryFilter.toLowerCase().trim();
    const loc = (profileData.location || '').toLowerCase();
    // The dedicated location field is scraped from fragile LinkedIn selectors and
    // is often empty; fall back to the full page text so a working country filter
    // doesn't zero out every profile just because the location node wasn't found.
    if (!loc.includes(needle) && !text.includes(needle)) return 0;
  }

  let keywordScore = 0;
  const uniqueKeywords = [...new Set(scoringKeywords)];
  if (uniqueKeywords.length > 0) {
    let matchCount = 0;
    uniqueKeywords.forEach((kw) => {
      const regex = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      const matches = text.match(regex);
      if (matches) matchCount += matches.length;
    });
    const maxPossible = uniqueKeywords.length * 3;
    keywordScore = Math.min(100, (matchCount / maxPossible) * 100);
  }

  let titleScore = 0;
  if (uniqueKeywords.length > 0 && profileData.headline) {
    const titleWords = uniqueKeywords.filter((k) => k.length > 3);
    const headlineLower = profileData.headline.toLowerCase();
    titleWords.forEach((kw) => {
      if (headlineLower.includes(kw)) titleScore += 10;
    });
    titleScore = Math.min(30, titleScore);
  }

  let expScore = 0;
  const expMatches = text.match(/\b(\d+)\s*(?:years?|yrs?)\b/gi);
  if (expMatches) {
    const years = expMatches.map((m) => parseInt(m.match(/\d+/)[0], 10)).filter((y) => y > 0 && y < 60);
    if (years.length > 0) {
      const avg = years.reduce((a, b) => a + b, 0) / years.length;
      if (avg >= 3 && avg <= 10) expScore = 20;
      else if (avg > 10) expScore = 15;
      else if (avg >= 1) expScore = 10;
    }
  }

  const finalScore = Math.round(Math.min(100, keywordScore * 0.6 + titleScore + expScore));
  return isNaN(finalScore) ? 0 : finalScore;
}
