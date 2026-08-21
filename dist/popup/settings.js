import { dom } from './dom.js';
import { getStorage, setStorage } from './storage.js';
const FAST = 'deepseek-chat';
const SMART = 'deepseek-reasoner';
let currentModel = FAST;
/** The chosen DeepSeek model. */
export function getAiModel() {
    return currentModel;
}
/** The stored DeepSeek API key (empty string when unset). */
export function getAiKey() {
    return dom.aiKeyInput.value.trim();
}
function applyModel(model) {
    currentModel = model;
    // The two toggles are mutually exclusive and one is always on.
    dom.aiFastToggle.checked = model === FAST;
    dom.aiSmartToggle.checked = model === SMART;
    void setStorage({ aiModel: model });
}
export function initSettings() {
    dom.settingsToggle.addEventListener('click', () => {
        const panel = dom.settingsPanel;
        panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
    });
    dom.aiKeyInput.addEventListener('change', () => {
        void setStorage({ aiKey: dom.aiKeyInput.value.trim() });
    });
    // Selecting one model deselects the other; unchecking the active one snaps back.
    dom.aiFastToggle.addEventListener('change', () => {
        applyModel(dom.aiFastToggle.checked ? FAST : SMART);
    });
    dom.aiSmartToggle.addEventListener('change', () => {
        applyModel(dom.aiSmartToggle.checked ? SMART : FAST);
    });
    void (async () => {
        const { aiKey, aiModel } = (await getStorage(['aiKey', 'aiModel']));
        if (aiKey)
            dom.aiKeyInput.value = aiKey;
        applyModel(aiModel === SMART ? SMART : FAST);
    })();
}
