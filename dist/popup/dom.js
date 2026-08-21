// The only module that touches document.getElementById; every other popup
// module imports typed element refs from here. Elements are asserted non-null
// because they are all declared statically in popup.html.
const id = (elementId) => document.getElementById(elementId);
export const dom = {
    jdInput: id('jdInput'),
    keywordsInput: id('keywordsInput'),
    booleanRuleInput: id('booleanRule'),
    countryFilterInput: id('countryFilter'),
    searchBtn: id('searchBtn'),
    clearBtn: id('clearBtn'),
    copyAllBtn: id('copyAllBtn'),
    scoreBtn: id('scoreBtn'),
    exportBtn: id('exportBtn'),
    resultsContainer: id('resultsContainer'),
    profileCount: id('profileCount'),
    status: id('status'),
    progressArea: id('progressArea'),
    progressBar: id('progressBar'),
    progressLabel: id('progressLabel'),
    etaLabel: id('etaLabel'),
    hideZeroCheck: id('hideZero'),
    themeToggle: id('themeToggle'),
    templateSelect: id('templateSelect'),
    saveTemplateBtn: id('saveTemplateBtn'),
    loadTemplateBtn: id('loadTemplateBtn'),
    deleteTemplateBtn: id('deleteTemplateBtn'),
    clearCacheBtn: id('clearCacheBtn'),
};
