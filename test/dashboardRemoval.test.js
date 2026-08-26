import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRemoveFromResults,
  computeRemoveFromFolder,
  computeRemoveFromShortlist,
  computeUndo,
} from '../dist/dashboard/removal.js';

const U = {
  a: 'https://www.linkedin.com/in/alice',
  b: 'https://www.linkedin.com/in/bob',
  c: 'https://www.linkedin.com/in/carol',
};

const folders = (order, members) => ({ order, members });

function baseState() {
  return {
    profiles: [U.a, U.b, U.c],
    scores: {
      [U.a]: { success: true, score: 10, location: '' },
      [U.b]: { success: true, score: 20, location: '' },
      [U.c]: { success: true, score: 30, location: '' },
    },
    aiEvals: { [U.a]: { score: 90 } },
    shortlist: new Set([U.b]),
    folders: folders(['F'], { F: [U.c] }),
  };
}

test('removeFromResults: drops from results but KEEPS folder/shortlist data', () => {
  const s = baseState();
  const next = computeRemoveFromResults(s, new Set([U.b, U.c]));
  // b (shortlisted) and c (in folder F) leave the results list...
  assert.deepEqual(next.profiles, [U.a]);
  // ...but their scores are NOT pruned, because they're still saved elsewhere.
  assert.ok(next.profileScores[U.b], 'shortlisted score kept');
  assert.ok(next.profileScores[U.c], 'folder-saved score kept');
  // The snapshot records both removed urls for undo.
  assert.deepEqual(next.lastRemoved.urls.sort(), [U.b, U.c].sort());
});

test('removeFromResults: an unsaved candidate has its score/AI pruned into the snapshot', () => {
  const s = baseState();
  const next = computeRemoveFromResults(s, new Set([U.a]));
  assert.equal(next.profileScores[U.a], undefined); // pruned from live map
  assert.equal(next.aiEvals[U.a], undefined);
  assert.ok(next.lastRemoved.scores[U.a], 'score saved for undo');
  assert.ok(next.lastRemoved.aiEvals[U.a], 'AI eval saved for undo');
});

test('removeFromFolder: unfiles from that folder only', () => {
  const s = baseState();
  const next = computeRemoveFromFolder(s.folders, 'F', new Set([U.c]));
  assert.deepEqual(next.folders.members.F, []);
  assert.deepEqual(next.lastRemoved.folders.F, [U.c]);
});

test('removeFromShortlist: un-stars only the given urls', () => {
  const s = baseState();
  const next = computeRemoveFromShortlist(s.shortlist, new Set([U.b]));
  assert.deepEqual(next.shortlist, []);
  assert.deepEqual(next.lastRemoved.shortlisted, [U.b]);
});

test('undo restores a results removal exactly (urls, scores, AI)', () => {
  const s = baseState();
  const removed = computeRemoveFromResults(s, new Set([U.a]));
  // Simulate the post-removal live state.
  const after = {
    profiles: removed.profiles,
    scores: removed.profileScores,
    aiEvals: removed.aiEvals,
    shortlist: s.shortlist,
    folders: s.folders,
  };
  const back = computeUndo(after, removed.lastRemoved);
  assert.ok(back.profiles.includes(U.a));
  assert.ok(back.profileScores[U.a], 'score restored');
  assert.ok(back.aiEvals[U.a], 'AI eval restored');
});

test('undo skips folder memberships whose folder was since deleted', () => {
  const s = baseState();
  const removed = computeRemoveFromFolder(s.folders, 'F', new Set([U.c]));
  // Folder F is deleted before undo.
  const after = { ...s, folders: folders([], {}) };
  const back = computeUndo(after, removed.lastRemoved);
  assert.equal(back.folders.order.includes('F'), false); // not resurrected
});
