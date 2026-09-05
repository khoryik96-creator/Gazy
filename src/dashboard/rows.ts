// Pure view/data logic for the dashboard table. No DOM, no chrome.* — every
// function is a pure transform of the in-memory data, so it's unit-tested
// directly (test/dashboardRows.test.js) and edits here can't silently regress
// the table rendering that dashboard.ts wires up.

import { scoreEntry } from '../shared/scoreView.js';
import { nameFromUrl } from '../shared/nameFormat.js';
import { foldersForUrl } from '../shared/folders.js';
import type { FolderStore } from '../shared/folders.js';
import type { ScoresMap, AiEvalMap } from '../shared/types.js';

export type SortKey = 'name' | 'kw' | 'ai' | 'location';
export type View =
  { kind: 'all' } | { kind: 'shortlist' } | { kind: 'cost' } | { kind: 'folder'; name: string };

export interface Row {
  url: string;
  name: string;
  kw: number | null; // keyword score, or null when not scored / scrape failed
  kwLabel: string;
  kwClass: string;
  ai: number | null;
  aiLabel: string;
  location: string;
  shortlisted: boolean;
  folders: string[];
}

// The in-memory data every row is built from.
export interface RowData {
  scores: ScoresMap;
  aiEvals: AiEvalMap;
  shortlist: Set<string>;
  folders: FolderStore;
}

// Membership sets used to decide whether a URL belongs in the active view.
export interface ViewSets {
  profilesSet: Set<string>;
  shortlist: Set<string>;
  folders: FolderStore;
}

// Every candidate any view might show: the working results plus everything saved
// to a folder or the shortlist (which can outlive the results list). Order is
// stable — results first, then saved-only extras.
export function universeUrls(
  profiles: string[],
  folders: FolderStore,
  shortlist: Set<string>,
): string[] {
  const seen = new Set(profiles);
  const extra: string[] = [];
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
export function buildRow(url: string, data: RowData): Row {
  const e = scoreEntry(data.scores, url);
  let kw: number | null = null;
  let kwLabel = '—';
  let kwClass = '';
  if (e) {
    if (e.success === false) {
      kwLabel = '⚠️ failed';
      kwClass = 'score-fail';
    } else {
      kw = e.score;
      kwLabel = e.score + '%';
      kwClass = e.score === 0 ? 'score-zero' : 'score-good';
    }
  }

  const a = data.aiEvals[url];
  let ai: number | null = null;
  let aiLabel = '';
  if (a) {
    if (a.error) aiLabel = '⚠️';
    else {
      ai = a.score;
      aiLabel = '✨' + a.score + '%';
    }
  }

  // Use the shared formatter so the dashboard, the popup list, and CSV/Excel
  // export all show the same readable name ("Sarah Chen", not "sarah-chen-8a1b").
  const name = nameFromUrl(url);
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

export function buildRows(urls: string[], data: RowData): Row[] {
  return urls.map((url) => buildRow(url, data));
}

export function sortRows(rows: Row[], sortKey: SortKey, sortDir: 1 | -1): Row[] {
  const dir = sortDir;
  return [...rows].sort((a, b) => {
    if (sortKey === 'name') return a.name.localeCompare(b.name) * dir;
    if (sortKey === 'location') return a.location.localeCompare(b.location) * dir;
    // Numeric columns: nulls sort to the bottom regardless of direction.
    const av = sortKey === 'kw' ? a.kw : a.ai;
    const bv = sortKey === 'kw' ? b.kw : b.ai;
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * dir;
  });
}

// Whether a URL belongs in the given view. The "All" view is the working results
// list only: a candidate saved to a folder but removed from results stays out of
// All, yet still shows in its folder view — folders are a persistent save, not a
// tag over results.
export function inView(view: View, url: string, sets: ViewSets): boolean {
  if (view.kind === 'all') return sets.profilesSet.has(url);
  if (view.kind === 'shortlist') return sets.shortlist.has(url);
  if (view.kind === 'folder') return sets.folders.members[view.name]?.includes(url) ?? false;
  return false; // cost view isn't a candidate filter
}

/** Human name for the current view, used in the export filename and status. */
export function viewScopeName(view: View): string {
  return view.kind === 'folder' ? view.name : view.kind;
}

// URLs whose keyword scrape failed (the ⚠️ rows) — the targets for "Retry
// failed". A URL that was never scored is NOT failed; only an explicit
// success === false counts.
export function failedScrapeUrls(urls: string[], scores: ScoresMap): string[] {
  return urls.filter((u) => {
    const e = scoreEntry(scores, u);
    return e !== null && e.success === false;
  });
}
