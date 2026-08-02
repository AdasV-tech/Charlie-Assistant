import { switchTab } from '../../ui/tabs.js';
import { startFocusTimer } from '../../ui/pages/dashboard.js';
import { analyzeFoodByName } from '../../ui/pages/foodScanner.js';
import {
  profileStore,
  suggestionsStore,
  projectsStore,
  assignmentsStore,
  flashcardsStore,
  workoutsStore,
  habitsStore,
} from '../../store/stores.js';
import { isPastDue } from '../../lib/dateLabels.js';
import { isDue } from '../../study/spacedRepetition.js';
import { computeWorkoutStreak } from '../../fitness/achievements.js';
import { setState } from '../../core/assistant.js';

export const navigationPack = [
  {
    patterns: ['open food scanner', 'scan food', 'food scanner'],
    respond: () => {
      setState('busy');
      switchTab('scanner');
      return 'Opening the food scanner.';
    },
  },
  {
    patterns: ['what are my goals', 'tell me my goals'],
    respond: () => {
      setState('busy');
      switchTab('profile');
      const { goals } = profileStore.get();
      if (goals && goals.length) {
        return `Your current goals are: ${goals.join(', ')}.`;
      }
      return "You haven't set any goals yet. Open your profile to add some.";
    },
  },
  {
    patterns: ['show my profile', 'open my profile', 'open profile'],
    respond: () => {
      setState('busy');
      switchTab('profile');
      return 'Here is your profile.';
    },
  },
  {
    patterns: ['start study mode'],
    respond: () => {
      setState('busy');
      switchTab('dashboard');
      startFocusTimer('study');
      return 'Starting study mode for 25 minutes.';
    },
  },
  {
    patterns: ['start workout mode'],
    respond: () => {
      setState('busy');
      switchTab('dashboard');
      startFocusTimer('workout');
      return 'Starting workout mode for 20 minutes.';
    },
  },
  {
    patterns: [
      "today's plan",
      'tell me today’s plan',
      'what is today’s plan',
      "what's my plan today",
      'show dashboard',
      'open dashboard',
    ],
    respond: () => {
      setState('busy');
      switchTab('dashboard');
      const suggestions = suggestionsStore.get();
      if (suggestions.length) {
        return `Today's focus is: ${suggestions[0]}. You have ${suggestions.length} item${suggestions.length === 1 ? '' : 's'} on your list.`;
      }
      return "You don't have any suggestions on today's plan yet.";
    },
  },
  {
    patterns: ['show my projects', 'open projects', 'project manager', 'open project manager'],
    respond: () => {
      setState('busy');
      switchTab('projects');
      const projects = projectsStore.get();
      if (!projects.length) return "You don't have any projects yet. Add one to get started.";
      const inProgress = projects.filter((p) => p.status === 'in-progress').length;
      const overdue = projects.filter(
        (p) => p.status !== 'completed' && isPastDue(p.deadline),
      ).length;
      const overdueNote = overdue ? `, and ${overdue} overdue` : '';
      return `You have ${projects.length} project${projects.length === 1 ? '' : 's'}, ${inProgress} in progress${overdueNote}.`;
    },
  },
  {
    patterns: ['open study center', 'show study center', 'study center'],
    respond: () => {
      setState('busy');
      switchTab('study');
      const assignments = assignmentsStore.get();
      const flashcards = flashcardsStore.get();
      if (!assignments.length && !flashcards.length) {
        return 'Your study center is empty. Add a subject, assignment, or flashcard to get started.';
      }
      const pending = assignments.filter((a) => a.status !== 'done').length;
      const dueCards = flashcards.filter((c) => isDue(c)).length;
      return `You have ${pending} pending assignment${pending === 1 ? '' : 's'} and ${dueCards} flashcard${dueCards === 1 ? '' : 's'} due for review.`;
    },
  },
  {
    patterns: ['open fitness center', 'show fitness center', 'fitness center'],
    respond: () => {
      setState('busy');
      switchTab('fitness');
      const workouts = workoutsStore.get();
      const habits = habitsStore.get();
      if (!workouts.length && !habits.length) {
        return 'Your fitness center is empty. Log a workout or add a habit to get started.';
      }
      const streak = computeWorkoutStreak(workouts);
      const dueHabits = habits.filter(
        (h) => !h.completions.includes(new Date().toISOString().slice(0, 10)),
      ).length;
      return `You have logged ${workouts.length} workout${workouts.length === 1 ? '' : 's'}, on a ${streak}-day streak, with ${dueHabits} habit${dueHabits === 1 ? '' : 's'} left to check off today.`;
    },
  },
  {
    patterns: ['open memory', 'show my memory', 'smart memory', 'what do you remember'],
    respond: () => {
      setState('busy');
      switchTab('memory');
      return "Here's everything I remember about you, grouped by feature.";
    },
  },
  {
    patterns: ['analyze food', 'analyse food', 'what is the score for'],
    respond: (transcript) => {
      setState('busy');
      switchTab('scanner');
      const lower = transcript.toLowerCase();
      const marker = lower.includes('analyze food')
        ? 'analyze food'
        : lower.includes('analyse food')
          ? 'analyse food'
          : 'what is the score for';
      const idx = lower.indexOf(marker);
      const foodName = transcript.slice(idx + marker.length).trim();
      const food = analyzeFoodByName(foodName);
      if (food)
        return `${food.name} scores ${food.healthScore.toFixed(1)} out of 10 for health. ${food.dailyRecommendation}`;
      return 'Tell me a food name, for example "analyze food chicken breast".';
    },
  },
];
