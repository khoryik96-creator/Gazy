import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBoolean, compileBooleanRule } from '../dist/shared/booleanExpression.js';

test('AND requires both terms', () => {
  assert.equal(evaluateBoolean('react and aws experience', '"React" AND "AWS"'), true);
  assert.equal(evaluateBoolean('react only, no cloud', '"React" AND "AWS"'), false);
});

test('OR matches either term', () => {
  assert.equal(evaluateBoolean('aws certified', '"React" OR "AWS"'), true);
  assert.equal(evaluateBoolean('vue developer', '"React" OR "AWS"'), false);
});

test('NOT excludes a term', () => {
  assert.equal(evaluateBoolean('senior engineer', '"Senior" NOT "Intern"'), true);
  assert.equal(evaluateBoolean('senior intern', '"Senior" NOT "Intern"'), false);
});

test('quoted terms are literals, never confused with operators', () => {
  // Regression: the pre-tokenizer implementation blind-replaced AND/OR/NOT as
  // substrings, so a quoted keyword containing those letters ("Android", "Brand",
  // "Corn") broke. Quoted content must be treated as a plain literal.
  assert.equal(evaluateBoolean('android developer', '"Android"'), true);
  assert.equal(evaluateBoolean('brand manager', '"Brand"'), true);
});

test('parentheses group sub-expressions', () => {
  assert.equal(evaluateBoolean('java and aws', '("Java" OR "Python") AND "AWS"'), true);
  assert.equal(evaluateBoolean('python developer', '("Java" OR "Python") AND "AWS"'), false);
});

test('empty rule compiles to always-true', () => {
  assert.equal(compileBooleanRule('')('anything'), true);
  assert.equal(compileBooleanRule('   ')('anything'), true);
});

test('malformed rules throw', () => {
  assert.throws(() => evaluateBoolean('x', '"unclosed'));
  assert.throws(() => evaluateBoolean('x', 'AND'));
  assert.throws(() => evaluateBoolean('x', '("Java" AND "AWS"'));
});

test('bare single-word terms need no quotes (LinkedIn convention)', () => {
  // Only AND/OR/NOT (uppercase) are operators; every other bare word is a term.
  assert.equal(evaluateBoolean('senior react aws engineer', 'React AND AWS'), true);
  assert.equal(evaluateBoolean('react only', 'React AND AWS'), false);
  assert.equal(evaluateBoolean('rest api integration', 'REST AND API'), true);
  // The user's real rule: REST AND (Mandarin OR Chinese) AND Integration AND API.
  const rule = 'REST AND (Mandarin OR Chinese) AND Integration AND API AND solution';
  assert.equal(evaluateBoolean('rest api integration solution, mandarin speaker', rule), true);
  assert.equal(evaluateBoolean('rest api integration solution, german speaker', rule), false);
  // Symbol terms work bare too.
  assert.equal(evaluateBoolean('strong c++ background', 'c++'), true);
});

test('genuinely malformed rules still throw so the popup can pre-validate', () => {
  assert.throws(() => compileBooleanRule('"React" AND')); // trailing operator
  assert.throws(() => compileBooleanRule('("React" OR "AWS"')); // unbalanced parens
  assert.throws(() => compileBooleanRule('AND "React"')); // leading operator
  assert.throws(() => compileBooleanRule('React AWS')); // two terms, no operator
});
