import { scoreEntry } from '../shared/scoreView.js';
import { normalizeUiTheme } from '../shared/themes.js';
import { MESSAGE } from '../shared/constants.js';
import { emptyFolderStore, normalizeFolderStore, normalizeFolderName, createFolder, renameFolder, deleteFolder, toggleMembership, addMembership, removeUrlsFromFolders, foldersForUrl, folderCount, } from '../shared/folders.js';
import { openFolderMenu, openFolderPickMenu, closeFolderMenu } from './folderMenu.js';
import { initSidebar } from './sidebar.js';
import { renderCostPanel } from './costPanel.js';
import { emptyAiUsage, normalizeAiUsage, normalizePrices, DEFAULT_USD_TO_MYR, } from '../shared/aiCost.js';
import { getScoringKeywords } from '../shared/keywordExtraction.js';
import { compileBooleanRule } from '../shared/booleanExpression.js';
import { largeRunWarning } from '../shared/runGuard.js';
import { buildCandidateCsv, exportFilename } from '../shared/candidateExport.js';
const el = (id) => document.getElementById(id);
const tbody = el('tbody');
const emptyEl = el('empty');
const summaryEl = el('summary');
const tableEl = el('tbl');
const scoreBtn = el('scoreBtn');
const aiEvalBtn = el('aiEvalBtn');
const stopBtn = el('stopBtn');
const exportBtn = el('exportBtn');
const clearAllBtn = el('clearAllBtn');
const undoBtn = el('undoBtn');
const evalStatusEl = el('evalStatus');
const folderBar = el('folderBar');
const renameFolderBtn = el('renameFolderBtn');
const deleteFolderBtn = el('deleteFolderBtn');
const costPanel = el('costPanel');
const selectAllEl = el('selectAll');
const bulkBar = el('bulkBar');
const bulkCountEl = el('bulkCount');
const bulkShortlistBtn = el('bulkShortlist');
const bulkUnshortlistBtn = el('bulkUnshortlist');
const bulkFolderBtn = el('bulkFolder');
const bulkRemoveBtn = el('bulkRemove');
const bulkClearBtn = el('bulkClear');
let profiles = [];
let scores = {};
let aiEvals = {};
let shortlist = new Set();
let folders = emptyFolderStore();
let aiUsage = emptyAiUsage();
let aiPrices = normalizePrices(undefined);
let usdToMyr = DEFAULT_USD_TO_MYR;
// Snapshot of the most recent removal, for one-level Undo (persisted).
let lastRemoved = null;
// Ephemeral row selection (not persisted) for bulk shortlist / folder actions.
let selected = new Set();
// Anchor for Shift-click range selection: the URL of the last row clicked.
let lastSelUrl = null;
let view = { kind: 'all' };
let sortKey = 'kw';
let sortDir = -1; // default: highest score first
async function load() {
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
    ]));
    profiles = data.profiles || [];
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
    if (view.kind === 'folder' && !folders.order.includes(view.name))
        view = { kind: 'all' };
    document.body.dataset.theme = normalizeUiTheme(data.uiTheme);
}
function inView(url) {
    if (view.kind === 'all')
        return true;
    if (view.kind === 'shortlist')
        return shortlist.has(url);
    if (view.kind === 'folder')
        return folders.members[view.name]?.includes(url) ?? false;
    return false; // cost view isn't a candidate filter
}
function buildRows() {
    return profiles.map((url) => {
        const e = scoreEntry(scores, url);
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
        const a = aiEvals[url];
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
            shortlisted: shortlist.has(url),
            folders: foldersForUrl(folders, url),
        };
    });
}
function sortRows(rows) {
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
function render() {
    // The Cost tab replaces the candidate workspace with the spend breakdown.
    const isCost = view.kind === 'cost';
    el('tabAll').classList.toggle('active', view.kind === 'all');
    el('tabShort').classList.toggle('active', view.kind === 'shortlist');
    el('tabCost').classList.toggle('active', isCost);
    const toolbar = document.querySelector('.toolbar');
    const tableScroll = tableEl.closest('.table-scroll');
    if (isCost) {
        costPanel.style.display = '';
        if (toolbar)
            toolbar.style.display = 'none';
        if (tableScroll)
            tableScroll.style.display = 'none';
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
    if (toolbar)
        toolbar.style.display = '';
    if (tableScroll)
        tableScroll.style.display = '';
    folderBar.style.display = '';
    summaryEl.style.display = '';
    let rows = buildRows().filter((r) => inView(r.url));
    rows = sortRows(rows);
    // Drop selections for candidates no longer in the list (e.g. after a new search).
    const present = new Set(rows.map((r) => r.url));
    for (const u of [...selected])
        if (!present.has(u))
            selected.delete(u);
    tbody.replaceChildren();
    const viewRows = rows; // captured for range selection at click time
    viewRows.forEach((r, idx) => {
        const tr = document.createElement('tr');
        if (selected.has(r.url))
            tr.className = 'sel';
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
                    if (on)
                        selected.add(viewRows[k].url);
                    else
                        selected.delete(viewRows[k].url);
                }
            }
            else if (on) {
                selected.add(r.url);
            }
            else {
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
    syncSelectionUI(rows);
    updateHeaderArrows();
}
// Reflect the current selection in the header checkbox and the bulk action bar.
function syncSelectionUI(rows) {
    const selectedHere = rows.filter((r) => selected.has(r.url)).length;
    selectAllEl.checked = rows.length > 0 && selectedHere === rows.length;
    selectAllEl.indeterminate = selectedHere > 0 && selectedHere < rows.length;
    const n = selected.size;
    bulkBar.style.display = n > 0 ? '' : 'none';
    bulkCountEl.textContent = n + ' selected';
}
// One cell per candidate: the folders it belongs to as pills, plus a 🏷 button
// opening the assign popover.
function buildFolderCell(r) {
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
    btn.addEventListener('click', () => openFolderMenu({
        anchor: btn,
        url: r.url,
        store: folders,
        onToggle: (name) => void assignToggle(name, r.url),
        onCreate: (name) => void createAndAssign(name, r.url),
    }));
    td.appendChild(btn);
    return td;
}
function renderFolderBar() {
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
function updateHeaderArrows() {
    document.querySelectorAll('th[data-sort]').forEach((th) => {
        const key = th.dataset.sort;
        const base = th.textContent?.replace(/\s*[▲▼]$/, '') ?? '';
        th.textContent = base + (key === sortKey ? (sortDir === 1 ? ' ▲' : ' ▼') : '');
    });
}
async function persistFolders() {
    await chrome.storage.local.set({ folders });
}
async function toggleStar(url) {
    if (shortlist.has(url))
        shortlist.delete(url);
    else
        shortlist.add(url);
    await chrome.storage.local.set({ shortlist: [...shortlist] });
    render();
}
async function assignToggle(name, url) {
    folders = toggleMembership(folders, name, url);
    await persistFolders();
    render();
}
async function createAndAssign(name, url) {
    folders = toggleMembership(createFolder(folders, name), name.trim(), url);
    await persistFolders();
    closeFolderMenu();
    render();
}
async function newFolder() {
    const name = window.prompt('New folder name:')?.trim();
    if (!name)
        return;
    const before = folders.order.length;
    folders = createFolder(folders, name);
    if (folders.order.length === before)
        return; // blank or duplicate
    await persistFolders();
    setView({ kind: 'folder', name });
}
async function renameActiveFolder() {
    if (view.kind !== 'folder')
        return;
    const current = view.name;
    const next = window.prompt('Rename folder:', current)?.trim();
    if (!next || next === current)
        return;
    folders = renameFolder(folders, current, next);
    await persistFolders();
    setView(folders.order.includes(next) ? { kind: 'folder', name: next } : { kind: 'all' });
}
async function deleteActiveFolder() {
    if (view.kind !== 'folder')
        return;
    if (!window.confirm('Delete folder “' + view.name + '”? Candidates are not deleted.'))
        return;
    folders = deleteFolder(folders, view.name);
    await persistFolders();
    setView({ kind: 'all' });
}
function setView(next) {
    view = next;
    closeFolderMenu();
    render();
}
/** Human name for the current view, used in the export filename and status. */
function viewScopeName() {
    return view.kind === 'folder' ? view.name : view.kind;
}
// Export the candidates in the current view (all / shortlist / a folder) to CSV:
// name, URL, score, location, plus AI score and folders when present.
function exportCsv() {
    const rows = buildRows().filter((r) => inView(r.url));
    if (rows.length === 0) {
        setEvalStatus('No candidates to export.');
        return;
    }
    const csv = buildCandidateCsv(rows.map((r) => ({
        url: r.url,
        score: r.kw,
        ai: r.ai,
        location: r.location,
        folders: r.folders,
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = exportFilename(viewScopeName());
    a.click();
    URL.revokeObjectURL(a.href);
    setEvalStatus('⬇ Exported ' + rows.length + ' candidate(s) from “' + viewScopeName() + '”.');
}
function initHeaderSort() {
    document.querySelectorAll('th[data-sort]').forEach((th) => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            if (sortKey === key)
                sortDir = sortDir === 1 ? -1 : 1;
            else {
                sortKey = key;
                sortDir = key === 'name' || key === 'location' ? 1 : -1;
            }
            render();
        });
    });
}
// ---- Bulk selection: select-all + add the selection to shortlist / a folder ----
function toggleSelectAll() {
    const urls = viewUrls();
    if (selectAllEl.checked)
        urls.forEach((u) => selected.add(u));
    else
        urls.forEach((u) => selected.delete(u));
    render();
}
async function bulkSetShortlist(add) {
    if (selected.size === 0)
        return;
    for (const u of selected) {
        if (add)
            shortlist.add(u);
        else
            shortlist.delete(u);
    }
    await chrome.storage.local.set({ shortlist: [...shortlist] });
    setEvalStatus((add ? '⭐ Added ' : 'Removed ') +
        selected.size +
        ' candidate(s) ' +
        (add ? 'to' : 'from') +
        ' shortlist.');
    render();
}
function bulkAddToFolder() {
    if (selected.size === 0)
        return;
    openFolderPickMenu({
        anchor: bulkFolderBtn,
        store: folders,
        count: selected.size,
        onPick: (name) => void applyBulkFolder(name, false),
        onCreate: (name) => void applyBulkFolder(name, true),
    });
}
async function applyBulkFolder(rawName, create) {
    const name = normalizeFolderName(rawName);
    if (!name)
        return;
    let store = create ? createFolder(folders, name) : folders;
    const count = selected.size;
    for (const u of selected)
        store = addMembership(store, name, u);
    folders = store;
    await persistFolders();
    closeFolderMenu();
    setEvalStatus('🏷 Added ' + count + ' candidate(s) to “' + name + '”.');
    render();
}
function clearSelection() {
    selected = new Set();
    render();
}
// ---- Remove candidates: selected, or all ----
// Wipe the given candidates from every store (profiles, scores, AI evals,
// shortlist, folder membership) in one storage write, stashing a snapshot so the
// removal can be undone. storage.onChanged then reloads and re-renders.
async function removeCandidates(urls) {
    const keep = profiles.filter((u) => !urls.has(u));
    const nextScores = {};
    for (const u of keep)
        if (scores[u])
            nextScores[u] = scores[u];
    const nextAi = {};
    for (const u of keep)
        if (aiEvals[u])
            nextAi[u] = aiEvals[u];
    const nextShortlist = [...shortlist].filter((u) => !urls.has(u));
    const nextFolders = removeUrlsFromFolders(folders, urls);
    // Snapshot exactly what's being removed so Undo can restore it.
    const removedList = profiles.filter((u) => urls.has(u));
    const snap = {
        urls: removedList,
        scores: {},
        aiEvals: {},
        shortlisted: removedList.filter((u) => shortlist.has(u)),
        folders: {},
    };
    for (const u of removedList) {
        if (scores[u])
            snap.scores[u] = scores[u];
        if (aiEvals[u])
            snap.aiEvals[u] = aiEvals[u];
    }
    for (const name of folders.order) {
        const inFolder = removedList.filter((u) => folders.members[name].includes(u));
        if (inFolder.length)
            snap.folders[name] = inFolder;
    }
    selected = new Set();
    await chrome.storage.local.set({
        profiles: keep,
        profileScores: nextScores,
        aiEvals: nextAi,
        shortlist: nextShortlist,
        folders: nextFolders,
        lastRemoved: snap,
    });
}
// Restore the most recent removal. Adds the candidates back (appended), with
// their scores / AI evals / shortlist stars and any folder memberships whose
// folder still exists.
async function undoRemoval() {
    if (!lastRemoved)
        return;
    const snap = lastRemoved;
    const have = new Set(profiles);
    const restoredProfiles = [...profiles, ...snap.urls.filter((u) => !have.has(u))];
    const restoredScores = { ...scores, ...snap.scores };
    const restoredAi = { ...aiEvals, ...snap.aiEvals };
    const restoredShortlist = new Set(shortlist);
    for (const u of snap.shortlisted)
        restoredShortlist.add(u);
    let restoredFolders = folders;
    for (const name of Object.keys(snap.folders)) {
        if (!restoredFolders.order.includes(name))
            continue; // folder since deleted
        for (const u of snap.folders[name])
            restoredFolders = addMembership(restoredFolders, name, u);
    }
    lastRemoved = null;
    await chrome.storage.local.set({
        profiles: restoredProfiles,
        profileScores: restoredScores,
        aiEvals: restoredAi,
        shortlist: [...restoredShortlist],
        folders: restoredFolders,
        lastRemoved: null,
    });
    setEvalStatus('↩ Restored ' + snap.urls.length + ' candidate(s).');
}
async function removeSelected() {
    if (selected.size === 0)
        return;
    const n = selected.size;
    if (!confirm('Remove ' + n + ' selected candidate(s) from the dashboard?'))
        return;
    await removeCandidates(new Set(selected));
    setEvalStatus('🗑 Removed ' + n + ' candidate(s).');
}
async function clearAll() {
    if (profiles.length === 0)
        return;
    // Protect anything the user curated — candidates in a folder or on the
    // shortlist are kept. "Clear all" clears the working results, not saved picks.
    const saved = new Set(shortlist);
    for (const name of folders.order)
        for (const u of folders.members[name])
            saved.add(u);
    const toRemove = new Set(profiles.filter((u) => !saved.has(u)));
    if (toRemove.size === 0) {
        setEvalStatus('Nothing to clear — every candidate is in a folder or shortlisted.');
        return;
    }
    const keptNote = saved.size > 0 ? ' ' + saved.size + ' saved (folder/shortlist) candidate(s) are kept.' : '';
    if (!confirm('Remove ' + toRemove.size + ' unsaved candidate(s)?' + keptNote))
        return;
    await removeCandidates(toRemove);
    setEvalStatus('🗑 Cleared ' + toRemove.size + ' candidate(s).' + keptNote);
}
// ---- Cost tab: persist the editable FX rate / prices, reset counters ----
async function setUsdToMyr(n) {
    usdToMyr = n;
    await chrome.storage.local.set({ usdToMyr: n });
    render();
}
async function setAiPrices(p) {
    aiPrices = p;
    await chrome.storage.local.set({ aiPrices: p });
    render();
}
async function resetCost() {
    if (!confirm('Reset the tracked AI usage counters to zero?'))
        return;
    aiUsage = emptyAiUsage();
    await chrome.storage.local.set({ aiUsage });
    render();
}
el('tabAll').addEventListener('click', () => setView({ kind: 'all' }));
el('tabShort').addEventListener('click', () => setView({ kind: 'shortlist' }));
el('tabCost').addEventListener('click', () => setView({ kind: 'cost' }));
renameFolderBtn.addEventListener('click', () => void renameActiveFolder());
deleteFolderBtn.addEventListener('click', () => void deleteActiveFolder());
exportBtn.addEventListener('click', exportCsv);
clearAllBtn.addEventListener('click', () => void clearAll());
undoBtn.addEventListener('click', () => void undoRemoval());
stopBtn.addEventListener('click', stopRuns);
selectAllEl.addEventListener('change', toggleSelectAll);
bulkShortlistBtn.addEventListener('click', () => void bulkSetShortlist(true));
bulkUnshortlistBtn.addEventListener('click', () => void bulkSetShortlist(false));
bulkFolderBtn.addEventListener('click', bulkAddToFolder);
bulkRemoveBtn.addEventListener('click', () => void removeSelected());
bulkClearBtn.addEventListener('click', clearSelection);
initHeaderSort();
// ---- Run state: show Stop + disable Score/AI while a run is in flight ----
function setRunning(on) {
    stopBtn.style.display = on ? '' : 'none';
    scoreBtn.disabled = on;
    aiEvalBtn.disabled = on;
}
function stopRuns() {
    void chrome.runtime.sendMessage({ type: MESSAGE.STOP_SCORING }).catch(() => { });
    void chrome.runtime.sendMessage({ type: MESSAGE.STOP_AI_EVAL }).catch(() => { });
    setEvalStatus('⏹ Stopping…');
    setRunning(false);
}
function setEvalStatus(text) {
    evalStatusEl.textContent = text;
}
// The set of candidates the AI-Evaluate button acts on: whatever the active view
// shows (all results, the shortlist, or a folder).
function viewUrls() {
    return profiles.filter((u) => inView(u));
}
// Kick off AI evaluation from the dashboard. Reads the same DeepSeek key/model
// and job-description form data the popup persists to storage, then hands the
// work to the background engine (which persists results to storage.local, so
// they flow back here live via the storage.onChanged listener below).
async function startEval() {
    const urls = viewUrls();
    if (urls.length === 0) {
        setEvalStatus('No candidates to evaluate.');
        return;
    }
    const cfg = (await chrome.storage.local.get(['aiKey', 'aiModel', 'formData']));
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
    const model = cfg.aiModel === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';
    if (!confirm(largeRunWarning(urls.length, 'ai') +
        'Send ' +
        urls.length +
        ' profile(s) to DeepSeek (' +
        model +
        ') for AI evaluation?\n\nThis uses your API key and sends profile text to DeepSeek.')) {
        return;
    }
    setRunning(true);
    setEvalStatus('✦ Evaluating ' + urls.length + ' candidate(s)…');
    chrome.runtime.sendMessage({ type: MESSAGE.AI_EVALUATE, data: { profiles: urls, jd, apiKey, model } }, (response) => {
        if (!response || response.status !== 'started') {
            setRunning(false);
            setEvalStatus('❌ Failed to start: ' + (response?.error || 'unknown'));
        }
    });
}
aiEvalBtn.addEventListener('click', () => void startEval());
// Kick off keyword scoring from the dashboard. Mirrors the popup's Score button:
// derives keywords from the same stored job-description form data and hands the
// run to the background scoring engine, which persists profileScores to
// storage.local — so results flow back here live via storage.onChanged.
async function startScoring() {
    const urls = viewUrls();
    if (urls.length === 0) {
        setEvalStatus('No candidates to score.');
        return;
    }
    const cfg = (await chrome.storage.local.get('formData'));
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
        }
        catch (e) {
            setEvalStatus('❌ Invalid Boolean rule: ' + e.message);
            return;
        }
    }
    if (!confirm(largeRunWarning(urls.length, 'score') +
        'Score ' +
        urls.length +
        ' candidate(s)? This visits each LinkedIn profile in the background to scrape and score it.')) {
        return;
    }
    setRunning(true);
    setEvalStatus('⭐ Scoring ' + urls.length + ' candidate(s)…');
    chrome.runtime.sendMessage({
        type: MESSAGE.START_SCORING,
        data: { profiles: urls, keywords, booleanRule, countryFilter: fd.country || '' },
    }, (response) => {
        if (!response || response.status !== 'started') {
            setRunning(false);
            setEvalStatus('❌ Failed to start scoring: ' + (response?.error || 'unknown'));
        }
    });
}
scoreBtn.addEventListener('click', () => void startScoring());
// Progress/completion come back from the background engines. Rendered results
// arrive through storage.onChanged (aiEvals / profileScores); here we only drive
// the status text and re-enable the buttons.
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === MESSAGE.AI_EVAL_PROGRESS) {
        setRunning(true); // a run is live (covers a dashboard opened mid-run)
        setEvalStatus('✦ Evaluating ' + String(msg.currentIndex) + '/' + String(msg.total) + '…');
    }
    else if (msg.type === MESSAGE.AI_EVAL_COMPLETE) {
        setRunning(false);
        setEvalStatus('✦ AI evaluation complete.');
    }
    else if (msg.type === MESSAGE.SCORING_PROGRESS) {
        setRunning(true);
        setEvalStatus('⭐ Scoring ' + String(msg.currentIndex) + '/' + String(msg.total) + '…');
    }
    else if (msg.type === MESSAGE.SCORING_COMPLETE) {
        setRunning(false);
        setEvalStatus('⭐ Scoring complete.');
    }
});
// Stay in sync when the popup (or another dashboard tab) changes the data.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local')
        return;
    if (changes.profiles ||
        changes.profileScores ||
        changes.aiEvals ||
        changes.shortlist ||
        changes.folders ||
        changes.aiUsage ||
        changes.aiPrices ||
        changes.usdToMyr ||
        changes.lastRemoved ||
        changes.uiTheme) {
        void load().then(render);
    }
});
initSidebar();
void load().then(render);
