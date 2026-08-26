import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRIES, canonicalCountry } from '../dist/shared/countries.js';

test('COUNTRIES includes expected entries and no duplicates', () => {
  assert.ok(COUNTRIES.includes('Malaysia'));
  assert.ok(COUNTRIES.includes('United States'));
  assert.equal(new Set(COUNTRIES).size, COUNTRIES.length);
});

test('canonicalCountry normalises case and trims', () => {
  assert.equal(canonicalCountry('malaysia'), 'Malaysia');
  assert.equal(canonicalCountry('  MALAYSIA  '), 'Malaysia');
  assert.equal(canonicalCountry('United states'), 'United States');
});

test('canonicalCountry resolves common aliases', () => {
  assert.equal(canonicalCountry('USA'), 'United States');
  assert.equal(canonicalCountry('uk'), 'United Kingdom');
  assert.equal(canonicalCountry('UAE'), 'United Arab Emirates');
});

test('canonicalCountry leaves non-country free text unchanged', () => {
  assert.equal(canonicalCountry('Kuala Lumpur'), 'Kuala Lumpur');
  assert.equal(canonicalCountry(''), '');
  assert.equal(canonicalCountry('  '), '');
});
