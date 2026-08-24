import { dom } from './dom.js';
import { state } from './state.js';
import { setStatus } from './status.js';
import { renderProfiles } from './render.js';
import { getSearchQuery } from './searchQuery.js';
import { getScanPages } from './searchSettings.js';
import { setStorage } from './storage.js';
import { MESSAGE } from '../shared/constants.js';
function runSearch() {
    if (state.isSearching)
        return;
    const query = getSearchQuery();
    if (!query) {
        setStatus('Please enter keywords, a Boolean rule, or a job description.', 'error');
        return;
    }
    state.extractedProfiles = [];
    state.profileScores = {};
    renderProfiles();
    state.isSearching = true;
    dom.searchBtn.disabled = true;
    const maxPages = getScanPages();
    setStatus(maxPages > 1 ? 'Scanning up to ' + maxPages + ' pages…' : 'Searching LinkedIn…', 'info');
    // The background drives navigation across result pages (see searchSession.ts)
    // and reports progress, then a final PROFILES_FOUND.
    chrome.runtime.sendMessage({ type: MESSAGE.START_SEARCH, data: { query, maxPages } }, (response) => {
        if (!response || response.status !== 'started') {
            state.isSearching = false;
            dom.searchBtn.disabled = false;
            setStatus('❌ Failed to start search: ' + (response?.error || 'unknown error'), 'error');
        }
    });
}
export function initSearchButton() {
    dom.searchBtn.addEventListener('click', () => runSearch());
}
export function handleSearchMessage(message) {
    if (message.type === MESSAGE.SEARCH_PROGRESS) {
        const page = message.page;
        const maxPages = message.maxPages;
        const total = message.total;
        setStatus('Scanning page ' + page + '/' + maxPages + '… ' + total + ' found', 'info');
        return true;
    }
    if (message.type === MESSAGE.PROFILES_FOUND) {
        state.extractedProfiles = message.data;
        void setStorage({ profiles: state.extractedProfiles });
        renderProfiles();
        state.isSearching = false;
        dom.searchBtn.disabled = false;
        setStatus('Found ' + state.extractedProfiles.length + ' profiles', 'success');
        return true;
    }
    if (message.type === MESSAGE.EXTRACTION_ERROR) {
        state.isSearching = false;
        dom.searchBtn.disabled = false;
        setStatus('Error: ' + String(message.data), 'error');
        return true;
    }
    return false;
}
