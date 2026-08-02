// Every piece of saved state in Charlie, all built on the one createStore
// factory. Keys and shapes are unchanged from earlier versions so anyone
// with existing data in their browser keeps it after this refactor.
import { createStore } from './createStore.js';

function arrayDeserialize(defaultValue) {
  return (raw) => {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : defaultValue;
  };
}

// Name, saved voice choice, and speech rate/pitch/volume.
export const memoryStore = createStore('charlie_memory_v1', {
  userName: null,
  voiceIndex: null,
  rate: 1,
  pitch: 1,
  volume: 1,
});

// Raw string, not JSON — matches how earlier versions wrote it, so existing
// saved keys keep working unchanged.
export const geminiKeyStore = createStore('charlie_gemini_key_v1', '', {
  serialize: (value) => value,
  deserialize: (raw) => raw,
});

export const foodHistoryStore = createStore('charlie_food_history_v1', [], {
  deserialize: arrayDeserialize([]),
});

// Food names the user has starred as favourites (see ui/pages/foodScanner.js).
export const favouriteFoodsStore = createStore('charlie_favourite_foods_v1', [], {
  deserialize: arrayDeserialize([]),
});

export const profileStore = createStore('charlie_profile_v1', {
  name: '',
  age: '',
  activity: '',
  goals: [],
  activities: '',
});

const DEFAULT_SUGGESTIONS = ['Drink more water', '30 minutes of coding practice'];
export const suggestionsStore = createStore('charlie_dashboard_v1', DEFAULT_SUGGESTIONS, {
  deserialize: arrayDeserialize(DEFAULT_SUGGESTIONS),
});

export const notesStore = createStore('charlie_notes_v1', [], {
  deserialize: arrayDeserialize([]),
});

// See ui/pages/projects.js for the shape of each project entry.
export const projectsStore = createStore('charlie_projects_v1', [], {
  deserialize: arrayDeserialize([]),
});

// The transcript log, persisted so it survives a reload instead of
// starting blank every time — capped so it can't grow without bound.
export const CONVERSATION_HISTORY_LIMIT = 200;
export const conversationStore = createStore('charlie_conversation_v1', [], {
  deserialize: arrayDeserialize([]),
});

// One entry per completed Study/Workout Mode session — the real signal
// behind the Dashboard's productivity score (see ui/pages/dashboard.js) and
// the Study Center's goals/heatmap/achievements (see ui/pages/studyCenter.js).
// Shape: { mode: 'study'|'workout', completedAt, durationMinutes, subjectId? }
export const focusSessionsStore = createStore('charlie_focus_sessions_v1', [], {
  deserialize: arrayDeserialize([]),
});

// See ui/pages/studyCenter.js for the shape of each entry.
export const subjectsStore = createStore('charlie_subjects_v1', [], {
  deserialize: arrayDeserialize([]),
});

export const assignmentsStore = createStore('charlie_assignments_v1', [], {
  deserialize: arrayDeserialize([]),
});

export const flashcardsStore = createStore('charlie_flashcards_v1', [], {
  deserialize: arrayDeserialize([]),
});

export const studyGoalsStore = createStore('charlie_study_goals_v1', [], {
  deserialize: arrayDeserialize([]),
});

// See ui/pages/fitnessCenter.js for the shape of each entry.
export const workoutsStore = createStore('charlie_workouts_v1', [], {
  deserialize: arrayDeserialize([]),
});

export const habitsStore = createStore('charlie_habits_v1', [], {
  deserialize: arrayDeserialize([]),
});

export const waterLogStore = createStore('charlie_water_log_v1', [], {
  deserialize: arrayDeserialize([]),
});

// A single number of glasses — deliberately separate from the generic
// period-based goals below, since a hydration target is always "today".
export const waterGoalStore = createStore('charlie_water_goal_v1', 8);

export const weightLogStore = createStore('charlie_weight_log_v1', [], {
  deserialize: arrayDeserialize([]),
});

// Manual entries only — an honest placeholder for real sleep tracking
// hardware/APIs Charlie doesn't have access to, not a fabricated sync.
export const sleepLogStore = createStore('charlie_sleep_log_v1', [], {
  deserialize: arrayDeserialize([]),
});

export const fitnessGoalsStore = createStore('charlie_fitness_goals_v1', [], {
  deserialize: arrayDeserialize([]),
});

// Raw string theme id (e.g. 'midnight') — also read directly by the
// inline anti-flash script in index.html's <head>, which runs before any
// module loads, so THEME_KEY's value has to stay in sync with the literal
// string hardcoded there.
export const THEME_KEY = 'charlie_theme_v1';
export const themeStore = createStore(THEME_KEY, 'default', {
  serialize: (value) => value,
  deserialize: (raw) => raw,
});

// Shared everywhere Charlie needs to address the user by name.
export function getUserLabel() {
  return memoryStore.get().userName || 'there';
}
