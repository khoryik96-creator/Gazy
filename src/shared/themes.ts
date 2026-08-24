/** The selectable UI themes. Applied as `data-theme` on <body>; styled in CSS. */
export const UI_THEMES = ['ledger', 'beacon', 'nocturne'] as const;
export type UiTheme = (typeof UI_THEMES)[number];

export const DEFAULT_UI_THEME: UiTheme = 'beacon';

/** Human labels for the theme picker. */
export const UI_THEME_LABELS: Record<UiTheme, string> = {
  ledger: 'Ledger — clean light',
  beacon: 'Beacon — warm teal',
  nocturne: 'Nocturne — dark',
};

/** Coerce an unknown stored value into a valid theme (falls back to default). */
export function normalizeUiTheme(value: unknown): UiTheme {
  return (UI_THEMES as readonly string[]).includes(value as string)
    ? (value as UiTheme)
    : DEFAULT_UI_THEME;
}
