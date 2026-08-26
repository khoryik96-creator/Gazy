import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyFolderStore,
  normalizeFolderName,
  normalizeFolderStore,
  createFolder,
  renameFolder,
  deleteFolder,
  toggleMembership,
  addMembership,
  removeUrlsFromFolders,
  foldersForUrl,
  folderCount,
} from '../dist/shared/folders.js';

const A = 'https://www.linkedin.com/in/a';
const B = 'https://www.linkedin.com/in/b';

test('emptyFolderStore is empty', () => {
  const s = emptyFolderStore();
  assert.deepEqual(s, { order: [], members: {} });
});

test('normalizeFolderName trims, collapses whitespace, caps length', () => {
  assert.equal(normalizeFolderName('  Phone   screen '), 'Phone screen');
  assert.equal(normalizeFolderName(42), '');
  assert.equal(normalizeFolderName(''), '');
  assert.equal(normalizeFolderName('x'.repeat(60)).length, 40);
});

test('createFolder adds a folder; ignores blank and duplicates', () => {
  let s = createFolder(emptyFolderStore(), 'Strong');
  assert.deepEqual(s.order, ['Strong']);
  assert.deepEqual(s.members.Strong, []);
  s = createFolder(s, '  '); // blank → no-op
  s = createFolder(s, 'Strong'); // dup → no-op
  assert.deepEqual(s.order, ['Strong']);
});

test('createFolder is immutable (does not mutate input)', () => {
  const s0 = emptyFolderStore();
  createFolder(s0, 'X');
  assert.deepEqual(s0.order, []);
});

test('toggleMembership adds then removes; unknown folder is a no-op', () => {
  let s = createFolder(emptyFolderStore(), 'Strong');
  s = toggleMembership(s, 'Strong', A);
  assert.deepEqual(s.members.Strong, [A]);
  s = toggleMembership(s, 'Strong', A);
  assert.deepEqual(s.members.Strong, []);
  const same = toggleMembership(s, 'Missing', A);
  assert.equal(same, s); // unchanged reference
});

test('addMembership adds once and is idempotent; unknown folder is a no-op', () => {
  let s = createFolder(emptyFolderStore(), 'Strong');
  s = addMembership(s, 'Strong', A);
  assert.deepEqual(s.members.Strong, [A]);
  const again = addMembership(s, 'Strong', A); // already a member
  assert.equal(again, s); // unchanged reference
  const missing = addMembership(s, 'Nope', A); // unknown folder
  assert.equal(missing, s);
});

test('foldersForUrl returns membership in display order', () => {
  let s = createFolder(createFolder(emptyFolderStore(), 'One'), 'Two');
  s = toggleMembership(s, 'Two', A);
  s = toggleMembership(s, 'One', A);
  s = toggleMembership(s, 'Two', B);
  assert.deepEqual(foldersForUrl(s, A), ['One', 'Two']);
  assert.deepEqual(foldersForUrl(s, B), ['Two']);
  assert.equal(folderCount(s, 'Two'), 2);
});

test('renameFolder keeps position and members; blocks collision', () => {
  let s = createFolder(createFolder(emptyFolderStore(), 'One'), 'Two');
  s = toggleMembership(s, 'One', A);
  s = renameFolder(s, 'One', 'Uno');
  assert.deepEqual(s.order, ['Uno', 'Two']);
  assert.deepEqual(s.members.Uno, [A]);
  assert.equal(s.members.One, undefined);
  const blocked = renameFolder(s, 'Two', 'Uno'); // collision → no-op
  assert.equal(blocked, s);
});

test('removeUrlsFromFolders strips urls from every folder, keeps folders', () => {
  let s = createFolder(createFolder(emptyFolderStore(), 'One'), 'Two');
  s = toggleMembership(s, 'One', A);
  s = toggleMembership(s, 'One', B);
  s = toggleMembership(s, 'Two', A);
  s = removeUrlsFromFolders(s, new Set([A]));
  assert.deepEqual(s.order, ['One', 'Two']);
  assert.deepEqual(s.members.One, [B]);
  assert.deepEqual(s.members.Two, []);
});

test('deleteFolder drops the folder only', () => {
  let s = createFolder(createFolder(emptyFolderStore(), 'One'), 'Two');
  s = toggleMembership(s, 'One', A);
  s = deleteFolder(s, 'One');
  assert.deepEqual(s.order, ['Two']);
  assert.equal(s.members.One, undefined);
});

test('normalizeFolderStore tolerates junk and dedupes urls', () => {
  const s = normalizeFolderStore({
    order: ['Good', 'Good', 42, ''],
    members: { Good: [A, A, B, 7], Orphan: [A] },
  });
  assert.deepEqual(s.order, ['Good']);
  assert.deepEqual(s.members.Good, [A, B]);
});

test('normalizeFolderStore derives order from members when order missing', () => {
  const s = normalizeFolderStore({ members: { X: [A] } });
  assert.deepEqual(s.order, ['X']);
  assert.deepEqual(s.members.X, [A]);
});

test('normalizeFolderStore on garbage returns empty store', () => {
  assert.deepEqual(normalizeFolderStore(null), emptyFolderStore());
  assert.deepEqual(normalizeFolderStore('nope'), emptyFolderStore());
});
