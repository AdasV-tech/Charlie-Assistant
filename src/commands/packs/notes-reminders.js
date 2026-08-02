import { notesStore, suggestionsStore } from '../../store/stores.js';
import { renderDashboard } from '../../ui/pages/dashboard.js';
import { setState } from '../../core/assistant.js';
import { extractAfterMarkers } from '../text.js';

export const notesRemindersPack = [
  {
    patterns: ['take a note', 'note that', 'add a note'],
    respond: (transcript) => {
      const text = extractAfterMarkers(transcript, ['take a note', 'note that', 'add a note']);
      if (!text) return 'What would you like me to note down?';
      setState('learning');
      notesStore.set([...notesStore.get(), text]);
      return `Noted: ${text}.`;
    },
  },
  {
    patterns: ['read my notes', 'what are my notes', 'show my notes'],
    respond: () => {
      const notes = notesStore.get();
      if (!notes.length) return "You don't have any notes yet.";
      return `You have ${notes.length} note${notes.length === 1 ? '' : 's'}: ${notes.join('; ')}.`;
    },
  },
  {
    patterns: ['clear my notes', 'delete my notes'],
    respond: () => {
      notesStore.set([]);
      return 'All notes cleared.';
    },
  },
  // Reminders feed into the dashboard's suggestion list.
  {
    patterns: ['remind me to', 'add a reminder', 'add to my list'],
    respond: (transcript) => {
      const text = extractAfterMarkers(transcript, [
        'remind me to',
        'add a reminder to',
        'add a reminder',
        'add to my list',
      ]);
      if (!text) return 'What should I remind you about?';
      setState('learning');
      suggestionsStore.set([...suggestionsStore.get(), text]);
      renderDashboard();
      return `Added "${text}" to today's plan.`;
    },
  },
];
