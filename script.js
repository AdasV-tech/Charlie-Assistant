/* =========================================================
   CHARLIE ASSISTANT — SCRIPT.JS
   Everything runs client-side in the browser. No servers,
   no paid APIs. Uses the browser's built-in Web Speech API
   for both listening (SpeechRecognition) and talking
   (SpeechSynthesis).

   File map:
   1. DOM references
   2. Memory (localStorage) helpers
   3. UI state machine (sleeping / listening / thinking / speaking)
   4. Speech synthesis (Charlie talking)
   5. Speech recognition (Charlie listening)
   6. The "brain": command matching + ~20 predefined commands
   7. Boot sequence
   ========================================================= */

/* ---------------------------------------------------------
   1. DOM REFERENCES
   --------------------------------------------------------- */
const coreButton   = document.getElementById('coreButton');
const statusLabel  = document.getElementById('statusLabel');
const consoleLog   = document.getElementById('consoleLog');
const clearBtn     = document.getElementById('clearBtn');
const clockReadout = document.getElementById('clockReadout');
const tickGroup    = document.getElementById('tickGroup');

const voiceSelect  = document.getElementById('voiceSelect');
const rateRange    = document.getElementById('rateRange');
const pitchRange   = document.getElementById('pitchRange');
const resetMemoryBtn = document.getElementById('resetMemoryBtn');

const nameModal   = document.getElementById('nameModal');
const nameInput   = document.getElementById('nameInput');
const nameSubmit  = document.getElementById('nameSubmit');

/* ---------------------------------------------------------
   2. MEMORY (localStorage)
   Charlie remembers the user's name and a couple of voice
   preferences between visits. Everything stays on this
   device — nothing is sent anywhere.
   --------------------------------------------------------- */
const MEMORY_KEY = 'charlie_memory_v1';

function loadMemory() {
  const raw = localStorage.getItem(MEMORY_KEY);
  if (!raw) return { userName: null, voiceIndex: null, rate: 1, pitch: 1 };
  try {
    return JSON.parse(raw);
  } catch (e) {
    // Corrupted data shouldn't crash the app — start fresh.
    return { userName: null, voiceIndex: null, rate: 1, pitch: 1 };
  }
}

function saveMemory(memory) {
  localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
}

let memory = loadMemory();

/* ---------------------------------------------------------
   3. UI STATE MACHINE
   Valid states: sleeping, listening, thinking, speaking.
   Setting body[data-state] drives all the CSS animations.
   --------------------------------------------------------- */
function setState(state) {
  document.body.setAttribute('data-state', state);
  statusLabel.textContent = state.toUpperCase();
}

function addLogLine(text, who) {
  // who: 'user' | 'charlie' | 'system'
  const line = document.createElement('div');
  line.className = `log-line log-${who}`;
  line.textContent = text;
  consoleLog.appendChild(line);
  consoleLog.scrollTop = consoleLog.scrollHeight;
}

clearBtn.addEventListener('click', () => {
  consoleLog.innerHTML = '';
  addLogLine('Transcript cleared.', 'system');
});

// Draw tick marks around the outer ring once, at load time.
(function drawTicks() {
  const cx = 200, cy = 200, r = 180;
  const count = 40;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const x1 = cx + Math.cos(angle) * (r - 6);
    const y1 = cy + Math.sin(angle) * (r - 6);
    const x2 = cx + Math.cos(angle) * (r + 6);
    const y2 = cy + Math.sin(angle) * (r + 6);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    tickGroup.appendChild(line);
  }
})();

// Live clock in the top bar.
function tickClock() {
  const now = new Date();
  clockReadout.textContent = now.toLocaleTimeString([], { hour12: false });
}
setInterval(tickClock, 1000);
tickClock();

/* ---------------------------------------------------------
   4. SPEECH SYNTHESIS (Charlie talking)
   --------------------------------------------------------- */
const synth = window.speechSynthesis;
let availableVoices = [];

function populateVoiceList() {
  availableVoices = synth.getVoices();
  voiceSelect.innerHTML = '';
  availableVoices.forEach((voice, i) => {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.appendChild(option);
  });
  // Restore the previously chosen voice, if we have one saved.
  if (memory.voiceIndex !== null && availableVoices[memory.voiceIndex]) {
    voiceSelect.value = memory.voiceIndex;
  }
}

// Voice list loads asynchronously in most browsers.
populateVoiceList();
if (synth.onvoiceschanged !== undefined) {
  synth.onvoiceschanged = populateVoiceList;
}

// Restore saved rate/pitch sliders.
rateRange.value = memory.rate;
pitchRange.value = memory.pitch;

function speak(text) {
  if (!('speechSynthesis' in window)) {
    addLogLine('Speech output is not supported in this browser.', 'system');
    return;
  }

  // Cancel anything currently queued so responses never overlap.
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const chosenVoice = availableVoices[voiceSelect.value];
  if (chosenVoice) utterance.voice = chosenVoice;
  utterance.rate = parseFloat(rateRange.value);
  utterance.pitch = parseFloat(pitchRange.value);

  utterance.onstart = () => setState('speaking');
  utterance.onend = () => setState('sleeping');
  utterance.onerror = () => setState('sleeping');

  addLogLine(text, 'charlie');
  synth.speak(utterance);
}

// Persist voice/rate/pitch choices whenever they change.
voiceSelect.addEventListener('change', () => {
  memory.voiceIndex = parseInt(voiceSelect.value, 10);
  saveMemory(memory);
});
rateRange.addEventListener('change', () => {
  memory.rate = parseFloat(rateRange.value);
  saveMemory(memory);
});
pitchRange.addEventListener('change', () => {
  memory.pitch = parseFloat(pitchRange.value);
  saveMemory(memory);
});

/* ---------------------------------------------------------
   5. SPEECH RECOGNITION (Charlie listening)
   --------------------------------------------------------- */
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

if (SpeechRecognitionAPI) {
  recognition = new SpeechRecognitionAPI();
  recognition.lang = 'en-US';
  recognition.continuous = false;   // stop automatically after one phrase
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    setState('listening');
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    addLogLine(transcript, 'user');
    setState('thinking');
    // Small delay so the "thinking" state is visible before Charlie replies —
    // this also leaves room to plug in a slower AI backend later.
    setTimeout(() => handleCommand(transcript), 500);
  };

  recognition.onerror = (event) => {
    isListening = false;
    setState('sleeping');
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      addLogLine('Microphone permission was denied. Please allow microphone access.', 'system');
    } else if (event.error === 'no-speech') {
      addLogLine("I didn't hear anything. Try again.", 'system');
    } else {
      addLogLine(`Recognition error: ${event.error}`, 'system');
    }
  };

  recognition.onend = () => {
    isListening = false;
    if (document.body.getAttribute('data-state') === 'listening') {
      setState('sleeping');
    }
  };
} else {
  addLogLine('Speech recognition is not supported in this browser. Try Chrome or Edge.', 'system');
}

coreButton.addEventListener('click', () => {
  if (!recognition) {
    addLogLine('Speech recognition is not supported in this browser. Try Chrome or Edge.', 'system');
    return;
  }

  // If Charlie is speaking, treat a tap as "stop talking".
  if (synth.speaking) {
    synth.cancel();
    setState('sleeping');
    return;
  }

  if (isListening) {
    recognition.stop();
    return;
  }

  try {
    recognition.abort();
    recognition.start();
  } catch (e) {
    addLogLine('Unable to start the microphone. Please try again.', 'system');
  }
});

/* ---------------------------------------------------------
   6. THE BRAIN — command matching
   Simple, transparent keyword matching. Each command is a
   { patterns, respond } pair. `patterns` are substrings we
   look for in the lowercased transcript. `respond` returns
   the spoken reply (and can read/write memory).

   This is intentionally simple so it's easy to extend later
   — see README "Future Upgrades" for ideas like swapping this
   for a local AI model.
   --------------------------------------------------------- */
function getUserLabel() {
  return memory.userName ? memory.userName : 'there';
}

const commands = [
  {
    patterns: ['what time is it', "what's the time", 'current time'],
    respond: () => `The current time is ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
  },
  {
    patterns: ["what's the date", 'what is the date', "today's date", 'what day is it'],
    respond: () => `Today is ${new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`
  },
  {
    patterns: ['hello charlie', 'hey charlie', 'hi charlie'],
    respond: () => `Hello ${getUserLabel()}, how can I help?`
  },
  {
    patterns: ['hello', 'hi there', 'hey'],
    respond: () => `Hi ${getUserLabel()}! What can I do for you?`
  },
  {
    patterns: ['what can you do', 'what are your features', 'help me', 'help'],
    respond: () => 'I can answer simple questions, tell you the time and date, remember your name, and control a few basic features. Try asking me to tell a joke or flip a coin.'
  },
  {
    patterns: ['what is your name', "what's your name", 'who are you'],
    respond: () => "I'm Charlie, your personal voice assistant."
  },
  {
    patterns: ['my name is', 'call me', 'remember my name'],
    respond: (transcript) => {
      const extracted = extractName(transcript);
      if (extracted) {
        memory.userName = extracted;
        saveMemory(memory);
        return `Got it, I'll remember you as ${extracted}.`;
      }
      return "I didn't catch the name. Could you say 'my name is' followed by your name?";
    }
  },
  {
    patterns: ['do you know my name', 'what is my name', "what's my name"],
    respond: () => memory.userName ? `Your name is ${memory.userName}.` : "I don't know your name yet. Tell me by saying 'my name is' and your name."
  },
  {
    patterns: ['forget me', 'forget my name', 'clear my data', 'reset memory'],
    respond: () => {
      resetMemory();
      return 'All done. I have forgotten your name and reset your settings.';
    }
  },
  {
    patterns: ['tell me a joke', 'joke'],
    respond: () => randomFrom([
      'Why do programmers prefer dark mode? Because light attracts bugs.',
      'I would tell you a UDP joke, but you might not get it.',
      'Why did the robot go on a diet? It had too many bytes.'
    ])
  },
  {
    patterns: ['flip a coin', 'toss a coin'],
    respond: () => Math.random() < 0.5 ? 'Heads.' : 'Tails.'
  },
  {
    patterns: ['roll a dice', 'roll a die', 'roll the dice'],
    respond: () => `You rolled a ${1 + Math.floor(Math.random() * 6)}.`
  },
  {
    patterns: ['thank you', 'thanks charlie', 'thanks'],
    respond: () => "You're welcome!"
  },
  {
    patterns: ['how are you'],
    respond: () => "I'm running smoothly, thanks for asking. How are you?"
  },
  {
    patterns: ['good morning'],
    respond: () => `Good morning, ${getUserLabel()}. Ready when you are.`
  },
  {
    patterns: ['good night', 'goodnight'],
    respond: () => `Good night, ${getUserLabel()}. I'll be here whenever you need me.`
  },
  {
    patterns: ['open google'],
    respond: () => { window.open('https://www.google.com', '_blank'); return 'Opening Google.'; }
  },
  {
    patterns: ['open youtube'],
    respond: () => { window.open('https://www.youtube.com', '_blank'); return 'Opening YouTube.'; }
  },
  {
    patterns: ['search for'],
    respond: (transcript) => {
      const query = transcript.toLowerCase().split('search for')[1];
      if (query && query.trim()) {
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query.trim())}`, '_blank');
        return `Searching for ${query.trim()}.`;
      }
      return 'What would you like me to search for?';
    }
  },
  {
    patterns: ['stop', 'stop listening', 'go to sleep', 'sleep'],
    respond: () => { synth.cancel(); return 'Going to sleep. Tap the core to wake me.'; }
  },
  {
    patterns: ['are you an ai', 'are you a robot'],
    respond: () => "I'm a simple assistant built with your browser's speech tools — no external AI needed."
  }
];

// Very small helper to pull a name out of phrases like
// "my name is Adas" / "call me Adas".
function extractName(transcript) {
  const lower = transcript.toLowerCase();
  const markers = ['my name is', 'call me', 'remember my name is'];
  for (const marker of markers) {
    const idx = lower.indexOf(marker);
    if (idx !== -1) {
      const raw = transcript.slice(idx + marker.length).trim();
      if (raw) {
        // Capitalize the first letter for a tidy display name.
        const firstWord = raw.split(' ')[0].replace(/[^a-zA-Z-]/g, '');
        if (firstWord) return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
      }
    }
  }
  return null;
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function handleCommand(transcript) {
  const lower = transcript.toLowerCase();
  const match = commands.find((cmd) => cmd.patterns.some((p) => lower.includes(p)));

  if (match) {
    const reply = match.respond(transcript);
    speak(reply);
  } else {
    speak("I don't have an answer for that yet, but you can teach me more commands in script.js.");
  }
}

/* ---------------------------------------------------------
   7. BOOT SEQUENCE
   On first visit, ask for the user's name. On return visits,
   greet them by name and restore their saved settings.
   --------------------------------------------------------- */
function resetMemory() {
  memory = { userName: null, voiceIndex: null, rate: 1, pitch: 1 };
  saveMemory(memory);
  rateRange.value = 1;
  pitchRange.value = 1;
}

resetMemoryBtn.addEventListener('click', () => {
  resetMemory();
  addLogLine('Memory wiped. Refresh the page to set up again.', 'system');
});

nameSubmit.addEventListener('click', submitName);
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitName(); });

function submitName() {
  const value = nameInput.value.trim();
  if (!value) return;
  memory.userName = value.charAt(0).toUpperCase() + value.slice(1);
  saveMemory(memory);
  nameModal.classList.add('hidden');
  addLogLine(`Welcome, ${memory.userName}. Tap the core to talk to me.`, 'system');
}

function boot() {
  setState('sleeping');
  if (!memory.userName) {
    nameModal.classList.remove('hidden');
  } else {
    nameModal.classList.add('hidden');
    addLogLine(`Welcome back, ${memory.userName}. Tap the core to talk to me.`, 'system');
  }
}

boot();
