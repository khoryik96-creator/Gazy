import { dom } from './dom.js';
import { state } from './state.js';
import { setStatus } from './status.js';
import { renderProfiles } from './render.js';
import { getSearchQuery } from './searchQuery.js';
import { setStorage } from './storage.js';
import { MESSAGE } from '../shared/constants.js';
import type { RuntimeMessage } from '../shared/types.js';

export function initSearchButton(): void {
  dom.searchBtn.addEventListener('click', async () => {
    if (state.isSearching) return;

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
    setStatus('Searching LinkedIn...', 'info');

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.id) {
      setStatus('No active tab found.', 'error');
      state.isSearching = false;
      dom.searchBtn.disabled = false;
      return;
    }

    const searchURL = 'https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent(query);
    await chrome.tabs.update(tab.id, { url: searchURL });
    setStatus('Waiting for profile extraction...', 'info');
  });
}

export function handleSearchMessage(message: RuntimeMessage): boolean {
  if (message.type === MESSAGE.PROFILES_FOUND) {
    state.extractedProfiles = message.data as string[];
    setStorage({ profiles: state.extractedProfiles });
    renderProfiles();
    state.isSearching = false;
    dom.searchBtn.disabled = false;
    setStatus('Found ' + state.extractedProfiles.length + ' profiles', 'success');
    return true;
  }

  if (message.type === MESSAGE.EXTRACTION_ERROR) {
    state.isSearching = false;
    dom.searchBtn.disabled = false;
    setStatus('Error: ' + message.data, 'error');
    return true;
  }

  return false;
}
