// Boot sequence — every command pack is registered first (order doesn't
// affect matching, since findBestCommand always picks the longest matching
// pattern regardless of registration order — see commands/registry.js),
// then every UI module is initialized. Each init*() call wires up its own
// DOM subtree independently; see the individual modules for details.
import './styles/main.css';
import './styles/components.css';
import './styles/themes.css';

import { initTheme } from './theme/themeManager.js';
import { registerPack } from './commands/registry.js';
import { identityPack } from './commands/packs/identity.js';
import { smalltalkPack } from './commands/packs/smalltalk.js';
import { personalityPack } from './commands/packs/personality.js';
import { timeDatePack } from './commands/packs/time-date.js';
import { mathUnitsPack } from './commands/packs/math-units.js';
import { notesRemindersPack } from './commands/packs/notes-reminders.js';
import { timersPack } from './commands/packs/timers.js';
import { webShortcutsPack } from './commands/packs/web-shortcuts.js';
import { gamesPack } from './commands/packs/games.js';
import { healthMotivationPack } from './commands/packs/health-motivation.js';
import { navigationPack } from './commands/packs/navigation.js';
import { systemPack } from './commands/packs/system.js';

import { drawCoreTicks } from './ui/ticks.js';
import { initClock } from './ui/clock.js';
import { initTranscript } from './ui/transcript.js';
import { initNameModal } from './ui/nameModal.js';
import { initTabs } from './ui/tabs.js';
import { initSettingsDrawer } from './ui/settingsDrawer.js';
import { initFoodScanner } from './ui/pages/foodScanner.js';
import { initProfile } from './ui/pages/profile.js';
import { initDashboard } from './ui/pages/dashboard.js';
import { initProjects } from './ui/pages/projects.js';
import { initAssistant } from './core/assistant.js';
import { initAccessibility } from './core/accessibility.js';
import { initDeveloperMode } from './core/developerMode.js';
import { initNotificationCenter } from './notifications/notificationCenter.js';
import { initGlobalSearch } from './search/globalSearch.js';

[
  identityPack,
  smalltalkPack,
  personalityPack,
  timeDatePack,
  mathUnitsPack,
  notesRemindersPack,
  timersPack,
  webShortcutsPack,
  gamesPack,
  healthMotivationPack,
  navigationPack,
  systemPack,
].forEach(registerPack);

initTheme();
drawCoreTicks();
initClock();
initTranscript();
initAssistant(); // sets the initial "sleeping" state before the name modal decision below
initNameModal();
initTabs();
initSettingsDrawer();
initFoodScanner();
initProfile();
initDashboard();
initProjects();
initAccessibility();
initDeveloperMode();
initNotificationCenter();
initGlobalSearch();
