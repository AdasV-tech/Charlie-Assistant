// Voice/rate/pitch live on the Core (core/assistant.js) since they're part
// of the speech runtime; this module owns the drawer shell itself plus the
// Gemini key and memory-reset controls it hosts.
import { geminiKeyStore } from '../store/stores.js';
import { verifyGeminiKey, resetGeminiHistory } from '../commands/gemini.js';
import { resetMemory } from '../core/assistant.js';
import { THEMES, getCurrentTheme, applyTheme } from '../theme/themeManager.js';
import { downloadExport, importFromFile } from '../lib/dataPortability.js';
import { addLogLine } from './transcript.js';
import { showToast } from './toast.js';

const settingsBtn = document.getElementById('settingsBtn');
const drawerOverlay = document.getElementById('drawerOverlay');
const drawerCloseBtn = document.getElementById('drawerCloseBtn');
const themeSelect = document.getElementById('themeSelect');
const geminiKeyInput = document.getElementById('geminiKeyInput');
const geminiKeySaveBtn = document.getElementById('geminiKeySaveBtn');
const resetMemoryBtn = document.getElementById('resetMemoryBtn');
const exportDataBtn = document.getElementById('exportDataBtn');
const importDataInput = document.getElementById('importDataInput');

export function openSettingsDrawer() {
  drawerOverlay?.classList.remove('hidden');
}

export function focusGeminiKeyInput() {
  geminiKeyInput?.focus();
}

export function initSettingsDrawer() {
  geminiKeyInput.value = geminiKeyStore.get();

  THEMES.forEach((theme) => {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.name;
    themeSelect.appendChild(option);
  });
  themeSelect.value = getCurrentTheme();
  themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));

  settingsBtn.addEventListener('click', openSettingsDrawer);
  drawerCloseBtn.addEventListener('click', () => drawerOverlay.classList.add('hidden'));
  // Clicking the dim backdrop (but not the drawer itself) also closes it.
  drawerOverlay.addEventListener('click', (e) => {
    if (e.target === drawerOverlay) drawerOverlay.classList.add('hidden');
  });

  geminiKeySaveBtn.addEventListener('click', async () => {
    const key = geminiKeyInput.value.trim();
    if (!key) {
      addLogLine('Enter a Gemini API key before saving.', 'system');
      return;
    }
    geminiKeyStore.set(key.trim());
    resetGeminiHistory();
    geminiKeySaveBtn.disabled = true;
    geminiKeySaveBtn.textContent = 'CONNECTING...';
    const ok = await verifyGeminiKey(key);
    geminiKeySaveBtn.disabled = false;
    geminiKeySaveBtn.textContent = 'SAVE KEY';
    addLogLine(
      ok
        ? 'Gemini connected. Ask me anything and I’ll do my best to answer.'
        : 'Saved, but that key didn’t verify — double-check it at aistudio.google.com/apikey.',
      'system',
    );
  });

  resetMemoryBtn.addEventListener('click', () => {
    resetMemory();
    addLogLine('Memory wiped. Refresh the page to set up again.', 'system');
  });

  exportDataBtn.addEventListener('click', () => {
    downloadExport();
    showToast('Backup downloaded.');
  });

  importDataInput.addEventListener('change', async () => {
    const file = importDataInput.files && importDataInput.files[0];
    importDataInput.value = ''; // allow re-selecting the same file later
    if (!file) return;
    try {
      await importFromFile(file);
      addLogLine('Backup imported — reloading to apply it.', 'system');
      showToast('Backup imported. Reloading…');
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      showToast(e.message || "Couldn't import that file.", { type: 'error' });
    }
  });
}
