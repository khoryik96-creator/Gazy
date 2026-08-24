import { state } from './state.js';
import { getStorage } from './storage.js';
import { renderProfiles } from './render.js';
import { initTheme } from './theme.js';
import { initFormPersistence } from './formData.js';
import { initTemplates } from './templates.js';
import { initButtons } from './events.js';
import { initMessageListener } from './messages.js';
import { rehydrateScoringStatus } from './scoringUI.js';
import { loadShortlist } from './shortlist.js';
import type { ScoresMap, AiEvalMap } from '../shared/types.js';

async function init(): Promise<void> {
  // Load the saved shortlist before the first render so stars show correctly.
  await loadShortlist();

  const { profiles, profileScores, aiEvals } = (await getStorage([
    'profiles',
    'profileScores',
    'aiEvals',
  ])) as {
    profiles?: string[];
    profileScores?: ScoresMap;
    aiEvals?: AiEvalMap;
  };
  if (profiles) {
    state.extractedProfiles = profiles;
    state.profileScores = profileScores || {};
    state.aiEvals = aiEvals || {};
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
