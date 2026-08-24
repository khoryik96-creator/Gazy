import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleOf, prettyName, nameFromUrl } from '../dist/shared/nameFormat.js';
import {
  buildCandidateRows,
  buildCandidateCsv,
  exportFilename,
} from '../dist/shared/candidateExport.js';

const A = 'https://www.linkedin.com/in/sarah-chen-1a2b3c';
const B = 'https://www.linkedin.com/in/marcus-rivera';

test('handleOf pulls the /in/ slug', () => {
  assert.equal(handleOf(A), 'sarah-chen-1a2b3c');
  assert.equal(handleOf('https://x.com/nope'), '');
});

test('prettyName title-cases and drops id-ish tokens', () => {
  assert.equal(prettyName('sarah-chen-1a2b3c'), 'Sarah Chen');
  assert.equal(prettyName('marcus-rivera'), 'Marcus Rivera');
  assert.equal(nameFromUrl(A), 'Sarah Chen');
});

test('buildCandidateRows: lean columns when no AI/folders', () => {
  const rows = buildCandidateRows([
    { url: A, score: 92, ai: null, location: 'San Francisco', folders: [] },
    { url: B, score: null, ai: null, location: '', folders: [] },
  ]);
  assert.deepEqual(rows[0], ['Name', 'URL', 'Score', 'Location']);
  assert.deepEqual(rows[1], ['Sarah Chen', A, 92, 'San Francisco']);
  assert.deepEqual(rows[2], ['Marcus Rivera', B, '—', '']);
});

test('buildCandidateRows: adds AI and Folders columns when present', () => {
  const rows = buildCandidateRows([
    { url: A, score: 92, ai: 95, location: 'SF', folders: ['Strong', 'Phone screen'] },
    { url: B, score: 80, ai: null, location: 'Austin', folders: [] },
  ]);
  assert.deepEqual(rows[0], ['Name', 'URL', 'Score', 'Location', 'AI Score', 'Folders']);
  assert.deepEqual(rows[1], ['Sarah Chen', A, 92, 'SF', 95, 'Strong; Phone screen']);
  assert.deepEqual(rows[2], ['Marcus Rivera', B, 80, 'Austin', '—', '']);
});

test('buildCandidateCsv escapes and quotes fields', () => {
  const csv = buildCandidateCsv([
    { url: A, score: 92, ai: null, location: 'San Francisco', folders: [] },
  ]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"Name","URL","Score","Location"');
  assert.equal(lines[1], '"Sarah Chen","' + A + '","92","San Francisco"');
});

test('exportFilename slugs the scope safely', () => {
  assert.equal(exportFilename('Phone screen', 42), 'gazy_phone-screen_42.csv');
  assert.equal(exportFilename('All', 42), 'gazy_all_42.csv');
  assert.equal(exportFilename('!!!', 42), 'gazy_candidates_42.csv');
});
