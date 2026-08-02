// Instant client-side search over pages, settings, and whatever real data
// already exists (notes, food history, profile). Plain substring matching,
// same philosophy as the voice command matcher: simple and transparent
// rather than a fuzzy-search dependency for a dataset this small.
import { switchTab } from '../ui/tabs.js';
import { openSettingsDrawer } from '../ui/settingsDrawer.js';
import { notesStore, foodHistoryStore, profileStore, projectsStore } from '../store/stores.js';

const searchBtn = document.getElementById('searchBtn');
const searchOverlay = document.getElementById('searchOverlay');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

function staticIndex() {
  return [
    {
      title: 'Assistant',
      subtitle: 'Voice commands & transcript',
      keywords: 'assistant voice mic core talk',
      action: () => switchTab('assistant'),
    },
    {
      title: 'Food Scanner',
      subtitle: 'Analyze a food, view history',
      keywords: 'food scanner nutrition scan analyze',
      action: () => switchTab('scanner'),
    },
    {
      title: 'Dashboard',
      subtitle: 'Greeting, focus, suggestions, timers',
      keywords: 'dashboard suggestions focus timer study workout',
      action: () => switchTab('dashboard'),
    },
    {
      title: 'Projects',
      subtitle: 'Progress, status, priority, deadlines',
      keywords: 'projects project manager tasks deadlines status priority',
      action: () => switchTab('projects'),
    },
    {
      title: 'Profile',
      subtitle: 'Name, goals, activity level',
      keywords: 'profile goals activity name',
      action: () => switchTab('profile'),
    },
    {
      title: 'Settings',
      subtitle: 'Theme, voice, data, accessibility, developer mode',
      keywords: 'settings theme voice data export import accessibility developer',
      action: () => openSettingsDrawer(),
    },
  ];
}

// Built fresh on every search rather than cached, so it always reflects
// whatever's currently in each store.
function dynamicIndex() {
  const items = [];

  notesStore.get().forEach((note) => {
    items.push({
      title: note.length > 60 ? `${note.slice(0, 60)}…` : note,
      subtitle: 'Note',
      keywords: note,
      action: () => switchTab('assistant'),
    });
  });

  foodHistoryStore.get().forEach((entry) => {
    items.push({
      title: entry.mealName,
      subtitle: `Food history · ${entry.healthScore.toFixed(1)}/10`,
      keywords: `${entry.mealName} ${entry.foodName}`,
      action: () => switchTab('scanner'),
    });
  });

  projectsStore.get().forEach((project) => {
    items.push({
      title: project.name,
      subtitle: `Project · ${project.status.replace('-', ' ')} · ${project.progress}%`,
      keywords: `${project.name} ${project.description} ${project.category} ${project.tags.join(' ')}`,
      action: () => switchTab('projects'),
    });
  });

  const profile = profileStore.get();
  if (profile.name) {
    items.push({
      title: profile.name,
      subtitle: 'Profile name',
      keywords: profile.name,
      action: () => switchTab('profile'),
    });
  }
  (profile.goals || []).forEach((goal) => {
    items.push({
      title: goal,
      subtitle: 'Goal',
      keywords: goal,
      action: () => switchTab('profile'),
    });
  });

  return items;
}

function renderResults(matches) {
  searchResults.innerHTML = '';

  if (!matches.length) {
    const empty = document.createElement('li');
    empty.className = 'search-empty';
    empty.textContent = 'No matches.';
    searchResults.appendChild(empty);
    return;
  }

  matches.forEach((item) => {
    const li = document.createElement('li');
    const title = document.createElement('span');
    title.className = 'search-result-title';
    title.textContent = item.title;
    const sub = document.createElement('span');
    sub.className = 'search-result-sub';
    sub.textContent = item.subtitle;
    li.appendChild(title);
    li.appendChild(sub);
    li.addEventListener('click', () => {
      item.action();
      closeSearch();
    });
    searchResults.appendChild(li);
  });
}

function runSearch(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    searchResults.innerHTML = '';
    return;
  }
  const matches = [...staticIndex(), ...dynamicIndex()]
    .filter((item) => `${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase().includes(q))
    .slice(0, 20);
  renderResults(matches);
}

function openSearch() {
  searchOverlay.classList.remove('hidden');
  searchInput.value = '';
  searchResults.innerHTML = '';
  searchInput.focus();
}

function closeSearch() {
  searchOverlay.classList.add('hidden');
}

export function initGlobalSearch() {
  searchBtn.addEventListener('click', openSearch);
  searchOverlay.addEventListener('click', (e) => {
    if (e.target === searchOverlay) closeSearch();
  });
  searchInput.addEventListener('input', () => runSearch(searchInput.value));

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSearch();
    } else if (e.key === 'Escape' && !searchOverlay.classList.contains('hidden')) {
      closeSearch();
    }
  });
}
