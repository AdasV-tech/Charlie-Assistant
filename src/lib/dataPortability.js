// Exports/imports everything Charlie has stored as one JSON file — the
// real implementation behind Settings → Data → Export/Import. The Gemini
// API key is deliberately excluded: it's a credential, not app data, and a
// generic "export my data" file is exactly the kind of thing that ends up
// shared/uploaded somewhere it shouldn't — re-entering it once on a new
// device is a small price for not making that mistake easy to make.
import {
  memoryStore,
  profileStore,
  foodHistoryStore,
  favouriteFoodsStore,
  suggestionsStore,
  notesStore,
  projectsStore,
  themeStore,
  conversationStore,
  focusSessionsStore,
} from '../store/stores.js';

const EXPORTABLE_STORES = {
  memory: memoryStore,
  profile: profileStore,
  foodHistory: foodHistoryStore,
  favouriteFoods: favouriteFoodsStore,
  suggestions: suggestionsStore,
  notes: notesStore,
  projects: projectsStore,
  theme: themeStore,
  conversation: conversationStore,
  focusSessions: focusSessionsStore,
};

const EXPORT_FORMAT_VERSION = 1;

export function exportAllData() {
  return {
    app: 'charlie-assistant',
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(
      Object.entries(EXPORTABLE_STORES).map(([key, store]) => [key, store.get()]),
    ),
  };
}

export function importAllData(payload) {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !payload.data ||
    typeof payload.data !== 'object'
  ) {
    throw new Error("That file doesn't look like a Charlie backup.");
  }
  for (const [key, store] of Object.entries(EXPORTABLE_STORES)) {
    if (key in payload.data) {
      store.set(payload.data[key]);
    }
  }
}

export function downloadExport() {
  const payload = exportAllData();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `charlie-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function importFromFile(file) {
  const text = await file.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  importAllData(payload);
}
