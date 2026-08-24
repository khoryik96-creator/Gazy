import { scoreEntry } from '../shared/scoreView.js';
import { normalizeUiTheme } from '../shared/themes.js';
import { MESSAGE } from '../shared/constants.js';
import { emptyFolderStore, normalizeFolderStore, createFolder, renameFolder, deleteFolder, toggleMembership, foldersForUrl, folderCount, } from '../shared/folders.js';
import { openFolderMenu, closeFolderMenu } from './folderMenu.js';
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
const exportBtn = el('exportBtn');
const evalStatusEl = el('evalStatus');
const folderBar = el('folderBar');
const renameFolderBtn = el('renameFolderBtn');
const deleteFolderBtn = el('deleteFolderBtn');
let profiles = [];
let scores = {};
let aiEvals = {};
let shortlist = new Set();
let folders = emptyFolderStore();
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
        'uiTheme',
    ]));
    profiles = data.profiles || [];
    scores = data.profileScores || {};
    aiEvals = data.aiEvals || {};
    shortlist = new Set(data.shortlist || []);
    folders = normalizeFolderStore(data.folders);
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
    return folders.members[view.name]?.includes(url) ?? false;
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
    let rows = buildRows().filter((r) => inView(r.url));
    rows = sortRows(rows);
    tbody.replaceChildren();
    for (const r of rows) {
        const tr = document.createElement('tr');
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
    }
    const total = profiles.length;
    const shortCount = profiles.filter((u) => shortlist.has(u)).length;
    emptyEl.style.display = rows.length === 0 ? 'block' : 'none';
    tableEl.style.display = rows.length === 0 ? 'none' : '';
    summaryEl.textContent =
        view.kind === 'shortlist'
            ? shortCount + ' shortlisted candidate(s)'
            : view.kind === 'folder'
                ? rows.length + ' candidate(s) in “' + view.name + '”'
                : total + ' candidate(s) · ' + shortCount + ' shortlisted';
    renderFolderBar();
    el('tabAll').classList.toggle('active', view.kind === 'all');
    el('tabShort').classList.toggle('active', view.kind === 'shortlist');
    renameFolderBtn.style.display = view.kind === 'folder' ? '' : 'none';
    deleteFolderBtn.style.display = view.kind === 'folder' ? '' : 'none';
    updateHeaderArrows();
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
el('tabAll').addEventListener('click', () => setView({ kind: 'all' }));
el('tabShort').addEventListener('click', () => setView({ kind: 'shortlist' }));
renameFolderBtn.addEventListener('click', () => void renameActiveFolder());
deleteFolderBtn.addEventListener('click', () => void deleteActiveFolder());
exportBtn.addEventListener('click', exportCsv);
initHeaderSort();
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
        setEvalStatus('Add your DeepSeek API key in the extension popup ⚙️ settings first.');
        return;
    }
    const fd = cfg.formData || {};
    const jd = (fd.jd || fd.keywords || fd.booleanRule || '').trim();
    if (!jd) {
        setEvalStatus('Add a job description or keywords in the extension popup first.');
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
    aiEvalBtn.disabled = true;
    setEvalStatus('✦ Evaluating ' + urls.length + ' candidate(s)…');
    chrome.runtime.sendMessage({ type: MESSAGE.AI_EVALUATE, data: { profiles: urls, jd, apiKey, model } }, (response) => {
        if (!response || response.status !== 'started') {
            aiEvalBtn.disabled = false;
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
        setEvalStatus('Add a job description, Boolean rule, or keywords in the extension popup first.');
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
    scoreBtn.disabled = true;
    setEvalStatus('⭐ Scoring ' + urls.length + ' candidate(s)…');
    chrome.runtime.sendMessage({
        type: MESSAGE.START_SCORING,
        data: { profiles: urls, keywords, booleanRule, countryFilter: fd.country || '' },
    }, (response) => {
        if (!response || response.status !== 'started') {
            scoreBtn.disabled = false;
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
        setEvalStatus('✦ Evaluating ' + String(msg.currentIndex) + '/' + String(msg.total) + '…');
    }
    else if (msg.type === MESSAGE.AI_EVAL_COMPLETE) {
        aiEvalBtn.disabled = false;
        setEvalStatus('✦ AI evaluation complete.');
    }
    else if (msg.type === MESSAGE.SCORING_PROGRESS) {
        setEvalStatus('⭐ Scoring ' + String(msg.currentIndex) + '/' + String(msg.total) + '…');
    }
    else if (msg.type === MESSAGE.SCORING_COMPLETE) {
        scoreBtn.disabled = false;
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
        changes.uiTheme) {
        void load().then(render);
    }
});
void load().then(render);
