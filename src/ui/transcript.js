// The scrolling conversation log in the Assistant tab — persisted so a
// reload replays real history instead of starting blank every time.
import { conversationStore, CONVERSATION_HISTORY_LIMIT } from '../store/stores.js';

const consoleLog = document.getElementById('consoleLog');
const clearBtn = document.getElementById('clearBtn');

function appendLine(text, who, extraClass = '') {
  const line = document.createElement('div');
  line.className = `log-line log-${who}${extraClass ? ` ${extraClass}` : ''}`;
  line.textContent = text;
  consoleLog.appendChild(line);
  consoleLog.scrollTop = consoleLog.scrollHeight;
  return line;
}

export function addLogLine(text, who) {
  // who: 'user' | 'charlie' | 'system'
  appendLine(text, who);
  const history = conversationStore.get();
  history.push({ text, who, at: new Date().toISOString() });
  if (history.length > CONVERSATION_HISTORY_LIMIT) {
    history.splice(0, history.length - CONVERSATION_HISTORY_LIMIT);
  }
  conversationStore.set(history);
}

// Live/interim speech recognition text — shown while the user is still
// talking, replaced by a real addLogLine() once the phrase is final. Never
// itself written to history: it's a preview, not something that happened.
let liveLine = null;

export function updateLiveTranscript(text) {
  if (!liveLine) {
    liveLine = appendLine(text, 'user', 'log-live');
  } else {
    liveLine.textContent = text;
  }
  consoleLog.scrollTop = consoleLog.scrollHeight;
}

export function clearLiveTranscript() {
  liveLine?.remove();
  liveLine = null;
}

export function initTranscript() {
  // Replay whatever was saved from previous sessions before any new lines
  // (e.g. the boot-time welcome message) get appended on top; a genuinely
  // first-ever visit has no history yet, so show the original static
  // greeting once instead (and it becomes real history from here on).
  const history = conversationStore.get();
  if (history.length) {
    history.forEach((entry) => appendLine(entry.text, entry.who));
  } else {
    addLogLine('Charlie is powered down. Tap the core to wake me up.', 'system');
  }

  clearBtn.addEventListener('click', () => {
    consoleLog.innerHTML = '';
    conversationStore.set([]);
    addLogLine('Transcript cleared.', 'system');
  });
}
