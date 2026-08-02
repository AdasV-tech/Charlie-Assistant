// First-run "what should I call you?" modal.
import { memoryStore } from '../store/stores.js';
import { addLogLine } from './transcript.js';

const nameModal = document.getElementById('nameModal');
const nameInput = document.getElementById('nameInput');
const nameSubmit = document.getElementById('nameSubmit');

function submitName() {
  const value = nameInput.value.trim();
  if (!value) return;
  const userName = value.charAt(0).toUpperCase() + value.slice(1);
  memoryStore.update((m) => ({ ...m, userName }));
  nameModal.classList.add('hidden');
  addLogLine(`Welcome, ${userName}. Tap the core to talk to me.`, 'system');
}

// Shows the modal on first run, or a welcome-back log line on return visits.
export function initNameModal() {
  nameSubmit.addEventListener('click', submitName);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitName();
  });

  const { userName } = memoryStore.get();
  if (!userName) {
    nameModal.classList.remove('hidden');
  } else {
    nameModal.classList.add('hidden');
    addLogLine(`Welcome back, ${userName}. Tap the core to talk to me.`, 'system');
  }
}
