import { dom } from './dom.js';
import { getStorage, setStorage } from './storage.js';
import { UI_THEMES, UI_THEME_LABELS, normalizeUiTheme } from '../shared/themes.js';
function applyTheme(theme) {
    document.body.dataset.theme = theme;
}
/**
 * Replaces the old light/dark toggle with a full theme picker in the ⚙️ settings
 * panel. The choice is stored under `uiTheme` and applied to <body> as
 * `data-theme`; popup.css defines the token set per theme. The dashboard reads
 * the same key.
 */
export async function initThemeManager() {
    const { uiTheme } = await getStorage(['uiTheme']);
    const theme = normalizeUiTheme(uiTheme);
    applyTheme(theme);
    dom.themeSelect.replaceChildren();
    for (const t of UI_THEMES) {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = UI_THEME_LABELS[t];
        dom.themeSelect.appendChild(opt);
    }
    dom.themeSelect.value = theme;
    dom.themeSelect.addEventListener('change', () => {
        const next = normalizeUiTheme(dom.themeSelect.value);
        applyTheme(next);
        void setStorage({ uiTheme: next });
    });
}
