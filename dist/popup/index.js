import { state } from './state.js';
import { getStorage } from './storage.js';
import { renderProfiles } from './render.js';
import { initTheme } from './theme.js';
import { initFormPersistence } from './formData.js';
import { initTemplates } from './templates.js';
import { initButtons } from './events.js';
import { initMessageListener } from './messages.js';
import { rehydrateScoringStatus } from './scoringUI.js';
async function init() {
    const { profiles, profileScores, aiEvals } = (await getStorage([
        'profiles',
        'profileScores',
        'aiEvals',
    ]));
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
