import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, boundedRegex } from '../dist/background/scoring.js';

const profile = (fullText, extra = {}) => ({ fullText, headline: '', location: '', ...extra });

test('null / empty profile scores 0', () => {
  assert.equal(computeScore(null, ['java'], '', ''), 0);
  assert.equal(computeScore(profile(''), ['java'], '', ''), 0);
});

test('symbol keywords (c++, c#, .net) actually match', () => {
  // Regression for the \b…\b bug: a word boundary can't sit between "+ +" or
  // before "#", so these common tech keywords used to always score 0.
  assert.ok(computeScore(profile('senior c++ engineer'), ['c++'], '', '') > 0);
  assert.ok(computeScore(profile('strong c# background'), ['c#'], '', '') > 0);
  assert.ok(computeScore(profile('built on .net core'), ['.net'], '', '') > 0);
});

test('plain keywords still match on token boundaries', () => {
  assert.ok(computeScore(profile('java developer'), ['java'], '', '') > 0);
  // Substring-only occurrences must not count: "java" should not match "javascript".
  assert.equal(computeScore(profile('javascript ninja'), ['java'], '', ''), 0);
});

test('country filter matches as a bounded token, not a raw substring', () => {
  const p = profile('Houston, Texas — Java developer', { location: 'Houston, Texas' });
  // "us" is a substring of "hoUSton" but not a bounded token: must NOT pass.
  assert.equal(computeScore(p, ['java'], '', 'us'), 0);
  // The real location token does pass, and then keywords score.
  assert.ok(computeScore(p, ['java'], '', 'texas') > 0);
});

test('boolean rule gates the score to 0 when unmet', () => {
  assert.ok(computeScore(profile('java and python dev'), ['java'], '"java" AND "python"', '') > 0);
  assert.equal(computeScore(profile('java dev only'), ['java'], '"java" AND "python"', ''), 0);
  assert.equal(computeScore(profile('java intern'), ['java'], '"java" NOT "intern"', ''), 0);
});

test('boundedRegex escapes regex metacharacters', () => {
  assert.ok(boundedRegex('c++').test('a c++ b'));
  assert.equal(boundedRegex('c++').test('acquired'), false);
});
