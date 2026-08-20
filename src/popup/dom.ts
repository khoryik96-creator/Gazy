// The only module that touches document.getElementById; every other popup
// module imports typed element refs from here. Elements are asserted non-null
// because they are all declared statically in popup.html.
const id = <T extends HTMLElement>(elementId: string): T => document.getElementById(elementId) as T;

export const dom = {
  jdInput: id<HTMLTextAreaElement>('jdInput'),
  keywordsInput: id<HTMLInputElement>('keywordsInput'),
  booleanRuleInput: id<HTMLInputElement>('booleanRule'),
  countryFilterInput: id<HTMLInputElement>('countryFilter'),
  searchBtn: id<HTMLButtonElement>('searchBtn'),
  clearBtn: id<HTMLButtonElement>('clearBtn'),
  copyAllBtn: id<HTMLButtonElement>('copyAllBtn'),
  scoreBtn: id<HTMLButtonElement>('scoreBtn'),
  exportBtn: id<HTMLButtonElement>('exportBtn'),
  resultsContainer: id<HTMLDivElement>('resultsContainer'),
  profileCount: id<HTMLSpanElement>('profileCount'),
  status: id<HTMLSpanElement>('status'),
  progressArea: id<HTMLDivElement>('progressArea'),
  progressBar: id<HTMLProgressElement>('progressBar'),
  progressLabel: id<HTMLSpanElement>('progressLabel'),
  etaLabel: id<HTMLSpanElement>('etaLabel'),
  hideZeroCheck: id<HTMLInputElement>('hideZero'),
  themeToggle: id<HTMLButtonElement>('themeToggle'),
  templateSelect: id<HTMLSelectElement>('templateSelect'),
  saveTemplateBtn: id<HTMLButtonElement>('saveTemplateBtn'),
  loadTemplateBtn: id<HTMLButtonElement>('loadTemplateBtn'),
  deleteTemplateBtn: id<HTMLButtonElement>('deleteTemplateBtn'),
  clearCacheBtn: id<HTMLButtonElement>('clearCacheBtn'),
};
