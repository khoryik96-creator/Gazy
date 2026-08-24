import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUiTheme, UI_THEMES, DEFAULT_UI_THEME } from '../dist/shared/themes.js';

test('normalizeUiTheme accepts the known themes', () => {
  for (const t of UI_THEMES) {
    assert.equal(normalizeUiTheme(t), t);
  }
});

test('normalizeUiTheme falls back to the default for unknown/empty values', () => {
  assert.equal(normalizeUiTheme(undefined), DEFAULT_UI_THEME);
  assert.equal(normalizeUiTheme(''), DEFAULT_UI_THEME);
  assert.equal(normalizeUiTheme('dark'), DEFAULT_UI_THEME); // old value from the retired toggle
  assert.equal(normalizeUiTheme('not-a-theme'), DEFAULT_UI_THEME);
  assert.equal(normalizeUiTheme(42), DEFAULT_UI_THEME);
});
