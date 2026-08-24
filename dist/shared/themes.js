/** The selectable UI themes. Applied as `data-theme` on <body>; styled in CSS. */
export const UI_THEMES = ['ledger', 'beacon', 'nocturne'];
export const DEFAULT_UI_THEME = 'ledger';
/** Human labels for the theme picker. */
export const UI_THEME_LABELS = {
    ledger: 'Ledger — clean light',
    beacon: 'Beacon — warm teal',
    nocturne: 'Nocturne — dark',
};
/** Coerce an unknown stored value into a valid theme (falls back to default). */
export function normalizeUiTheme(value) {
    return UI_THEMES.includes(value)
        ? value
        : DEFAULT_UI_THEME;
}
