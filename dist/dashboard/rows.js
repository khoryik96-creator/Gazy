// Pure view/data logic for the dashboard table. No DOM, no chrome.* — every
// function is a pure transform of the in-memory data, so it's unit-tested
// directly (test/dashboardRows.test.js) and edits here can't silently regress
// the table rendering that dashboard.ts wires up.
import { scoreEntry } from '../shared/scoreView.js';
import { foldersForUrl } from '../shared/folders.js';
// Every candidate any view might show: the working results plus everything saved
// to a folder or the shortlist (which can outlive the results list). Order is
// stable — results first, then saved-only extras.
export function universeUrls(profiles, folders, shortlist) {
    const seen = new Set(profiles);
    const extra = [];
    for (const name of folders.order) {
        for (const u of folders.members[name]) {
            if (!seen.has(u)) {
                seen.add(u);
                extra.push(u);
            }
        }
    }
    for (const u of shortlist) {
        if (!seen.has(u)) {
            seen.add(u);
            extra.push(u);
        }
    }
    return [...profiles, ...extra];
}
// Derive the display Row for one candidate URL.
export function buildRow(url, data) {
    const e = scoreEntry(data.scores, url);
    let kw = null;
    let kwLabel = '—';
    let kwClass = '';
    if (e) {
        if (e.success === false) {
            kwLabel = '⚠️ failed';
            kwClass = 'score-fail';
        }
        else {
            kw = e.score;
            kwLabel = e.score + '%';
            kwClass = e.score === 0 ? 'score-zero' : 'score-good';
        }
    }
    const a = data.aiEvals[url];
    let ai = null;
    let aiLabel = '';
    if (a) {
        if (a.error)
            aiLabel = '⚠️';
        else {
            ai = a.score;
            aiLabel = '✨' + a.score + '%';
        }
    }
    const name = url.split('/in/')[1]?.split('/')[0] || url;
    return {
        url,
        name,
        kw,
        kwLabel,
        kwClass,
        ai,
        aiLabel,
        location: e?.location || '',
        shortlisted: data.shortlist.has(url),
        folders: foldersForUrl(data.folders, url),
    };
}
export function buildRows(urls, data) {
    return urls.map((url) => buildRow(url, data));
}
export function sortRows(rows, sortKey, sortDir) {
    const dir = sortDir;
    return [...rows].sort((a, b) => {
        if (sortKey === 'name')
            return a.name.localeCompare(b.name) * dir;
        if (sortKey === 'location')
            return a.location.localeCompare(b.location) * dir;
        // Numeric columns: nulls sort to the bottom regardless of direction.
        const av = sortKey === 'kw' ? a.kw : a.ai;
        const bv = sortKey === 'kw' ? b.kw : b.ai;
        if (av === null && bv === null)
            return 0;
        if (av === null)
            return 1;
        if (bv === null)
            return -1;
        return (av - bv) * dir;
    });
}
// Whether a URL belongs in the given view. The "All" view is the working results
// list only: a candidate saved to a folder but removed from results stays out of
// All, yet still shows in its folder view — folders are a persistent save, not a
// tag over results.
export function inView(view, url, sets) {
    if (view.kind === 'all')
        return sets.profilesSet.has(url);
    if (view.kind === 'shortlist')
        return sets.shortlist.has(url);
    if (view.kind === 'folder')
        return sets.folders.members[view.name]?.includes(url) ?? false;
    return false; // cost view isn't a candidate filter
}
/** Human name for the current view, used in the export filename and status. */
export function viewScopeName(view) {
    return view.kind === 'folder' ? view.name : view.kind;
}
