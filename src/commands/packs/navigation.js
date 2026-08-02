import { switchTab } from '../../ui/tabs.js';
import { startFocusTimer } from '../../ui/pages/dashboard.js';
import { analyzeFoodByName } from '../../ui/pages/foodScanner.js';
import { profileStore, suggestionsStore, projectsStore } from '../../store/stores.js';
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
        (p) => p.deadline && p.status !== 'completed' && new Date(`${p.deadline}T00:00:00`) < new Date(new Date().toDateString()),
      ).length;
      const overdueNote = overdue ? `, and ${overdue} overdue` : '';
      return `You have ${projects.length} project${projects.length === 1 ? '' : 's'}, ${inProgress} in progress${overdueNote}.`;
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
