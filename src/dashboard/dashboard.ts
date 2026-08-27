import { normalizeUiTheme } from '../shared/themes.js';
import { MESSAGE } from '../shared/constants.js';
import {
  emptyFolderStore,
  normalizeFolderStore,
  normalizeFolderName,
  createFolder,
  renameFolder,
  deleteFolder,
  toggleMembership,
  addMembership,
  folderCount,
} from '../shared/folders.js';
import {
  universeUrls as universeUrlsPure,
  buildRows as buildRowsPure,
  sortRows as sortRowsPure,
  inView as inViewPure,
  viewScopeName as viewScopeNamePure,
  failedScrapeUrls,
} from './rows.js';
import type { Row, View, SortKey } from './rows.js';
import {
  computeRemoveFromResults,
  computeRemoveFromFolder,
  computeRemoveFromShortlist,
  computeUndo,
} from './removal.js';
import type { RemovedSnapshot } from './removal.js';
import { openFolderMenu, openFolderPickMenu, closeFolderMenu } from './folderMenu.js';
import { initSidebar } from './sidebar.js';
import { renderCostPanel } from './costPanel.js';
import {
  emptyAiUsage,
  normalizeAiUsage,
  normalizePrices,
  DEFAULT_USD_TO_MYR,
} from '../shared/aiCost.js';
import type { AiUsage, AiPrices } from '../shared/aiCost.js';
import { getScoringKeywords } from '../shared/keywordExtraction.js';
import { compileBooleanRule } from '../shared/booleanExpression.js';
import { largeRunWarning } from '../shared/runGuard.js';
import {
  buildCandidateCsv,
  buildCandidateSheet,
  exportFilename,
} from '../shared/candidateExport.js';
import { buildXlsx } from '../shared/xlsx.js';
import { serializeWorkspace, parseWorkspace, WORKSPACE_KEYS } from '../shared/workspaceBackup.js';
import type { FolderStore } from '../shared/folders.js';
import type { ScoresMap, AiEvalMap, AiModel } from '../shared/types.js';

// Full-page dashboard. Reads the same chrome.storage.local data the popup
// writes (profiles, profileScores, aiEvals, shortlist, folders) and shows it in
// a roomy, sortable table. Views: All results / Shortlist / any named folder.
// Writes back the flat shortlist star and the folder store so the popup and
// other dashboard tabs stay in sync.

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const tbody = el<HTMLTableSectionElement>('tbody');
const emptyEl = el<HTMLDivElement>('empty');
const summaryEl = el<HTMLDivElement>('summary');
const tableEl = el<HTMLTableElement>('tbl');
const scoreBtn = el<HTMLButtonElement>('scoreBtn');
const aiEvalBtn = el<HTMLButtonElement>('aiEvalBtn');
const stopBtn = el<HTMLButtonElement>('stopBtn');
const retryFailedBtn = el<HTMLButtonElement>('retryFailedBtn');
const exportBtn = el<HTMLButtonElement>('exportBtn');
const exportXlsxBtn = el<HTMLButtonElement>('exportXlsxBtn');
const backupBtn = el<HTMLButtonElement>('backupBtn');
const restoreBtn = el<HTMLButtonElement>('restoreBtn');
const restoreFile = el<HTMLInputElement>('restoreFile');
const clearAllBtn = el<HTMLButtonElement>('clearAllBtn');
const undoBtn = el<HTMLButtonElement>('undoBtn');
const evalStatusEl = el<HTMLSpanElement>('evalStatus');
const folderBar = el<HTMLDivElement>('folderBar');
const renameFolderBtn = el<HTMLButtonElement>('renameFolderBtn');
const deleteFolderBtn = el<HTMLButtonElement>('deleteFolderBtn');
const costPanel = el<HTMLDivElement>('costPanel');
const selectAllEl = el<HTMLInputElement>('selectAll');
const bulkBar = el<HTMLDivElement>('bulkBar');
const bulkCountEl = el<HTMLSpanElement>('bulkCount');
const bulkScoreBtn = el<HTMLButtonElement>('bulkScore');
const bulkEvalBtn = el<HTMLButtonElement>('bulkEval');
const bulkShortlistBtn = el<HTMLButtonElement>('bulkShortlist');
const bulkUnshortlistBtn = el<HTMLButtonElement>('bulkUnshortlist');
const bulkFolderBtn = el<HTMLButtonElement>('bulkFolder');
const bulkRemoveBtn = el<HTMLButtonElement>('bulkRemove');
const bulkClearBtn = el<HTMLButtonElement>('bulkClear');

let profiles: string[] = [];
// Fast membership test for "is this URL in the working results list?" — the All
// view and results-removal use it. Rebuilt in load().
let profilesSet = new Set<string>();
let scores: ScoresMap = {};
let aiEvals: AiEvalMap = {};
let shortlist = new Set<string>();
let folders: FolderStore = emptyFolderStore();
let aiUsage: AiUsage = emptyAiUsage();
let aiPrices: AiPrices = normalizePrices(undefined);
let usdToMyr = DEFAULT_USD_TO_MYR;
// Snapshot of the most recent removal, for one-level Undo (persisted).
let lastRemoved: RemovedSnapshot | null = null;
// Ephemeral row selection (not persisted) for bulk shortlist / folder actions.
let selected = new Set<string>();
// Anchor for Shift-click range selection: the URL of the last row clicked.
let lastSelUrl: string | null = null;

let view: View = { kind: 'all' };
let sortKey: SortKey = 'kw';
let sortDir: 1 | -1 = -1; // default: highest score first

async function load(): Promise<void> {
  const data = (await chrome.storage.local.get([
    'profiles',
    'profileScores',
    'aiEvals',
    'shortlist',
    'folders',
    'aiUsage',
    'aiPrices',
    'usdToMyr',
    'lastRemoved',
    'uiTheme',
  ])) as unknown as {
    profiles?: string[];
    profileScores?: ScoresMap;
    aiEvals?: AiEvalMap;
    shortlist?: string[];
    folders?: unknown;
    aiUsage?: unknown;
    aiPrices?: unknown;
    usdToMyr?: number;
    lastRemoved?: RemovedSnapshot;
    uiTheme?: string;
  };
  profiles = data.profiles || [];
  profilesSet = new Set(profiles);
  scores = data.profileScores || {};
  aiEvals = data.aiEvals || {};
  shortlist = new Set(data.shortlist || []);
  folders = normalizeFolderStore(data.folders);
  lastRemoved = data.lastRemoved && Array.isArray(data.lastRemoved.urls) ? data.lastRemoved : null;
  aiUsage = normalizeAiUsage(data.aiUsage);
  aiPrices = normalizePrices(data.aiPrices);
  usdToMyr =
    typeof data.usdToMyr === 'number' && data.usdToMyr > 0 ? data.usdToMyr : DEFAULT_USD_TO_MYR;
  // A folder view whose folder was deleted elsewhere falls back to All.
  if (view.kind === 'folder' && !folders.order.includes(view.name)) view = { kind: 'all' };
  document.body.dataset.theme = normalizeUiTheme(data.uiTheme);
}

// Thin wrappers binding the pure rows.ts helpers to the module-level state, so
// existing call sites (inView(url), buildRows(), sortRows(rows)) stay unchanged.
function inView(url: string): boolean {
  return inViewPure(view, url, { profilesSet, shortlist, folders });
}

function universeUrls(): string[] {
  return universeUrlsPure(profiles, folders, shortlist);
}

function buildRows(): Row[] {
  return buildRowsPure(universeUrls(), { scores, aiEvals, shortlist, folders });
}

function sortRows(rows: Row[]): Row[] {
  return sortRowsPure(rows, sortKey, sortDir);
}

function render(): void {
  // The Cost tab replaces the candidate workspace with the spend breakdown.
  const isCost = view.kind === 'cost';
  el<HTMLButtonElement>('tabAll').classList.toggle('active', view.kind === 'all');
  el<HTMLButtonElement>('tabShort').classList.toggle('active', view.kind === 'shortlist');
  el<HTMLButtonElement>('tabCost').classList.toggle('active', isCost);
  const toolbar = document.querySelector<HTMLElement>('.toolbar');
  const tableScroll = tableEl.closest<HTMLElement>('.table-scroll');

  if (isCost) {
    costPanel.style.display = '';
    if (toolbar) toolbar.style.display = 'none';
    if (tableScroll) tableScroll.style.display = 'none';
    folderBar.style.display = 'none';
    bulkBar.style.display = 'none';
    summaryEl.style.display = 'none';
    emptyEl.style.display = 'none';
    renderCostPanel(costPanel, {
      usage: aiUsage,
      prices: aiPrices,
      usdToMyr,
      onRate: (n) => void setUsdToMyr(n),
      onPrices: (p) => void setAiPrices(p),
      onReset: () => void resetCost(),
    });
    return;
  }
  costPanel.style.display = 'none';
  if (toolbar) toolbar.style.display = '';
  if (tableScroll) tableScroll.style.display = '';
  folderBar.style.display = '';
  summaryEl.style.display = '';

  let rows = buildRows().filter((r) => inView(r.url));
  rows = sortRows(rows);

  // Drop selections for candidates no longer in the list (e.g. after a new search).
  const present = new Set(rows.map((r) => r.url));
  for (const u of [...selected]) if (!present.has(u)) selected.delete(u);

  tbody.replaceChildren();
  const viewRows = rows; // captured for range selection at click time
  viewRows.forEach((r, idx) => {
    const tr = document.createElement('tr');
    if (selected.has(r.url)) tr.className = 'sel';

    const selTd = document.createElement('td');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'selchk';
    chk.checked = selected.has(r.url);
    // Use click (not change) so we can read Shift/Ctrl. Shift-click selects the
    // range from the last-clicked row to this one (in current view order);
    // plain/Ctrl click toggles just this row. `chk.checked` is the post-click state.
    chk.addEventListener('click', (e) => {
      const on = chk.checked;
      const anchorIdx = lastSelUrl ? viewRows.findIndex((row) => row.url === lastSelUrl) : -1;
      if (e.shiftKey && anchorIdx !== -1) {
        const [lo, hi] = anchorIdx < idx ? [anchorIdx, idx] : [idx, anchorIdx];
        for (let k = lo; k <= hi; k++) {
          if (on) selected.add(viewRows[k].url);
          else selected.delete(viewRows[k].url);
        }
      } else if (on) {
        selected.add(r.url);
      } else {
        selected.delete(r.url);
      }
      lastSelUrl = r.url;
      render();
    });
    selTd.appendChild(chk);
    tr.appendChild(selTd);

    const starTd = document.createElement('td');
    const star = document.createElement('button');
    star.className = 'star' + (r.shortlisted ? ' on' : '');
    star.textContent = r.shortlisted ? '⭐' : '☆';
    star.title = r.shortlisted ? 'Remove from shortlist' : 'Add to shortlist';
    star.addEventListener('click', () => void toggleStar(r.url));
    starTd.appendChild(star);
    tr.appendChild(starTd);

    const nameTd = document.createElement('td');
    const link = document.createElement('a');
    link.className = 'cand-link';
    link.href = r.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = r.name;
    nameTd.appendChild(link);
    tr.appendChild(nameTd);

    const kwTd = document.createElement('td');
    kwTd.className = 'num ' + r.kwClass;
    kwTd.textContent = r.kwLabel;
    tr.appendChild(kwTd);

    const aiTd = document.createElement('td');
    aiTd.className = 'num score-ai';
    aiTd.textContent = r.aiLabel;
    tr.appendChild(aiTd);

    tr.appendChild(buildFolderCell(r));

    const locTd = document.createElement('td');
    locTd.textContent = r.location;
    tr.appendChild(locTd);

    tbody.appendChild(tr);
  });

  const total = profiles.length;
  const shortCount = profiles.filter((u) => shortlist.has(u)).length;
  emptyEl.style.display = rows.length === 0 ? 'block' : 'none';
  tableEl.style.display = rows.length === 0 ? 'none' : '';
  const tip = rows.length > 1 ? ' · Shift-click a checkbox to select a range' : '';
  summaryEl.textContent =
    (view.kind === 'shortlist'
      ? shortCount + ' shortlisted candidate(s)'
      : view.kind === 'folder'
        ? rows.length + ' candidate(s) in “' + view.name + '”'
        : total + ' candidate(s) · ' + shortCount + ' shortlisted') + tip;

  renderFolderBar();
  renameFolderBtn.style.display = view.kind === 'folder' ? '' : 'none';
  deleteFolderBtn.style.display = view.kind === 'folder' ? '' : 'none';
  undoBtn.style.display = lastRemoved ? '' : 'none';
  // Offer "Retry failed" only when the current view actually has ⚠️ failed scrapes.
  const failedCount = failedScrapeUrls(
    rows.map((r) => r.url),
    scores,
  ).length;
  retryFailedBtn.style.display = failedCount > 0 ? '' : 'none';
  retryFailedBtn.textContent = '↻ Retry failed (' + failedCount + ')';
  syncSelectionUI(rows);
  updateHeaderArrows();
}

// Reflect the current selection in the header checkbox and the bulk action bar.
function syncSelectionUI(rows: Row[]): void {
  const selectedHere = rows.filter((r) => selected.has(r.url)).length;
  selectAllEl.checked = rows.length > 0 && selectedHere === rows.length;
  selectAllEl.indeterminate = selectedHere > 0 && selectedHere < rows.length;

  const n = selected.size;
  bulkBar.style.display = n > 0 ? '' : 'none';
  bulkCountEl.textContent = n + ' selected';
}

// One cell per candidate: the folders it belongs to as pills, plus a 🏷 button
// opening the assign popover.
function buildFolderCell(r: Row): HTMLTableCellElement {
  const td = document.createElement('td');
  td.className = 'fld-cell';
  for (const name of r.folders) {
    const pill = document.createElement('span');
    pill.className = 'fld-pill';
    pill.textContent = name;
    td.appendChild(pill);
  }
  const btn = document.createElement('button');
  btn.className = 'fld-add';
  btn.textContent = '🏷';
  btn.title = 'Assign to folders';
  btn.addEventListener('click', () =>
    openFolderMenu({
      anchor: btn,
      url: r.url,
      store: folders,
      onToggle: (name) => void assignToggle(name, r.url),
      onCreate: (name) => void createAndAssign(name, r.url),
    }),
  );
  td.appendChild(btn);
  return td;
}

function renderFolderBar(): void {
  folderBar.replaceChildren();
  for (const name of folders.order) {
    const chip = document.createElement('button');
    chip.className =
      'folder-chip' + (view.kind === 'folder' && view.name === name ? ' active' : '');
    chip.textContent = name + ' (' + folderCount(folders, name) + ')';
    chip.addEventListener('click', () => setView({ kind: 'folder', name }));
    folderBar.appendChild(chip);
  }
  const add = document.createElement('button');
  add.className = 'folder-chip new';
  add.textContent = '＋ New folder';
  add.addEventListener('click', () => void newFolder());
  folderBar.appendChild(add);
}

function updateHeaderArrows(): void {
  document.querySelectorAll<HTMLTableCellElement>('th[data-sort]').forEach((th) => {
    const key = th.dataset.sort as SortKey;
    const base = th.textContent?.replace(/\s*[▲▼]$/, '') ?? '';
    th.textContent = base + (key === sortKey ? (sortDir === 1 ? ' ▲' : ' ▼') : '');
  });
}

async function persistFolders(): Promise<void> {
  await chrome.storage.local.set({ folders });
}

async function toggleStar(url: string): Promise<void> {
  if (shortlist.has(url)) shortlist.delete(url);
  else shortlist.add(url);
  await chrome.storage.local.set({ shortlist: [...shortlist] });
  render();
}

async function assignToggle(name: string, url: string): Promise<void> {
  folders = toggleMembership(folders, name, url);
  await persistFolders();
  render();
}

async function createAndAssign(name: string, url: string): Promise<void> {
  folders = toggleMembership(createFolder(folders, name), name.trim(), url);
  await persistFolders();
  closeFolderMenu();
  render();
}

async function newFolder(): Promise<void> {
  const name = window.prompt('New folder name:')?.trim();
  if (!name) return;
  const before = folders.order.length;
  folders = createFolder(folders, name);
  if (folders.order.length === before) return; // blank or duplicate
  await persistFolders();
  setView({ kind: 'folder', name });
}

async function renameActiveFolder(): Promise<void> {
  if (view.kind !== 'folder') return;
  const current = view.name;
  const next = window.prompt('Rename folder:', current)?.trim();
  if (!next || next === current) return;
  folders = renameFolder(folders, current, next);
  await persistFolders();
  setView(folders.order.includes(next) ? { kind: 'folder', name: next } : { kind: 'all' });
}

async function deleteActiveFolder(): Promise<void> {
  if (view.kind !== 'folder') return;
  if (!window.confirm('Delete folder “' + view.name + '”? Candidates are not deleted.')) return;
  folders = deleteFolder(folders, view.name);
  await persistFolders();
  setView({ kind: 'all' });
}

function setView(next: View): void {
  view = next;
  closeFolderMenu();
  render();
}

/** Human name for the current view, used in the export filename and status. */
function viewScopeName(): string {
  return viewScopeNamePure(view);
}

// Export the candidates in the current view (all / shortlist / a folder) to CSV:
// name, URL, score, location, plus AI score and folders when present.
function exportCsv(): void {
  const rows = buildRows().filter((r) => inView(r.url));
  if (rows.length === 0) {
    setEvalStatus('No candidates to export.');
    return;
  }
  const csv = buildCandidateCsv(
    rows.map((r) => ({
      url: r.url,
      score: r.kw,
      ai: r.ai,
      location: r.location,
      folders: r.folders,
    })),
  );
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = exportFilename(viewScopeName());
  a.click();
  URL.revokeObjectURL(a.href);
  setEvalStatus('⬇ Exported ' + rows.length + ' candidate(s) from “' + viewScopeName() + '”.');
}

// Export the current view to a real .xlsx with the header row's filter/sort
// arrows enabled, so Score and AI Score can be ordered highest/lowest right in
// Excel. Score/AI are written as numbers so the sort is numeric.
function exportXlsx(): void {
  const rows = buildRows().filter((r) => inView(r.url));
  if (rows.length === 0) {
    setEvalStatus('No candidates to export.');
    return;
  }
  const aoa = buildCandidateSheet(
    rows.map((r) => ({
      url: r.url,
      score: r.kw,
      ai: r.ai,
      location: r.location,
      folders: r.folders,
    })),
  );
  const blob = new Blob([buildXlsx(aoa, 'Candidates')], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = exportFilename(viewScopeName(), Date.now(), 'xlsx');
  a.click();
  URL.revokeObjectURL(a.href);
  setEvalStatus(
    '⬇ Exported ' + rows.length + ' candidate(s) to Excel from “' + viewScopeName() + '”.',
  );
}

// Download a JSON backup of the whole workspace (folders, shortlist, scores, AI
// evals, templates, settings) — everything except the secret API key. Restores
// on any machine via the Restore button.
async function backupWorkspace(): Promise<void> {
  const stored = await chrome.storage.local.get([...WORKSPACE_KEYS]);
  const appVersion = chrome.runtime.getManifest().version;
  const json = serializeWorkspace(stored, appVersion);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = 'gazy-workspace-' + stamp + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  setEvalStatus('💾 Backed up your workspace.');
}

// Restore a workspace from a chosen backup file. Replaces the current data for
// the keys present in the file (a confirm guards the overwrite); the API key and
// any unknown keys are ignored by parseWorkspace.
async function restoreWorkspaceFromFile(file: File): Promise<void> {
  let parsed;
  try {
    parsed = parseWorkspace(await file.text());
  } catch (e) {
    setEvalStatus('❌ ' + (e as Error).message);
    return;
  }
  if (parsed.keyCount === 0) {
    setEvalStatus('That backup had no workspace data to restore.');
    return;
  }
  const when = parsed.exportedAt ? ' (from ' + parsed.exportedAt.slice(0, 10) + ')' : '';
  if (
    !confirm(
      'Restore this backup' +
        when +
        '?\nThis REPLACES your current folders, shortlist, scores, and settings with the file’s.',
    )
  ) {
    return;
  }
  await chrome.storage.local.set(parsed.data);
  setEvalStatus('⟳ Restored your workspace from the backup.');
}

function initHeaderSort(): void {
  document.querySelectorAll<HTMLTableCellElement>('th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort as SortKey;
      if (sortKey === key) sortDir = sortDir === 1 ? -1 : 1;
      else {
        sortKey = key;
        sortDir = key === 'name' || key === 'location' ? 1 : -1;
      }
      render();
    });
  });
}

// ---- Bulk selection: select-all + add the selection to shortlist / a folder ----

function toggleSelectAll(): void {
  const urls = viewUrls();
  if (selectAllEl.checked) urls.forEach((u) => selected.add(u));
  else urls.forEach((u) => selected.delete(u));
  render();
}

async function bulkSetShortlist(add: boolean): Promise<void> {
  if (selected.size === 0) return;
  for (const u of selected) {
    if (add) shortlist.add(u);
    else shortlist.delete(u);
  }
  await chrome.storage.local.set({ shortlist: [...shortlist] });
  setEvalStatus(
    (add ? '⭐ Added ' : 'Removed ') +
      selected.size +
      ' candidate(s) ' +
      (add ? 'to' : 'from') +
      ' shortlist.',
  );
  render();
}

function bulkAddToFolder(): void {
  if (selected.size === 0) return;
  openFolderPickMenu({
    anchor: bulkFolderBtn,
    store: folders,
    count: selected.size,
    onPick: (name) => void applyBulkFolder(name, false),
    onCreate: (name) => void applyBulkFolder(name, true),
  });
}

async function applyBulkFolder(rawName: string, create: boolean): Promise<void> {
  const name = normalizeFolderName(rawName);
  if (!name) return;
  let store = create ? createFolder(folders, name) : folders;
  const count = selected.size;
  for (const u of selected) store = addMembership(store, name, u);
  folders = store;
  await persistFolders();
  closeFolderMenu();
  setEvalStatus('🏷 Added ' + count + ' candidate(s) to “' + name + '”.');
  render();
}

function clearSelection(): void {
  selected = new Set();
  render();
}

// ---- Remove candidates (view-aware) ----
//
// Folders and the shortlist are persistent saves, so what "Remove" means depends
// on where you are:
//   • All / results view → drop from the working results only. Anyone saved to a
//     folder or the shortlist STAYS saved (still shows in that folder), it just
//     leaves the All list.
//   • Folder view       → unfile from THAT folder only (stays in results + others).
//   • Shortlist view    → un-star only.
// Each records a one-level Undo snapshot; storage.onChanged reloads and re-renders.

// The compute* helpers in removal.ts read this snapshot of the current state.
function removalState(): {
  profiles: string[];
  scores: ScoresMap;
  aiEvals: AiEvalMap;
  shortlist: Set<string>;
  folders: FolderStore;
} {
  return { profiles, scores, aiEvals, shortlist, folders };
}

// Remove from the working results list. Folders/shortlist untouched. Scores/AI are
// pruned only for candidates no longer saved anywhere (so a folder-saved one keeps
// its data and still renders in its folder).
async function removeFromResults(urls: Set<string>): Promise<void> {
  const next = computeRemoveFromResults(removalState(), urls);
  selected = new Set();
  await chrome.storage.local.set(next);
}

// Unfile the given candidates from ONE folder. Results, other folders, shortlist,
// and scores/AI are all left intact.
async function removeFromFolderView(name: string, urls: Set<string>): Promise<void> {
  const next = computeRemoveFromFolder(folders, name, urls);
  selected = new Set();
  await chrome.storage.local.set(next);
}

// Un-star the given candidates. Results and folders are left intact.
async function removeFromShortlistView(urls: Set<string>): Promise<void> {
  const next = computeRemoveFromShortlist(shortlist, urls);
  selected = new Set();
  await chrome.storage.local.set(next);
}

// Restore the most recent removal. Adds the candidates back (appended), with
// their scores / AI evals / shortlist stars and any folder memberships whose
// folder still exists.
async function undoRemoval(): Promise<void> {
  if (!lastRemoved) return;
  const snap = lastRemoved;
  const restored = computeUndo(removalState(), snap);
  lastRemoved = null;
  await chrome.storage.local.set({ ...restored, lastRemoved: null });
  setEvalStatus('↩ Restored ' + (snap.count ?? snap.urls.length) + ' candidate(s).');
}

async function removeSelected(): Promise<void> {
  if (selected.size === 0) return;
  const urls = new Set(selected);
  const n = urls.size;

  if (view.kind === 'folder') {
    if (
      !confirm(
        'Remove ' +
          n +
          ' candidate(s) from “' +
          view.name +
          '”?\nThey stay in your results and any other folders.',
      )
    )
      return;
    await removeFromFolderView(view.name, urls);
    setEvalStatus('🗑 Removed ' + n + ' from “' + view.name + '”.');
  } else if (view.kind === 'shortlist') {
    if (
      !confirm(
        'Remove ' + n + ' candidate(s) from the shortlist?\nThey stay in your results and folders.',
      )
    )
      return;
    await removeFromShortlistView(urls);
    setEvalStatus('🗑 Removed ' + n + ' from the shortlist.');
  } else {
    if (
      !confirm(
        'Remove ' +
          n +
          ' candidate(s) from the results?\nAnyone saved to a folder or the shortlist is kept there.',
      )
    )
      return;
    await removeFromResults(urls);
    setEvalStatus('🗑 Removed ' + n + ' candidate(s).');
  }
}

async function clearAll(): Promise<void> {
  if (profiles.length === 0) return;

  // Protect anything the user curated — candidates in a folder or on the
  // shortlist are kept. "Clear all" clears the working results, not saved picks.
  const saved = new Set<string>(shortlist);
  for (const name of folders.order) for (const u of folders.members[name]) saved.add(u);
  const toRemove = new Set(profiles.filter((u) => !saved.has(u)));

  if (toRemove.size === 0) {
    setEvalStatus('Nothing to clear — every candidate is in a folder or shortlisted.');
    return;
  }

  const keptNote =
    saved.size > 0 ? ' ' + saved.size + ' saved (folder/shortlist) candidate(s) are kept.' : '';
  if (!confirm('Remove ' + toRemove.size + ' unsaved candidate(s)?' + keptNote)) return;

  await removeFromResults(toRemove);
  setEvalStatus('🗑 Cleared ' + toRemove.size + ' candidate(s).' + keptNote);
}

// ---- Cost tab: persist the editable FX rate / prices, reset counters ----
async function setUsdToMyr(n: number): Promise<void> {
  usdToMyr = n;
  await chrome.storage.local.set({ usdToMyr: n });
  render();
}
async function setAiPrices(p: AiPrices): Promise<void> {
  aiPrices = p;
  await chrome.storage.local.set({ aiPrices: p });
  render();
}
async function resetCost(): Promise<void> {
  if (!confirm('Reset the tracked AI usage counters to zero?')) return;
  aiUsage = emptyAiUsage();
  await chrome.storage.local.set({ aiUsage });
  render();
}

el<HTMLButtonElement>('tabAll').addEventListener('click', () => setView({ kind: 'all' }));
el<HTMLButtonElement>('tabShort').addEventListener('click', () => setView({ kind: 'shortlist' }));
el<HTMLButtonElement>('tabCost').addEventListener('click', () => setView({ kind: 'cost' }));
renameFolderBtn.addEventListener('click', () => void renameActiveFolder());
deleteFolderBtn.addEventListener('click', () => void deleteActiveFolder());
exportBtn.addEventListener('click', exportCsv);
exportXlsxBtn.addEventListener('click', exportXlsx);
backupBtn.addEventListener('click', () => void backupWorkspace());
restoreBtn.addEventListener('click', () => restoreFile.click());
restoreFile.addEventListener('change', () => {
  const file = restoreFile.files?.[0];
  if (file) void restoreWorkspaceFromFile(file);
  restoreFile.value = ''; // allow re-selecting the same file later
});
clearAllBtn.addEventListener('click', () => void clearAll());
undoBtn.addEventListener('click', () => void undoRemoval());
stopBtn.addEventListener('click', stopRuns);
retryFailedBtn.addEventListener('click', retryFailed);
selectAllEl.addEventListener('change', toggleSelectAll);
bulkScoreBtn.addEventListener('click', () => void startScoring([...selected]));
bulkEvalBtn.addEventListener('click', () => void startEval([...selected]));
bulkShortlistBtn.addEventListener('click', () => void bulkSetShortlist(true));
bulkUnshortlistBtn.addEventListener('click', () => void bulkSetShortlist(false));
bulkFolderBtn.addEventListener('click', bulkAddToFolder);
bulkRemoveBtn.addEventListener('click', () => void removeSelected());
bulkClearBtn.addEventListener('click', clearSelection);
initHeaderSort();

// ---- Run state: show Stop + disable Score/AI while a run is in flight ----
function setRunning(on: boolean): void {
  stopBtn.style.display = on ? '' : 'none';
  scoreBtn.disabled = on;
  aiEvalBtn.disabled = on;
  bulkScoreBtn.disabled = on;
  bulkEvalBtn.disabled = on;
  retryFailedBtn.disabled = on;
}

// Re-score only the candidates in the current view whose scrape failed (⚠️).
// Reuses startScoring's target path so it goes through the same validation and
// (now retrying) scraper — a transient failure often clears on a second pass.
function retryFailed(): void {
  const failed = failedScrapeUrls(viewUrls(), scores);
  if (failed.length === 0) {
    setEvalStatus('No failed candidates to retry.');
    return;
  }
  void startScoring(failed);
}

function stopRuns(): void {
  void chrome.runtime.sendMessage({ type: MESSAGE.STOP_SCORING }).catch(() => {});
  void chrome.runtime.sendMessage({ type: MESSAGE.STOP_AI_EVAL }).catch(() => {});
  setEvalStatus('⏹ Stopping…');
  setRunning(false);
}

function setEvalStatus(text: string): void {
  evalStatusEl.textContent = text;
}

// The set of candidates the AI-Evaluate button acts on: whatever the active view
// shows (all results, the shortlist, or a folder).
function viewUrls(): string[] {
  // Universe (not just results) so a folder view scores/evaluates all its members,
  // including any saved candidates no longer in the working results list.
  return universeUrls().filter((u) => inView(u));
}

// Kick off AI evaluation from the dashboard. Reads the same DeepSeek key/model
// and job-description form data the popup persists to storage, then hands the
// work to the background engine (which persists results to storage.local, so
// they flow back here live via the storage.onChanged listener below).
// Evaluate `targets` if given (e.g. the current selection), else the whole view.
// Lets an interrupted AI scan be resumed on just the candidates that still need it.
async function startEval(targets?: string[]): Promise<void> {
  const urls = targets ?? viewUrls();
  if (urls.length === 0) {
    setEvalStatus('No candidates to evaluate.');
    return;
  }

  const cfg = (await chrome.storage.local.get(['aiKey', 'aiModel', 'formData'])) as unknown as {
    aiKey?: string;
    aiModel?: string;
    formData?: { jd?: string; keywords?: string; booleanRule?: string };
  };

  const apiKey = (cfg.aiKey || '').trim();
  if (!apiKey) {
    setEvalStatus('Add your DeepSeek API key in Settings (left rail) first.');
    return;
  }

  const fd = cfg.formData || {};
  const jd = (fd.jd || fd.keywords || fd.booleanRule || '').trim();
  if (!jd) {
    setEvalStatus('Add a job description or keywords in the left rail first.');
    return;
  }

  const model: AiModel =
    cfg.aiModel === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';

  if (
    !confirm(
      largeRunWarning(urls.length, 'ai') +
        'Send ' +
        urls.length +
        ' profile(s) to DeepSeek (' +
        model +
        ') for AI evaluation?\n\nThis uses your API key and sends profile text to DeepSeek.',
    )
  ) {
    return;
  }

  setRunning(true);
  setEvalStatus('✦ Evaluating ' + urls.length + ' candidate(s)…');
  chrome.runtime.sendMessage(
    { type: MESSAGE.AI_EVALUATE, data: { profiles: urls, jd, apiKey, model } },
    (response?: { status?: string; error?: string }) => {
      if (!response || response.status !== 'started') {
        setRunning(false);
        setEvalStatus('❌ Failed to start: ' + (response?.error || 'unknown'));
      }
    },
  );
}

aiEvalBtn.addEventListener('click', () => void startEval());

// Kick off keyword scoring from the dashboard. Mirrors the popup's Score button:
// derives keywords from the same stored job-description form data and hands the
// run to the background scoring engine, which persists profileScores to
// storage.local — so results flow back here live via storage.onChanged.
async function startScoring(targets?: string[]): Promise<void> {
  const urls = targets ?? viewUrls();
  if (urls.length === 0) {
    setEvalStatus('No candidates to score.');
    return;
  }

  const cfg = (await chrome.storage.local.get('formData')) as unknown as {
    formData?: { jd?: string; keywords?: string; booleanRule?: string; country?: string };
  };
  const fd = cfg.formData || {};

  const keywords = getScoringKeywords({
    manual: fd.keywords,
    booleanRule: fd.booleanRule,
    jd: fd.jd,
  });
  if (keywords.length === 0) {
    setEvalStatus('Add a job description, Boolean rule, or keywords in the left rail first.');
    return;
  }

  const booleanRule = fd.booleanRule || '';
  if (booleanRule.trim()) {
    try {
      compileBooleanRule(booleanRule);
    } catch (e) {
      setEvalStatus('❌ Invalid Boolean rule: ' + (e as Error).message);
      return;
    }
  }

  if (
    !confirm(
      largeRunWarning(urls.length, 'score') +
        'Score ' +
        urls.length +
        ' candidate(s)? This visits each LinkedIn profile in the background to scrape and score it.',
    )
  ) {
    return;
  }

  setRunning(true);
  setEvalStatus('⭐ Scoring ' + urls.length + ' candidate(s)…');
  chrome.runtime.sendMessage(
    {
      type: MESSAGE.START_SCORING,
      data: { profiles: urls, keywords, booleanRule, countryFilter: fd.country || '' },
    },
    (response?: { status?: string; error?: string }) => {
      if (!response || response.status !== 'started') {
        setRunning(false);
        setEvalStatus('❌ Failed to start scoring: ' + (response?.error || 'unknown'));
      }
    },
  );
}

scoreBtn.addEventListener('click', () => void startScoring());

// Progress/completion come back from the background engines. Rendered results
// arrive through storage.onChanged (aiEvals / profileScores); here we only drive
// the status text and re-enable the buttons.
chrome.runtime.onMessage.addListener(
  (msg: { type?: string; currentIndex?: number; total?: number; failedCount?: number }) => {
    if (msg.type === MESSAGE.AI_EVAL_PROGRESS) {
      setRunning(true); // a run is live (covers a dashboard opened mid-run)
      setEvalStatus('✦ Evaluating ' + String(msg.currentIndex) + '/' + String(msg.total) + '…');
    } else if (msg.type === MESSAGE.AI_EVAL_COMPLETE) {
      setRunning(false);
      setEvalStatus('✦ AI evaluation complete.');
    } else if (msg.type === MESSAGE.SCORING_PROGRESS) {
      setRunning(true);
      setEvalStatus('⭐ Scoring ' + String(msg.currentIndex) + '/' + String(msg.total) + '…');
    } else if (msg.type === MESSAGE.SCORING_COMPLETE) {
      setRunning(false);
      setEvalStatus('⭐ Scoring complete.');
    }
  },
);

// Stay in sync when the popup (or another dashboard tab) changes the data.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (
    changes.profiles ||
    changes.profileScores ||
    changes.aiEvals ||
    changes.shortlist ||
    changes.folders ||
    changes.aiUsage ||
    changes.aiPrices ||
    changes.usdToMyr ||
    changes.lastRemoved ||
    changes.uiTheme
  ) {
    void load().then(render);
  }
});

initSidebar();
void load().then(render);
