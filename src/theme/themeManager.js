// Applies a theme by setting data-theme on <html> — every color a theme
// can change lives in src/styles/themes.css as a [data-theme="..."] block
// overriding the tokens defined in main.css's :root. See index.html's
// inline <head> script for how the saved theme is applied before first
// paint (to avoid a flash of the default theme on reload).
import { themeStore } from '../store/stores.js';

export const THEMES = [
  { id: 'default', name: 'Default' },
  { id: 'midnight', name: 'Midnight' },
  { id: 'cyber-blue', name: 'Cyber Blue' },
  { id: 'emerald', name: 'Emerald' },
  { id: 'purple', name: 'Purple' },
  { id: 'orange', name: 'Orange' },
  { id: 'minimal', name: 'Minimal' },
];

const VALID_IDS = new Set(THEMES.map((t) => t.id));

export function getCurrentTheme() {
  const saved = themeStore.get();
  return VALID_IDS.has(saved) ? saved : 'default';
}

export function applyTheme(themeId) {
  const id = VALID_IDS.has(themeId) ? themeId : 'default';
  document.documentElement.dataset.theme = id;
  themeStore.set(id);
}

// Re-applies whatever was already saved — the inline <head> script already
// set the attribute before this runs, so this mostly just re-syncs in case
// that script and this module ever drift, and is a no-op in the common case.
export function initTheme() {
  document.documentElement.dataset.theme = getCurrentTheme();
}
