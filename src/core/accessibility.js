// Manual overrides beyond what the OS/browser already provides — see the
// html[data-reduced-motion] / html[data-large-text] rules in main.css.
import { createStore } from '../store/createStore.js';

export const reducedMotionStore = createStore('charlie_reduced_motion_v1', false);
export const largeTextStore = createStore('charlie_large_text_v1', false);

const reducedMotionToggle = document.getElementById('reducedMotionToggle');
const largeTextToggle = document.getElementById('largeTextToggle');

function applyReducedMotion(enabled) {
  document.documentElement.toggleAttribute('data-reduced-motion', enabled);
}

function applyLargeText(enabled) {
  document.documentElement.toggleAttribute('data-large-text', enabled);
}

export function initAccessibility() {
  applyReducedMotion(reducedMotionStore.get());
  applyLargeText(largeTextStore.get());
  reducedMotionToggle.checked = reducedMotionStore.get();
  largeTextToggle.checked = largeTextStore.get();

  reducedMotionToggle.addEventListener('change', () => {
    reducedMotionStore.set(reducedMotionToggle.checked);
    applyReducedMotion(reducedMotionToggle.checked);
  });
  largeTextToggle.addEventListener('change', () => {
    largeTextStore.set(largeTextToggle.checked);
    applyLargeText(largeTextToggle.checked);
  });
}
