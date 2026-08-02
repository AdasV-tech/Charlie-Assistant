// A diagnostics panel for troubleshooting — real, inspectable state (which
// Web Speech APIs this browser actually supports, what's in localStorage
// and how big it is), not a placeholder toggle that reveals nothing.
import { createStore } from '../store/createStore.js';
import { version as APP_VERSION } from '../../package.json';

export const developerModeStore = createStore('charlie_developer_mode_v1', false);

const developerModeToggle = document.getElementById('developerModeToggle');
const developerPanel = document.getElementById('developerPanel');

function renderDiagnostics() {
  const keys = Object.keys(localStorage)
    .filter((k) => k.startsWith('charlie_'))
    .sort();
  const totalChars = keys.reduce((sum, k) => sum + (localStorage.getItem(k) || '').length, 0);

  const lines = [
    `Charlie v${APP_VERSION}`,
    `Theme: ${document.documentElement.dataset.theme || 'default'}`,
    `SpeechRecognition: ${window.SpeechRecognition || window.webkitSpeechRecognition ? 'supported' : 'NOT supported'}`,
    `SpeechSynthesis: ${'speechSynthesis' in window ? 'supported' : 'NOT supported'}`,
    `Online: ${navigator.onLine}`,
    `localStorage: ${keys.length} keys, ${totalChars} chars total`,
    ...keys.map((k) => `  ${k}: ${(localStorage.getItem(k) || '').length} chars`),
  ];
  developerPanel.textContent = lines.join('\n');
}

function setVisible(enabled) {
  developerPanel.classList.toggle('hidden', !enabled);
  if (enabled) renderDiagnostics();
}

export function initDeveloperMode() {
  developerModeToggle.checked = developerModeStore.get();
  setVisible(developerModeStore.get());

  developerModeToggle.addEventListener('change', () => {
    developerModeStore.set(developerModeToggle.checked);
    setVisible(developerModeToggle.checked);
  });
}
