import { scoreEntry } from '../shared/scoreView.js';
import { normalizeUiTheme } from '../shared/themes.js';
import { MESSAGE } from '../shared/constants.js';
import type { ScoresMap, AiEvalMap, AiModel } from '../shared/types.js';

// Full-page dashboard. Reads the same chrome.storage.local data the popup
// writes (profiles, profileScores, aiEvals, shortlist) and shows it in a roomy,
// sortable table with two tabs (All results / Shortlist). Read-only except for
// the shortlist star, which writes back to storage so the popup stays in sync.

type SortKey = 'name' | 'kw' | 'ai' | 'location';

interface Row {
  url: string;
  name: string;
  kw: number | null; // keyword score, or null when not scored / scrape failed
  kwLabel: string;
  kwClass: string;
  ai: number | null;
  aiLabel: string;
  location: string;
  shortlisted: boolean;
}

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const tbody = el<HTMLTableSectionElement>('tbody');
const emptyEl = el<HTMLDivElement>('empty');
const summaryEl = el<HTMLDivElement>('summary');
const tableEl = el<HTMLTableElement>('tbl');
const aiEvalBtn = el<HTMLButtonElement>('aiEvalBtn');
const evalStatusEl = el<HTMLSpanElement>('evalStatus');

let profiles: string[] = [];
let scores: ScoresMap = {};
let aiEvals: AiEvalMap = {};
let shortlist = new Set<string>();

let tab: 'all' | 'shortlist' = 'all';
let sortKey: SortKey = 'kw';
let sortDir: 1 | -1 = -1; // default: highest score first

async function load(): Promise<void> {
  const data = (await chrome.storage.local.get([
    'profiles',
    'profileScores',
    'aiEvals',
    'shortlist',
    'uiTheme',
  ])) as unknown as {
    profiles?: string[];
    profileScores?: ScoresMap;
    aiEvals?: AiEvalMap;
    shortlist?: string[];
    uiTheme?: string;
  };
  profiles = data.profiles || [];
  scores = data.profileScores || {};
  aiEvals = data.aiEvals || {};
  shortlist = new Set(data.shortlist || []);
  document.body.dataset.theme = normalizeUiTheme(data.uiTheme);
}

function buildRows(): Row[] {
  return profiles.map((url) => {
    const e = scoreEntry(scores, url);
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

    const a = aiEvals[url];
    let ai: number | null = null;
    let aiLabel = '';
    if (a) {
      if (a.error) aiLabel = '⚠️';
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

function sortRows(rows: Row[]): Row[] {
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

function render(): void {
  let rows = buildRows();
  if (tab === 'shortlist') rows = rows.filter((r) => r.shortlisted);
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

function updateHeaderArrows(): void {
  document.querySelectorAll<HTMLTableCellElement>('th[data-sort]').forEach((th) => {
    const key = th.dataset.sort as SortKey;
    const base = th.textContent?.replace(/\s*[▲▼]$/, '') ?? '';
    th.textContent = base + (key === sortKey ? (sortDir === 1 ? ' ▲' : ' ▼') : '');
  });
}

async function toggleStar(url: string): Promise<void> {
  if (shortlist.has(url)) shortlist.delete(url);
  else shortlist.add(url);
  await chrome.storage.local.set({ shortlist: [...shortlist] });
  render();
}

function setTab(next: 'all' | 'shortlist'): void {
  tab = next;
  el<HTMLButtonElement>('tabAll').classList.toggle('active', next === 'all');
  el<HTMLButtonElement>('tabShort').classList.toggle('active', next === 'shortlist');
  render();
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

el<HTMLButtonElement>('tabAll').addEventListener('click', () => setTab('all'));
el<HTMLButtonElement>('tabShort').addEventListener('click', () => setTab('shortlist'));
initHeaderSort();

// The set of candidates the AI-Evaluate button acts on: the shortlist when that
// tab is active, otherwise every extracted profile.
function viewUrls(): string[] {
  return tab === 'shortlist' ? profiles.filter((u) => shortlist.has(u)) : profiles.slice();
}

function setEvalStatus(text: string): void {
  evalStatusEl.textContent = text;
}

// Kick off AI evaluation from the dashboard. Reads the same DeepSeek key/model
// and job-description form data the popup persists to storage, then hands the
// work to the background engine (which persists results to storage.local, so
// they flow back here live via the storage.onChanged listener below).
async function startEval(): Promise<void> {
  const urls = viewUrls();
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
    setEvalStatus('Add your DeepSeek API key in the extension popup ⚙️ settings first.');
    return;
  }

  const fd = cfg.formData || {};
  const jd = (fd.jd || fd.keywords || fd.booleanRule || '').trim();
  if (!jd) {
    setEvalStatus('Add a job description or keywords in the extension popup first.');
    return;
  }

  const model: AiModel =
    cfg.aiModel === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';

  if (
    !confirm(
      'Send ' +
        urls.length +
        ' profile(s) to DeepSeek (' +
        model +
        ') for AI evaluation?\n\nThis uses your API key and sends profile text to DeepSeek.',
    )
  ) {
    return;
  }

  aiEvalBtn.disabled = true;
  setEvalStatus('✦ Evaluating ' + urls.length + ' candidate(s)…');
  chrome.runtime.sendMessage(
    { type: MESSAGE.AI_EVALUATE, data: { profiles: urls, jd, apiKey, model } },
    (response?: { status?: string; error?: string }) => {
      if (!response || response.status !== 'started') {
        aiEvalBtn.disabled = false;
        setEvalStatus('❌ Failed to start: ' + (response?.error || 'unknown'));
      }
    },
  );
}

aiEvalBtn.addEventListener('click', () => void startEval());

// Progress/completion come back from the background engine. Rendered results
// arrive through storage.onChanged (aiEvals); here we only drive the status text
// and re-enable the button.
chrome.runtime.onMessage.addListener(
  (msg: { type?: string; currentIndex?: number; total?: number }) => {
    if (msg.type === MESSAGE.AI_EVAL_PROGRESS) {
      setEvalStatus('✦ Evaluating ' + String(msg.currentIndex) + '/' + String(msg.total) + '…');
    } else if (msg.type === MESSAGE.AI_EVAL_COMPLETE) {
      aiEvalBtn.disabled = false;
      setEvalStatus('✦ AI evaluation complete.');
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
    changes.uiTheme
  ) {
    void load().then(render);
  }
});

void load().then(render);
