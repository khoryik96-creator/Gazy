// Pure removal / undo logic for the dashboard. Each function computes the next
// persisted state (the object to hand chrome.storage.local.set) plus a one-level
// Undo snapshot, without touching chrome.* or the DOM. dashboard.ts calls these
// and does the actual storage write, so this delicate "what stays saved" logic is
// unit-tested in isolation (test/dashboardRemoval.test.js).
//
// Folders and the shortlist are persistent saves, so what "Remove" means depends
// on the view:
//   • All / results → drop from the working results only. Anyone saved to a
//     folder or the shortlist STAYS saved (still shows in that folder).
//   • Folder view   → unfile from THAT folder only (stays in results + others).
//   • Shortlist view→ un-star only.
import { addMembership, removeUrlsFromFolder } from '../shared/folders.js';
export function emptySnapshot() {
    return { urls: [], scores: {}, aiEvals: {}, shortlisted: [], folders: {}, count: 0 };
}
// Remove from the working results list. Folders/shortlist untouched. Scores/AI are
// pruned only for candidates no longer saved anywhere (so a folder-saved one keeps
// its data and still renders in its folder).
export function computeRemoveFromResults(state, urls) {
    const keep = state.profiles.filter((u) => !urls.has(u));
    const removedList = state.profiles.filter((u) => urls.has(u));
    const stillSaved = (u) => state.shortlist.has(u) || state.folders.order.some((n) => state.folders.members[n].includes(u));
    const nextScores = { ...state.scores };
    const nextAi = { ...state.aiEvals };
    const snap = emptySnapshot();
    snap.urls = removedList;
    snap.count = removedList.length;
    for (const u of removedList) {
        if (stillSaved(u))
            continue; // keep data — its folder row still needs it
        if (state.scores[u]) {
            snap.scores[u] = state.scores[u];
            delete nextScores[u];
        }
        if (state.aiEvals[u]) {
            snap.aiEvals[u] = state.aiEvals[u];
            delete nextAi[u];
        }
    }
    return { profiles: keep, profileScores: nextScores, aiEvals: nextAi, lastRemoved: snap };
}
// Unfile the given candidates from ONE folder. Results, other folders, shortlist,
// and scores/AI are all left intact.
export function computeRemoveFromFolder(folders, name, urls) {
    const removed = [...urls].filter((u) => folders.members[name]?.includes(u));
    const snap = emptySnapshot();
    snap.folders = { [name]: removed };
    snap.count = removed.length;
    return { folders: removeUrlsFromFolder(folders, name, urls), lastRemoved: snap };
}
// Un-star the given candidates. Results and folders are left intact.
export function computeRemoveFromShortlist(shortlist, urls) {
    const removed = [...urls].filter((u) => shortlist.has(u));
    const snap = emptySnapshot();
    snap.shortlisted = removed;
    snap.count = removed.length;
    return { shortlist: [...shortlist].filter((u) => !urls.has(u)), lastRemoved: snap };
}
// Restore the most recent removal. Adds the candidates back (appended), with their
// scores / AI evals / shortlist stars and any folder memberships whose folder
// still exists.
export function computeUndo(state, snap) {
    const have = new Set(state.profiles);
    const restoredProfiles = [...state.profiles, ...snap.urls.filter((u) => !have.has(u))];
    const restoredScores = { ...state.scores, ...snap.scores };
    const restoredAi = { ...state.aiEvals, ...snap.aiEvals };
    const restoredShortlist = new Set(state.shortlist);
    for (const u of snap.shortlisted)
        restoredShortlist.add(u);
    let restoredFolders = state.folders;
    for (const name of Object.keys(snap.folders)) {
        if (!restoredFolders.order.includes(name))
            continue; // folder since deleted
        for (const u of snap.folders[name])
            restoredFolders = addMembership(restoredFolders, name, u);
    }
    return {
        profiles: restoredProfiles,
        profileScores: restoredScores,
        aiEvals: restoredAi,
        shortlist: [...restoredShortlist],
        folders: restoredFolders,
    };
}
