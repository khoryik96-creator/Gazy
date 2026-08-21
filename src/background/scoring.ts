import { compileBooleanRule, type RuleEvaluator } from '../shared/booleanExpression.js';
import type { ProfilePageData } from '../shared/types.js';

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

/**
 * Builds a case-insensitive regex that matches `term` as a whole token, using
 * alphanumeric lookarounds instead of `\b`. Unlike `\b`, this matches keywords
 * that begin or end with symbols — `c++`, `c#`, `.net`, `node.js` — which the
 * old `\b…\b` wrapper silently failed to score (a `\b` can't sit between two
 * non-word characters like `+ +`).
 */
export function boundedRegex(term: string, flags = 'gi'): RegExp {
  const escaped = term.replace(REGEX_SPECIAL, '\\$&');
  return new RegExp('(?<![a-z0-9])' + escaped + '(?![a-z0-9])', flags);
}

/**
 * Scores a scraped profile against keywords/boolean rule/country filter.
 * Returns 0-100. Throws only on a malformed Boolean rule (surfaced to the UI).
 */
export function computeScore(
  profileData: ProfilePageData | null | undefined,
  scoringKeywords: string[],
  // A rule string (compiled here) or a pre-compiled evaluator. The scoring engine
  // passes the compiled evaluator so the rule is parsed once per run, not once per
  // profile; tests and ad-hoc callers can still pass a plain string.
  booleanRule: string | RuleEvaluator,
  countryFilter: string,
): number {
  if (!profileData) return 0;
  const text = profileData.fullText.toLowerCase();

  const booleanMatches: RuleEvaluator =
    typeof booleanRule === 'function' ? booleanRule : compileBooleanRule(booleanRule);
  if (!booleanMatches(text)) return 0;

  if (countryFilter && countryFilter.trim()) {
    const needle = countryFilter.toLowerCase().trim();
    const loc = (profileData.location || '').toLowerCase();
    // The dedicated location field is scraped from fragile LinkedIn selectors and
    // is often empty; fall back to the full page text so a working country filter
    // doesn't zero out every profile just because the location node wasn't found.
    // Match as a bounded token, not a raw substring, so a short filter like "us"
    // doesn't spuriously match "hoUSton" (and "in" doesn't match "berlIN").
    const countryRe = boundedRegex(needle, 'i');
    if (!countryRe.test(loc) && !countryRe.test(text)) return 0;
  }

  // Coverage is the dominant signal: of the DISTINCT skills searched for, how
  // many does the profile actually mention at least once? This answers the
  // question a recruiter cares about ("does this person have React AND AWS AND
  // Python?"). The previous formula summed raw keyword occurrences, so a profile
  // repeating one word many times could outscore a genuine broad match — the
  // main reason scores felt inaccurate.
  const uniqueKeywords = [...new Set(scoringKeywords)];
  const totalKeywords = uniqueKeywords.length;

  let matched = 0;
  let matchedInHeadline = 0;
  const headlineLower = (profileData.headline || '').toLowerCase();
  for (const kw of uniqueKeywords) {
    if (boundedRegex(kw).test(text)) {
      matched++;
      if (kw.length > 3 && headlineLower.includes(kw)) matchedInHeadline++;
    }
  }

  // 0-80 points: the fraction of searched skills present. Full coverage → 80,
  // leaving headroom for the two bonuses below to reach 100.
  const coverageScore = totalKeywords > 0 ? (matched / totalKeywords) * 80 : 0;

  // Up to 12 points: skills that appear in the headline are a strong signal the
  // skill is central to this person, not incidental page text.
  const titleBonus = Math.min(12, matchedInHeadline * 6);

  // Up to 8 points: a plausible amount of experience mentioned on the page.
  let expBonus = 0;
  const expMatches = text.match(/\b(\d+)\s*(?:years?|yrs?)\b/gi);
  if (expMatches) {
    const years = expMatches
      .map((m) => parseInt(m.match(/\d+/)![0], 10))
      .filter((y) => y > 0 && y < 60);
    if (years.length > 0) {
      const avg = years.reduce((a, b) => a + b, 0) / years.length;
      if (avg >= 3 && avg <= 10) expBonus = 8;
      else if (avg > 10) expBonus = 6;
      else if (avg >= 1) expBonus = 4;
    }
  }

  const finalScore = Math.round(Math.min(100, coverageScore + titleBonus + expBonus));
  return isNaN(finalScore) ? 0 : finalScore;
}
