import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getScoringKeywords,
  extractKeywordsFromBoolean,
  filterStopwords,
} from '../dist/shared/keywordExtraction.js';

test('manual keywords take precedence and drop stopwords', () => {
  assert.deepEqual(
    getScoringKeywords({ manual: 'java python', booleanRule: '"React"', jd: 'ignored' }),
    ['java', 'python'],
  );
  assert.deepEqual(getScoringKeywords({ manual: 'the java' }), ['java']);
});

test('falls back to boolean-quoted terms when no manual keywords', () => {
  assert.deepEqual(getScoringKeywords({ manual: '', booleanRule: '"React" AND "AWS"' }), [
    'React',
    'AWS',
  ]);
});

test('falls back to the JD when no manual or boolean input', () => {
  const kws = getScoringKeywords({
    manual: '',
    booleanRule: '',
    jd: 'Senior Python developer, Python and cloud',
  });
  assert.ok(kws.length > 0);
  assert.ok(kws.includes('python'));
});

test('no input yields no keywords', () => {
  assert.deepEqual(getScoringKeywords({}), []);
});

test('extractKeywordsFromBoolean captures quoted and bare terms, drops operators', () => {
  assert.deepEqual(extractKeywordsFromBoolean('"React" AND "Node.js"'), ['React', 'Node.js']);
  // Bare (unquoted) single-word terms are now captured; AND/OR/NOT/parens are not.
  assert.deepEqual(extractKeywordsFromBoolean('REST AND (Mandarin OR Chinese) AND API'), [
    'REST',
    'Mandarin',
    'Chinese',
    'API',
  ]);
  // A rule that can't tokenize yields no keywords rather than throwing.
  assert.deepEqual(extractKeywordsFromBoolean('%%%'), []);
});

test('filterStopwords removes short and common words', () => {
  assert.deepEqual(filterStopwords(['the', 'go', 'kubernetes']), ['kubernetes']);
});
