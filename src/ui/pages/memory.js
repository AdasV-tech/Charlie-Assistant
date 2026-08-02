// Smart Memory: one page surfacing everything Charlie has stored across
// every module, grouped into categories the user can export or clear on
// their own — a real viewer over the actual stores, not a decorative list.
import {
  profileStore,
  conversationStore,
  notesStore,
  suggestionsStore,
  foodHistoryStore,
  favouriteFoodsStore,
  projectsStore,
  subjectsStore,
  assignmentsStore,
  flashcardsStore,
  studyGoalsStore,
  workoutsStore,
  habitsStore,
  waterLogStore,
  weightLogStore,
  sleepLogStore,
  fitnessGoalsStore,
  focusSessionsStore,
} from '../../store/stores.js';
import { downloadJSON } from '../../lib/dataPortability.js';
import { escapeHtml } from '../../lib/utils.js';
import { showToast } from '../toast.js';

const memoryCategoryList = document.getElementById('memoryCategoryList');

function pluralize(count, word, plural = `${word}s`) {
  return `${count} ${count === 1 ? word : plural}`;
}

const CATEGORIES = [
  {
    id: 'profile',
    label: 'Profile',
    stores: { profile: profileStore },
    describe: ({ profile }) =>
      profile.name ? `Name, goals, and activity level for ${profile.name}` : 'No profile set yet',
  },
  {
    id: 'conversation',
    label: 'Conversation History',
    stores: { conversation: conversationStore },
    describe: ({ conversation }) => pluralize(conversation.length, 'logged line'),
  },
  {
    id: 'notes',
    label: 'Notes',
    stores: { notes: notesStore },
    describe: ({ notes }) => pluralize(notes.length, 'note'),
  },
  {
    id: 'suggestions',
    label: 'Dashboard Suggestions',
    stores: { suggestions: suggestionsStore },
    describe: ({ suggestions }) => pluralize(suggestions.length, 'suggestion'),
  },
  {
    id: 'food',
    label: 'Food History',
    stores: { foodHistory: foodHistoryStore, favouriteFoods: favouriteFoodsStore },
    describe: ({ foodHistory, favouriteFoods }) =>
      `${pluralize(foodHistory.length, 'logged meal')}, ${pluralize(favouriteFoods.length, 'favourite')}`,
  },
  {
    id: 'projects',
    label: 'Projects',
    stores: { projects: projectsStore },
    describe: ({ projects }) => pluralize(projects.length, 'project'),
  },
  {
    id: 'study',
    label: 'Study Center',
    stores: {
      subjects: subjectsStore,
      assignments: assignmentsStore,
      flashcards: flashcardsStore,
      studyGoals: studyGoalsStore,
    },
    describe: ({ subjects, assignments, flashcards, studyGoals }) =>
      `${pluralize(subjects.length, 'subject')}, ${pluralize(assignments.length, 'assignment')}, ${pluralize(flashcards.length, 'flashcard')}, ${pluralize(studyGoals.length, 'goal')}`,
  },
  {
    id: 'fitness',
    label: 'Fitness Center',
    stores: {
      workouts: workoutsStore,
      habits: habitsStore,
      waterLog: waterLogStore,
      weightLog: weightLogStore,
      sleepLog: sleepLogStore,
      fitnessGoals: fitnessGoalsStore,
    },
    describe: ({ workouts, habits, weightLog, sleepLog, fitnessGoals }) =>
      `${pluralize(workouts.length, 'workout')}, ${pluralize(habits.length, 'habit')}, ${pluralize(weightLog.length, 'weigh-in')}, ${pluralize(sleepLog.length, 'sleep entry', 'sleep entries')}, ${pluralize(fitnessGoals.length, 'goal')}`,
  },
  {
    id: 'focus-sessions',
    label: 'Focus Sessions',
    stores: { focusSessions: focusSessionsStore },
    describe: ({ focusSessions }) => pluralize(focusSessions.length, 'completed session'),
  },
];

function getCategoryData(category) {
  return Object.fromEntries(
    Object.entries(category.stores).map(([key, store]) => [key, store.get()]),
  );
}

function renderMemoryCategories() {
  memoryCategoryList.innerHTML = '';
  CATEGORIES.forEach((category) => {
    const data = getCategoryData(category);
    const li = document.createElement('li');
    li.className = 'memory-category';
    li.innerHTML = `
      <div class="memory-category-main">
        <span class="memory-category-label">${escapeHtml(category.label)}</span>
        <span class="memory-category-desc">${escapeHtml(category.describe(data))}</span>
      </div>
      <div class="memory-category-actions">
        <button type="button" class="secondary-btn" data-export-category="${category.id}">EXPORT</button>
        <button type="button" class="secondary-btn memory-clear-btn" data-clear-category="${category.id}">CLEAR</button>
      </div>
    `;
    memoryCategoryList.appendChild(li);
  });
}

function exportCategory(id) {
  const category = CATEGORIES.find((c) => c.id === id);
  if (!category) return;
  downloadJSON(
    `charlie-${category.id}-${new Date().toISOString().slice(0, 10)}.json`,
    getCategoryData(category),
  );
  showToast(`${category.label} exported.`);
}

function clearCategory(id) {
  const category = CATEGORIES.find((c) => c.id === id);
  if (!category) return;
  Object.values(category.stores).forEach((store) => store.reset());
  showToast(`${category.label} cleared.`);
  renderMemoryCategories();
}

export function renderMemory() {
  renderMemoryCategories();
}

export function initMemory() {
  memoryCategoryList.addEventListener('click', (e) => {
    const exportBtn = e.target.closest('[data-export-category]');
    if (exportBtn) exportCategory(exportBtn.dataset.exportCategory);
    const clearBtn = e.target.closest('[data-clear-category]');
    if (clearBtn) clearCategory(clearBtn.dataset.clearCategory);
  });
  renderMemory();
}
