import { dom } from './dom.js';
import { extractKeywordsFromJD, getScoringKeywords } from '../shared/keywordExtraction.js';

export function getSearchQuery(): string {
  const manual = dom.keywordsInput.value.trim();
  if (manual) return manual;

  const rule = dom.booleanRuleInput.value.trim();
  if (rule) return rule;

  if (dom.jdInput.value.trim()) return extractKeywordsFromJD(dom.jdInput.value);
  return '';
}

export function getCurrentScoringKeywords(): string[] {
  return getScoringKeywords({
    manual: dom.keywordsInput.value,
    booleanRule: dom.booleanRuleInput.value,
    jd: dom.jdInput.value,
  });
}
