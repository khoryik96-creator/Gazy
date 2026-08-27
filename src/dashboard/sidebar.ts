import { MESSAGE } from '../shared/constants.js';
import { UI_THEMES, UI_THEME_LABELS, normalizeUiTheme } from '../shared/themes.js';
import { extractKeywordsFromJD } from '../shared/keywordExtraction.js';
import { compileBooleanRule } from '../shared/booleanExpression.js';
import { clampScanPages } from '../shared/pagination.js';
import { DEFAULT_SCAN_PAGES, MAX_SCAN_PAGES } from '../shared/constants.js';
import { COUNTRIES, canonicalCountry } from '../shared/countries.js';
import { readJdFile } from './fileImport.js';
import { getStorage } from '../shared/storage.js';
import type { AiModel } from '../shared/types.js';

// The dashboard's left rail (Option A "Sidebar Console"). It owns the search
// criteria, templates, and settings — persisting to the SAME storage keys the
// popup uses (formData, templates, aiKey, aiModel, uiTheme, scanPages), so the
// two surfaces stay in sync. Result actions (Score/AI/Export) live in
// dashboard.ts and read those same keys at action time, so no direct coupling is
// needed — the sidebar just keeps storage current and kicks off searches.

const FAST: AiModel = 'deepseek-chat';
const SMART: AiModel = 'deepseek-reasoner';

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

export function initSidebar(): void {
  const jd = el<HTMLTextAreaElement>('jdInput');
  const keywords = el<HTMLInputElement>('keywordsInput');
  const boolean = el<HTMLInputElement>('booleanRule');
  const country = el<HTMLInputElement>('countryFilter');
  const searchBtn = el<HTMLButtonElement>('searchBtn');
  const searchStatus = el<HTMLSpanElement>('searchStatus');
  const themeSelect = el<HTMLSelectElement>('themeSelect');
  const scanPages = el<HTMLInputElement>('scanPages');
  const aiKey = el<HTMLInputElement>('aiKey');
  const aiFast = el<HTMLInputElement>('aiFast');
  const aiSmart = el<HTMLInputElement>('aiSmart');
  const templateSelect = el<HTMLSelectElement>('templateSelect');
  const saveTemplateBtn = el<HTMLButtonElement>('saveTemplateBtn');
  const loadTemplateBtn = el<HTMLButtonElement>('loadTemplateBtn');
  const deleteTemplateBtn = el<HTMLButtonElement>('deleteTemplateBtn');

  const setStatus = (msg: string): void => {
    searchStatus.textContent = msg;
  };

  // ---- Criteria: persisted to `formData` (same shape/key as the popup) ----
  const saveFormData = (): void => {
    void chrome.storage.local.set({
      formData: {
        jd: jd.value,
        keywords: keywords.value,
        booleanRule: boolean.value,
        country: country.value,
      },
    });
  };
  [jd, keywords, boolean, country].forEach((input) =>
    input.addEventListener('input', saveFormData),
  );

  // ---- Location: a country combobox (free text still allowed) ----
  const countryList = el<HTMLDataListElement>('countryList');
  for (const name of COUNTRIES) {
    const opt = document.createElement('option');
    opt.value = name;
    countryList.appendChild(opt);
  }
  // Snap a typed country to its canonical spelling (e.g. "malaysia" → "Malaysia").
  country.addEventListener('change', () => {
    const canon = canonicalCountry(country.value);
    if (canon !== country.value) {
      country.value = canon;
      saveFormData();
    }
  });

  // ---- Drop / attach a JD file (.txt / .docx / .pdf) ----
  const jdDrop = el<HTMLDivElement>('jdDrop');
  const jdFile = el<HTMLInputElement>('jdFile');
  const jdFileBtn = el<HTMLButtonElement>('jdFileBtn');

  const importFile = (file: File): void => {
    setStatus('Reading “' + file.name + '”…');
    void readJdFile(file)
      .then((res) => {
        if (res.text) {
          jd.value = res.text;
          saveFormData();
        }
        setStatus(res.warning ?? '✅ Loaded “' + file.name + '”.');
      })
      .catch((e: Error) => setStatus('❌ ' + e.message));
  };

  jdFileBtn.addEventListener('click', () => jdFile.click());
  jdFile.addEventListener('change', () => {
    const file = jdFile.files?.[0];
    if (file) importFile(file);
    jdFile.value = ''; // allow re-selecting the same file
  });
  jdDrop.addEventListener('dragover', (e) => {
    e.preventDefault();
    jdDrop.classList.add('drag');
  });
  jdDrop.addEventListener('dragleave', (e) => {
    // Only clear when the pointer actually leaves the drop zone — not when it
    // crosses onto a child (the textarea), which would flicker the highlight.
    if (!jdDrop.contains(e.relatedTarget as Node | null)) jdDrop.classList.remove('drag');
  });
  jdDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    jdDrop.classList.remove('drag');
    const file = e.dataTransfer?.files?.[0];
    if (file) importFile(file);
  });

  // ---- Search precedence: manual keywords → Boolean rule → keywords from JD ----
  const searchQuery = (): string => {
    if (keywords.value.trim()) return keywords.value.trim();
    if (boolean.value.trim()) return boolean.value.trim();
    if (jd.value.trim()) return extractKeywordsFromJD(jd.value);
    return '';
  };

  const runSearch = (): void => {
    const query = searchQuery();
    if (!query) {
      setStatus('Enter keywords, a Boolean rule, or a job description.');
      return;
    }
    if (boolean.value.trim()) {
      try {
        compileBooleanRule(boolean.value);
      } catch (e) {
        setStatus('❌ Invalid Boolean rule: ' + (e as Error).message);
        return;
      }
    }
    const maxPages = clampScanPages(parseInt(scanPages.value, 10));
    searchBtn.disabled = true;
    setStatus(
      maxPages > 1 ? 'Opening search — scanning up to ' + maxPages + ' pages…' : 'Opening search…',
    );
    // newTab: run in a dedicated LinkedIn tab so the dashboard isn't navigated away.
    chrome.runtime.sendMessage(
      { type: MESSAGE.START_SEARCH, data: { query, maxPages, newTab: true } },
      (response?: { status?: string; error?: string }) => {
        searchBtn.disabled = false;
        if (!response || response.status !== 'started') {
          setStatus('❌ Failed to start search: ' + (response?.error || 'unknown'));
        }
      },
    );
  };
  searchBtn.addEventListener('click', runSearch);

  // Reflect background search progress (results land via storage.onChanged).
  chrome.runtime.onMessage.addListener(
    (msg: { type?: string; page?: number; maxPages?: number; total?: number; data?: unknown }) => {
      if (msg.type === MESSAGE.SEARCH_PROGRESS) {
        setStatus(
          'Scanning page ' +
            String(msg.page) +
            '/' +
            String(msg.maxPages) +
            '… ' +
            String(msg.total) +
            ' found',
        );
      } else if (msg.type === MESSAGE.PROFILES_FOUND) {
        const n = Array.isArray(msg.data) ? msg.data.length : 0;
        setStatus('✅ Found ' + n + ' candidate(s).');
      } else if (msg.type === MESSAGE.EXTRACTION_ERROR) {
        setStatus('⚠️ ' + (typeof msg.data === 'string' ? msg.data : 'No profiles found.'));
      }
    },
  );

  // ---- Theme ----
  for (const t of UI_THEMES) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = UI_THEME_LABELS[t];
    themeSelect.appendChild(opt);
  }
  themeSelect.addEventListener('change', () => {
    const theme = normalizeUiTheme(themeSelect.value);
    document.body.dataset.theme = theme;
    void chrome.storage.local.set({ uiTheme: theme });
  });

  // ---- Pages to scan ----
  scanPages.max = String(MAX_SCAN_PAGES);
  scanPages.addEventListener('change', () => {
    const n = clampScanPages(parseInt(scanPages.value, 10));
    scanPages.value = String(n);
    void chrome.storage.local.set({ scanPages: n });
  });

  // ---- DeepSeek key + model ----
  aiKey.addEventListener('change', () => {
    void chrome.storage.local.set({ aiKey: aiKey.value.trim() });
  });
  const applyModel = (model: AiModel): void => {
    aiFast.checked = model === FAST;
    aiSmart.checked = model === SMART;
    void chrome.storage.local.set({ aiModel: model });
  };
  aiFast.addEventListener('change', () => applyModel(aiFast.checked ? FAST : SMART));
  aiSmart.addEventListener('change', () => applyModel(aiSmart.checked ? SMART : FAST));

  // ---- Templates (same `templates` storage as the popup) ----
  const loadTemplateDropdown = async (): Promise<void> => {
    const { templates = {} } = await getStorage(['templates']);
    templateSelect.innerHTML = '<option value="">— Load template —</option>';
    for (const name in templates) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      templateSelect.appendChild(opt);
    }
  };
  saveTemplateBtn.addEventListener('click', () => {
    void (async () => {
      const name = window.prompt('Template name:', templateSelect.value || '')?.trim();
      if (!name) return;
      const { templates = {} } = await getStorage(['templates']);
      if (templates[name] && !window.confirm('Overwrite template “' + name + '”?')) return;
      templates[name] = {
        jd: jd.value,
        keywords: keywords.value,
        booleanRule: boolean.value,
        country: country.value,
      };
      await chrome.storage.local.set({ templates });
      await loadTemplateDropdown();
      templateSelect.value = name;
      setStatus('✅ Saved template “' + name + '”.');
    })();
  });
  loadTemplateBtn.addEventListener('click', () => {
    void (async () => {
      const name = templateSelect.value;
      if (!name) return;
      const { templates = {} } = await getStorage(['templates']);
      const t = templates[name];
      if (!t) return;
      jd.value = t.jd || '';
      keywords.value = t.keywords || '';
      boolean.value = t.booleanRule || '';
      country.value = t.country || '';
      saveFormData();
      setStatus('📂 Loaded “' + name + '”.');
    })();
  });
  deleteTemplateBtn.addEventListener('click', () => {
    void (async () => {
      const name = templateSelect.value;
      if (!name || !window.confirm('Delete template “' + name + '”?')) return;
      const { templates = {} } = await getStorage(['templates']);
      delete templates[name];
      await chrome.storage.local.set({ templates });
      await loadTemplateDropdown();
      setStatus('🗑️ Deleted “' + name + '”.');
    })();
  });

  // ---- Initial load of persisted values ----
  void (async () => {
    const data = await getStorage(['formData', 'aiKey', 'aiModel', 'uiTheme', 'scanPages']);
    const fd = data.formData;
    if (fd) {
      jd.value = fd.jd || '';
      keywords.value = fd.keywords || '';
      boolean.value = fd.booleanRule || '';
      country.value = fd.country || '';
    }
    if (data.aiKey) aiKey.value = data.aiKey;
    applyModel(data.aiModel === SMART ? SMART : FAST);
    themeSelect.value = normalizeUiTheme(data.uiTheme);
    scanPages.value = String(data.scanPages ? clampScanPages(data.scanPages) : DEFAULT_SCAN_PAGES);
    await loadTemplateDropdown();
  })();
}
