import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  serializeWorkspace,
  parseWorkspace,
  isWorkspaceKey,
  keysToClearOnRestore,
  WORKSPACE_KEYS,
} from '../dist/shared/workspaceBackup.js';

const sample = {
  profiles: ['https://www.linkedin.com/in/alice'],
  folders: { order: ['F'], members: { F: ['https://www.linkedin.com/in/alice'] } },
  uiTheme: 'beacon',
  aiKey: 'sk-secret-should-not-be-exported',
  lastRemoved: { urls: [] },
};

test('serialize excludes the API key and ephemeral undo snapshot', () => {
  const json = serializeWorkspace(sample);
  assert.ok(!json.includes('sk-secret'), 'aiKey must never be in a backup');
  assert.ok(!json.includes('lastRemoved'));
  assert.ok(json.includes('profiles'));
  assert.ok(json.includes('beacon'));
});

test('round-trips recognised keys and drops unknown/secret ones', () => {
  const json = serializeWorkspace(sample, '1.29.0');
  const { data, keyCount } = parseWorkspace(json);
  assert.deepEqual(data.profiles, sample.profiles);
  assert.deepEqual(data.folders, sample.folders);
  assert.equal(data.uiTheme, 'beacon');
  assert.equal('aiKey' in data, false);
  assert.equal('lastRemoved' in data, false);
  assert.equal(keyCount, 3);
});

test('parse throws a friendly error on non-JSON', () => {
  assert.throws(() => parseWorkspace('not json {'), /valid JSON/i);
});

test('parse rejects a file that is not a Gazy workspace', () => {
  assert.throws(() => parseWorkspace(JSON.stringify({ hello: 'world' })), /Gazy workspace/i);
});

test('parse rejects a backup from a newer format version', () => {
  const future = JSON.stringify({ format: 'gazy-workspace', version: 99, data: {} });
  assert.throws(() => parseWorkspace(future), /newer version/i);
});

test('parse tolerates a hand-edited file with extra keys, keeping only known ones', () => {
  const raw = JSON.stringify({
    format: 'gazy-workspace',
    version: 1,
    data: { profiles: ['x'], somethingElse: 1, aiKey: 'sk-nope' },
  });
  const { data } = parseWorkspace(raw);
  assert.deepEqual(Object.keys(data), ['profiles']);
});

test('restore clears workspace keys the backup does not carry (true replace)', () => {
  // Restoring a backup taken before you had folders must leave you with NO
  // folders — not your current ones surviving alongside the restored data.
  const partial = { profiles: ['x'], uiTheme: 'beacon' };
  const toClear = keysToClearOnRestore(partial);
  assert.ok(toClear.includes('folders'), 'folders absent from backup → must be cleared');
  assert.ok(toClear.includes('shortlist'));
  assert.ok(toClear.includes('profileScores'));
  // Keys the backup DOES carry are written, not cleared.
  assert.equal(toClear.includes('profiles'), false);
  assert.equal(toClear.includes('uiTheme'), false);
  // The API key is not a workspace key, so a restore never touches it.
  assert.equal(toClear.includes('aiKey'), false);
});

test('a full backup clears nothing', () => {
  const full = Object.fromEntries(WORKSPACE_KEYS.map((k) => [k, null]));
  assert.deepEqual(keysToClearOnRestore(full), []);
});

test('isWorkspaceKey covers the documented set and excludes aiKey', () => {
  assert.equal(isWorkspaceKey('folders'), true);
  assert.equal(isWorkspaceKey('aiKey'), false);
  assert.equal(WORKSPACE_KEYS.includes('aiKey'), false);
});
