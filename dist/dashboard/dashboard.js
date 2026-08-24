import { scoreEntry } from '../shared/scoreView.js';
import { normalizeUiTheme } from '../shared/themes.js';
const el = (id) => document.getElementById(id);
const tbody = el('tbody');
const emptyEl = el('empty');
const summaryEl = el('summary');
const tableEl = el('tbl');
let profiles = [];
let scores = {};
let aiEvals = {};
let shortlist = new Set();
let tab = 'all';
let sortKey = 'kw';
let sortDir = -1; // default: highest score first
async function load() {
    const data = (await chrome.storage.local.get([
        'profiles',
        'profileScores',
        'aiEvals',
        'shortlist',
        'uiTheme',
    ]));
    profiles = data.profiles || [];
    scores = data.profileScores || {};
    aiEvals = data.aiEvals || {};
    shortlist = new Set(data.shortlist || []);
    document.body.dataset.theme = normalizeUiTheme(data.uiTheme);
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
    let rows = buildRows();
    if (tab === 'shortlist')
        rows = rows.filter((r) => r.shortlisted);
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
        tab === 'shortlist'
            ? shortCount + ' shortlisted candidate(s)'
            : total + ' candidate(s) · ' + shortCount + ' shortlisted';
    updateHeaderArrows();
}
function updateHeaderArrows() {
    document.querySelectorAll('th[data-sort]').forEach((th) => {
        const key = th.dataset.sort;
        const base = th.textContent?.replace(/\s*[▲▼]$/, '') ?? '';
        th.textContent = base + (key === sortKey ? (sortDir === 1 ? ' ▲' : ' ▼') : '');
    });
}
async function toggleStar(url) {
    if (shortlist.has(url))
        shortlist.delete(url);
    else
        shortlist.add(url);
    await chrome.storage.local.set({ shortlist: [...shortlist] });
    render();
}
function setTab(next) {
    tab = next;
    el('tabAll').classList.toggle('active', next === 'all');
    el('tabShort').classList.toggle('active', next === 'shortlist');
    render();
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
el('tabAll').addEventListener('click', () => setTab('all'));
el('tabShort').addEventListener('click', () => setTab('shortlist'));
initHeaderSort();
// Stay in sync when the popup (or another dashboard tab) changes the data.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local')
        return;
    if (changes.profiles ||
        changes.profileScores ||
        changes.aiEvals ||
        changes.shortlist ||
        changes.uiTheme) {
        void load().then(render);
    }
});
void load().then(render);
