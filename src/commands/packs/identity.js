import { memoryStore } from '../../store/stores.js';
import { resetMemory, setState } from '../../core/assistant.js';
import { resetGeminiHistory } from '../gemini.js';
import { extractName } from '../text.js';

export const identityPack = [
  {
    patterns: ['what is your name', "what's your name", 'who are you'],
    respond: () => "I'm Charlie, your personal voice assistant.",
  },
  {
    patterns: ['my name is', 'call me', 'remember my name'],
    respond: (transcript) => {
      const extracted = extractName(transcript);
      if (extracted) {
        setState('learning');
        memoryStore.update((m) => ({ ...m, userName: extracted }));
        return `Got it, I'll remember you as ${extracted}.`;
      }
      return "I didn't catch the name. Could you say 'my name is' followed by your name?";
    },
  },
  {
    patterns: ['do you know my name', 'what is my name', "what's my name"],
    respond: () =>
      memoryStore.get().userName
        ? `Your name is ${memoryStore.get().userName}.`
        : "I don't know your name yet. Tell me by saying 'my name is' and your name.",
  },
  {
    patterns: ['forget me', 'forget my name', 'clear my data', 'reset memory'],
    respond: () => {
      resetMemory();
      return 'All done. I have forgotten your name and reset your settings.';
    },
  },
  {
    patterns: [
      'forget our conversation',
      'clear the chat',
      'clear our chat',
      'start a new conversation',
      'new conversation',
      'reset our conversation',
    ],
    respond: () => {
      resetGeminiHistory();
      return "Fresh start — I've cleared what we were just talking about.";
    },
  },
];
