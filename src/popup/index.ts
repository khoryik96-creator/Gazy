import { state } from './state.js';
import { getStorage } from './storage.js';
import { renderProfiles } from './render.js';
import { initTheme } from './theme.js';
import { initFormPersistence } from './formData.js';
import { initTemplates } from './templates.js';
import { initButtons } from './events.js';
import { initMessageListener } from './messages.js';
import { rehydrateScoringStatus } from './scoringUI.js';
import type { ScoresMap } from '../shared/types.js';

async function init(): Promise<void> {
  const { profiles, profileScores } = (await getStorage(['profiles', 'profileScores'])) as {
    profiles?: string[];
    profileScores?: ScoresMap;
  };
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
  // If a scoring run is still going in the background, restore the progress UI.
  rehydrateScoringStatus();
}

void init();
