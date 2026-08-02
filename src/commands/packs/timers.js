import { startCustomTimer, stopFocusTimer } from '../../ui/pages/dashboard.js';
import { switchTab } from '../../ui/tabs.js';
import { getLastResponse, speakFaster, speakSlower, setState } from '../../core/assistant.js';

export const timersPack = [
  {
    patterns: ['set a timer for', 'set timer for'],
    respond: (transcript) => {
      const match = transcript.toLowerCase().match(/(\d+)\s*(minutes?|mins?|seconds?|secs?)/);
      if (!match) return "Tell me a duration, like 'set a timer for 10 minutes'.";
      const amount = parseInt(match[1], 10);
      const isSeconds = match[2].startsWith('sec');
      const unitWord = isSeconds ? 'second' : 'minute';
      const label = `${amount} ${unitWord}${amount === 1 ? '' : 's'} timer`;
      setState('busy');
      switchTab('dashboard');
      startCustomTimer(isSeconds ? amount : amount * 60, label);
      return `Timer set for ${amount} ${unitWord}${amount === 1 ? '' : 's'}.`;
    },
  },
  {
    patterns: ['stop timer', 'cancel timer'],
    respond: () => {
      setState('busy');
      stopFocusTimer();
      return 'Timer stopped.';
    },
  },
  {
    patterns: ['repeat that', 'say that again', 'what did you say'],
    respond: () => getLastResponse() || "I haven't said anything yet.",
  },
  {
    patterns: ['speak faster', 'talk faster'],
    respond: () => {
      speakFaster();
      return "Okay, I'll speak a bit faster.";
    },
  },
  {
    patterns: ['speak slower', 'talk slower'],
    respond: () => {
      speakSlower();
      return "Okay, I'll slow down.";
    },
  },
];
