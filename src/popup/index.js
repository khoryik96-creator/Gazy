import { state } from './state.js';
import { getStorage } from './storage.js';
import { renderProfiles } from './render.js';
import { initTheme } from './theme.js';
import { initFormPersistence } from './formData.js';
import { initTemplates } from './templates.js';
import { initButtons } from './events.js';
import { initMessageListener } from './messages.js';

console.log('✅ popup.js loaded');

async function init() {
  const { profiles, profileScores } = await getStorage(['profiles', 'profileScores']);
  if (profiles) {
    state.extractedProfiles = profiles;
    state.profileScores = profileScores || {};
    renderProfiles();
  }

  await initTheme();
  initFormPersistence();
  initTemplates();
  initButtons();
  initMessageListener();
}

init();
