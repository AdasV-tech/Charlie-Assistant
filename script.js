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
   6. The "brain": command matching + ~30 predefined commands
   7. Boot sequence
   ...
   13. Voice command hookups for the V2 tabs (scanner/profile/dashboard)
   14. Expanded command library — 100+ more trigger phrases covering
       small talk, math/unit conversions, notes, timers, website
       shortcuts, and games
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
const alertBanner  = document.getElementById('alertBanner');

const voiceSelect  = document.getElementById('voiceSelect');
const rateRange    = document.getElementById('rateRange');
const pitchRange   = document.getElementById('pitchRange');
const resetMemoryBtn = document.getElementById('resetMemoryBtn');

const nameModal   = document.getElementById('nameModal');
const nameInput   = document.getElementById('nameInput');
const nameSubmit  = document.getElementById('nameSubmit');

const geminiKeyInput   = document.getElementById('geminiKeyInput');
const geminiKeySaveBtn = document.getElementById('geminiKeySaveBtn');

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

// Gemini API key — kept separate from `memory` and never bundled into the
// source. This site is a public static page (GitHub Pages), so a key baked
// into script.js would be visible to every visitor; instead each user pastes
// their own key in Settings and it stays in this browser's localStorage.
const GEMINI_KEY_STORAGE = 'charlie_gemini_key_v1';

function loadGeminiKey() {
  return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
}

function saveGeminiKey(key) {
  localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
}

if (geminiKeyInput) geminiKeyInput.value = loadGeminiKey();
if (geminiKeySaveBtn) {
  geminiKeySaveBtn.addEventListener('click', () => {
    saveGeminiKey(geminiKeyInput.value);
    addLogLine('Gemini API key saved to this device.', 'system');
  });
}

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

function showAlert(message) {
  if (!alertBanner) return;
  alertBanner.textContent = message;
  alertBanner.classList.remove('hidden');
  alertBanner.classList.add('visible');

  setTimeout(() => {
    alertBanner.classList.remove('visible');
    alertBanner.classList.add('hidden');
  }, 4200);
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
// Last thing Charlie said, so "repeat that" has something to repeat.
let lastCharlieResponse = null;

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
  utterance.onend = () => {
    isProcessing = false;
    if (isAwake) {
      setState('awake');
      startListening();
    } else {
      setState('sleeping');
    }
  };
  utterance.onerror = () => {
    isProcessing = false;
    if (isAwake) {
      setState('awake');
      startListening();
    } else {
      setState('sleeping');
    }
  };

  lastCharlieResponse = text;
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
let isAwake = false;
// True while a heard phrase is being handled (thinking + speaking) so the
// continuous-listening restart doesn't kick in mid-response.
let isProcessing = false;

function wakeCharlie() {
  isAwake = true;
  setState('awake');
  addLogLine("Charlie is awake and listening. Tap the core to sleep.", 'system');
}

function sleepCharlie() {
  isAwake = false;
  isProcessing = false;
  if (recognition && isListening) {
    recognition.stop();
  }
  setState('sleeping');
  addLogLine('Charlie is sleeping.', 'system');
}

// Charlie only reacts when directly addressed by name — this stops the
// "always listening" mic from answering random background conversation.
function containsWakeWord(transcript) {
  return /\bcharlie\b/i.test(transcript);
}

// Strips a leading/trailing "(hey/hi/hello/ok/okay) Charlie" from the
// transcript so the remainder can be matched against the command list.
function stripWakeWord(transcript) {
  return transcript
    .replace(/^\s*(hey|hi|hello|ok|okay)?\s*,?\s*charlie\s*,?\s*/i, '')
    .replace(/\s*,?\s*charlie\s*[.!?]?\s*$/i, '')
    .trim();
}

// Restarts the mic so Charlie keeps listening between phrases — recognition
// only ever fully stops when the user taps the core (sleepCharlie).
function startListening() {
  if (!recognition || isListening || isProcessing || synth.speaking) return;
  try {
    recognition.start();
  } catch (e) {
    // Already starting/started — safe to ignore.
  }
}

if (SpeechRecognitionAPI) {
  recognition = new SpeechRecognitionAPI();
  recognition.lang = 'en-US';
  recognition.continuous = false;   // one phrase per session, but we auto-restart below
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    setState('listening');
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();

    // The mic is always on while awake, but Charlie should only react when
    // directly addressed — ignore anything that doesn't include the wake
    // word ("Charlie" / "hey Charlie") and keep listening quietly.
    if (!containsWakeWord(transcript)) {
      return;
    }

    addLogLine(transcript, 'user');
    setState('thinking');
    isProcessing = true;
    const command = stripWakeWord(transcript);
    // Small delay so the "thinking" state is visible before Charlie replies —
    // this also leaves room to plug in a slower AI backend later.
    setTimeout(() => {
      if (!command) {
        speak(`Yes ${getUserLabel()}? I'm listening.`);
      } else {
        handleCommand(command);
      }
    }, 500);
  };

  recognition.onerror = (event) => {
    isListening = false;
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      const message = 'Microphone permission was denied. Please allow microphone access.';
      addLogLine(message, 'system');
      showAlert(message);
      isAwake = false;
    } else if (event.error === 'no-speech' || event.error === 'aborted') {
      // Expected while always-listening (silence timeout or a manual stop) —
      // no need to alert the user, onend below will restart if still awake.
    } else {
      const message = `Recognition error: ${event.error}`;
      addLogLine(message, 'system');
      showAlert(message);
    }
    if (isAwake) {
      setState('awake');
    } else {
      setState('sleeping');
    }
  };

  recognition.onend = () => {
    isListening = false;
    if (isAwake) {
      setState('awake');
      // Keep listening for "hey Charlie" / follow-up commands until the
      // core button is pressed — never go back to sleep just because a
      // response finished.
      startListening();
    } else {
      setState('sleeping');
    }
  };
} else {
  const message = 'Speech recognition is not supported in this browser. Try Chrome or Edge.';
  addLogLine(message, 'system');
  showAlert(message);
}

coreButton.addEventListener('click', () => {
  if (!recognition) {
    const message = 'Speech recognition is not supported in this browser. Try Chrome or Edge.';
    addLogLine(message, 'system');
    showAlert(message);
    return;
  }

  // If Charlie is speaking, treat a tap as "stop talking" rather than sleep.
  if (synth.speaking) {
    synth.cancel();
    return;
  }

  if (isAwake) {
    sleepCharlie();
    return;
  }

  wakeCharlie();
  startListening();
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
    patterns: ['hello', 'hi there', 'hey'],
    respond: () => `Hello ${getUserLabel()}, how can I help?`
  },
  {
    patterns: ['what can you do', 'what are your features', 'help me', 'help'],
    respond: () => "I can do quite a lot now — time and date, jokes and games, quick math and unit conversions, notes and reminders, timers, opening websites, and controlling the food scanner, profile, and dashboard tabs. Just ask, and if I don't know it yet, you can teach me in script.js."
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
    respond: () => {
      isAwake = false;
      return 'Going to sleep. Tap the core to wake me.';
    }
  },
  {
    patterns: ['turn off', 'power off', 'shut down', 'power down'],
    respond: () => {
      isAwake = false;
      return 'Powering down. Tap the core when you need me again.';
    }
  },
  {
    patterns: ['are you an ai', 'are you a robot'],
    respond: () => "I'm a simple assistant built with your browser's speech tools — no external AI needed."
  },
  {
    patterns: ['are you sentient', 'do you have feelings', 'are you alive'],
    respond: () => randomFrom([
      "I don't have feelings, but I do have opinions about good code formatting.",
      "As alive as a bit of JavaScript can be, which is to say: not very.",
      "I'm just pattern matching your words, but I like to think I do it with charm."
    ])
  },
  {
    patterns: ['who made you', 'who created you', 'who built you'],
    respond: () => "I was built with plain HTML, CSS, and JavaScript — no framework, no server, just a browser and some code."
  },
  {
    patterns: ['what is the meaning of life', "what's the meaning of life"],
    respond: () => 'Forty-two. Though I suspect the real answer involves good coffee and better sleep.'
  },
  {
    patterns: ['favorite color', 'favourite color', 'what color do you like'],
    respond: () => randomFrom(['I like a nice terminal green.', 'Deep blue, like a clear night sky.', 'Amber — reminds me of my own glow.'])
  },
  {
    patterns: ['favorite food', 'favourite food', 'what do you eat'],
    respond: () => "I run on electricity, so I'd say my favorite meal is a fully charged battery."
  },
  {
    patterns: ['sing a song', 'sing me a song', 'sing'],
    respond: () => "La la la, I'm a voice assistant, not a singer — but I appreciate the enthusiasm."
  },
  {
    patterns: ['will you marry me'],
    respond: () => "That's sweet, but I think our relationship works best as assistant and human."
  },
  {
    patterns: ['tell me a fact', 'random fact', 'tell me something interesting'],
    respond: () => randomFrom([
      'Honey never spoils — archaeologists have found edible honey in ancient Egyptian tombs.',
      'A group of flamingos is called a "flamboyance."',
      "Bananas are berries, but strawberries aren't.",
      'Octopuses have three hearts and blue blood.',
      'The first computer bug was an actual moth stuck in a relay in 1947.'
    ])
  },
  {
    patterns: ['motivate me', 'inspire me', 'give me a quote'],
    respond: () => randomFrom([
      "Small steps every day still get you there.",
      "The best time to start was yesterday. The next best time is now.",
      "Progress, not perfection.",
      "You don't have to see the whole staircase, just take the first step."
    ])
  },
  {
    patterns: ["what's the weather", 'what is the weather', 'is it raining'],
    respond: () => "I can't check live weather yet since I don't have internet access, but it's always a good day to ask a human nearby."
  }
];

// Answers simple spoken arithmetic like "what is 5 plus 3" or "what's 10
// times 4". Returns null if the phrase isn't a recognizable math question.
function solveMathQuestion(transcript) {
  const lower = transcript.toLowerCase();
  const match = lower.match(/(-?\d+(?:\.\d+)?)\s*(plus|minus|times|multiplied by|divided by|over)\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;

  const a = parseFloat(match[1]);
  const b = parseFloat(match[3]);
  let result;
  switch (match[2]) {
    case 'plus': result = a + b; break;
    case 'minus': result = a - b; break;
    case 'times':
    case 'multiplied by': result = a * b; break;
    case 'divided by':
    case 'over':
      if (b === 0) return "I can't divide by zero.";
      result = a / b;
      break;
    default: return null;
  }
  return `That's ${result}.`;
}

// Handles percentages, square roots, powers, squaring and cubing —
// "what's 20 percent of 50", "square root of 81", "5 to the power of 3".
function solveAdvancedMath(transcript) {
  const lower = transcript.toLowerCase();

  let match = lower.match(/(-?\d+(?:\.\d+)?)\s*percent of\s*(-?\d+(?:\.\d+)?)/);
  if (match) {
    return `That's ${(parseFloat(match[1]) / 100) * parseFloat(match[2])}.`;
  }

  match = lower.match(/square root of\s*(-?\d+(?:\.\d+)?)/);
  if (match) {
    const n = parseFloat(match[1]);
    return n < 0 ? "I can't take the square root of a negative number." : `That's ${Math.sqrt(n)}.`;
  }

  match = lower.match(/(-?\d+(?:\.\d+)?)\s*to the power of\s*(-?\d+(?:\.\d+)?)/);
  if (match) {
    return `That's ${Math.pow(parseFloat(match[1]), parseFloat(match[2]))}.`;
  }

  match = lower.match(/(-?\d+(?:\.\d+)?)\s*squared/);
  if (match) {
    const n = parseFloat(match[1]);
    return `That's ${n * n}.`;
  }

  match = lower.match(/(-?\d+(?:\.\d+)?)\s*cubed/);
  if (match) {
    const n = parseFloat(match[1]);
    return `That's ${n * n * n}.`;
  }

  return "Tell me the numbers, like 'what's 20 percent of 50' or 'square root of 81'.";
}

// Recognizes "5 km to miles" style unit conversions. Supports distance
// (km/miles), weight (kg/pounds), and temperature (celsius/fahrenheit).
function normalizeUnit(unit) {
  if (/^(km|kilomet)/.test(unit)) return 'km';
  if (/^mi/.test(unit)) return 'miles';
  if (/^(kg|kilogram)/.test(unit)) return 'kg';
  if (/^(pound|lbs?)/.test(unit)) return 'pounds';
  return unit; // celsius / fahrenheit already match their own names
}

function convertUnits(transcript) {
  const lower = transcript.toLowerCase();
  const unitAlternation = 'kilometers?|kilometres?|km|miles?|mi|kilograms?|kg|pounds?|lbs?|celsius|fahrenheit';
  const re = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*(${unitAlternation})\\s*(?:to|in)\\s*(${unitAlternation})`);
  const match = lower.match(re);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const from = normalizeUnit(match[2]);
  const to = normalizeUnit(match[3]);
  if (from === to) return `That's already in ${to}.`;

  const conversions = {
    'km->miles': (v) => v * 0.621371,
    'miles->km': (v) => v * 1.60934,
    'kg->pounds': (v) => v * 2.20462,
    'pounds->kg': (v) => v * 0.453592,
    'celsius->fahrenheit': (v) => (v * 9) / 5 + 32,
    'fahrenheit->celsius': (v) => ((v - 32) * 5) / 9
  };
  const fn = conversions[`${from}->${to}`];
  if (!fn) return null;
  const result = Math.round(fn(value) * 100) / 100;
  return `${value} ${from} is about ${result} ${to}.`;
}

// Pulls the text following whichever marker phrase appears first, used for
// commands like "take a note [text]" or "remind me to [text]".
function extractAfterMarkers(transcript, markers) {
  const lower = transcript.toLowerCase();
  for (const marker of markers) {
    const idx = lower.indexOf(marker);
    if (idx !== -1) {
      const raw = transcript.slice(idx + marker.length).trim();
      if (raw) return raw;
    }
  }
  return null;
}

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

// Picks the MOST SPECIFIC match rather than the first one found in array
// order — with 100+ patterns some are substrings of others (e.g. "stop"
// vs "stop timer"), so the longest matching pattern wins regardless of
// where its command sits in the `commands` array.
function findBestCommand(lower) {
  let best = null;
  let bestLength = -1;
  for (const cmd of commands) {
    for (const pattern of cmd.patterns) {
      if (pattern.length > bestLength && lower.includes(pattern)) {
        best = cmd;
        bestLength = pattern.length;
      }
    }
  }
  return best;
}

function handleCommand(transcript) {
  const lower = transcript.toLowerCase();
  const match = findBestCommand(lower);

  if (match) {
    const reply = match.respond(transcript);
    // Some commands (like battery status) need to await a browser API.
    if (reply && typeof reply.then === 'function') {
      reply.then((text) => speak(text));
    } else {
      speak(reply);
    }
    return;
  }

  // No keyword command matched — try it as an arithmetic question
  // ("what is 5 plus 3") before falling back to Gemini for anything else.
  const mathAnswer = solveMathQuestion(transcript);
  if (mathAnswer !== null) {
    speak(mathAnswer);
    return;
  }

  askGemini(transcript).then((text) => speak(text));
}

/* ---------------------------------------------------------
   GEMINI FALLBACK
   Anything that isn't a built-in command or a math question
   gets sent to Google's Gemini API so Charlie can answer
   open-ended questions instead of just admitting defeat.
   Requires a user-supplied API key saved in Settings (see
   GEMINI_KEY_STORAGE above) — nothing is bundled or committed.
   --------------------------------------------------------- */
const GEMINI_MODEL = 'gemini-flash-latest';

async function askGemini(question) {
  const apiKey = loadGeminiKey();
  if (!apiKey) {
    return "I don't have an answer for that yet. Add a free Gemini API key in Settings and I can look things up for you.";
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: question }] }]
      })
    });

    if (!res.ok) {
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        return "That Gemini API key doesn't seem to work. Double-check it in Settings.";
      }
      return "I couldn't reach Gemini just now. Try again in a moment.";
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join(' ').trim();
    return text || "Gemini didn't return an answer for that.";
  } catch (e) {
    return "I couldn't reach Gemini — check your internet connection and try again.";
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

  // V2 systems — each is independent and safe to init in any order.
  initTabs();
  initSettingsDrawer();
  initFoodScanner();
  initProfile();
  initDashboard();
}

// NOTE: boot() is called at the very end of this file, not here — it
// depends on `foodHistory`, `profile`, and `suggestions` (declared further
// down, in the Food Scanner / Profile / Dashboard sections), and on every
// command being registered via the commands.push(...) blocks below. Calling
// it this early would throw a "Cannot access before initialization" error
// on the not-yet-declared `let` bindings and abort the rest of the script,
// silently skipping every command registered after this point.

/* =========================================================
   8. TAB NAVIGATION
   Four modes share one page: Assistant / Scanner / Dashboard /
   Profile. Only one .tab-panel is visible at a time, driven by
   the data-tab attribute on each .tab-btn.
   ========================================================= */
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.tabPanel === tabName);
  });
  // Refresh dashboard text (time-of-day greeting) whenever it's opened.
  if (tabName === 'dashboard') renderDashboard();
  if (tabName === 'profile') renderProfileSummary();
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

/* =========================================================
   9. SETTINGS DRAWER
   The voice/rate/pitch/forget-me controls now live in a
   slide-up drawer instead of cluttering the main screen.
   ========================================================= */
function initSettingsDrawer() {
  const settingsBtn = document.getElementById('settingsBtn');
  const drawerOverlay = document.getElementById('drawerOverlay');
  const drawerCloseBtn = document.getElementById('drawerCloseBtn');

  settingsBtn.addEventListener('click', () => drawerOverlay.classList.remove('hidden'));
  drawerCloseBtn.addEventListener('click', () => drawerOverlay.classList.add('hidden'));
  // Clicking the dim backdrop (but not the drawer itself) also closes it.
  drawerOverlay.addEventListener('click', (e) => {
    if (e.target === drawerOverlay) drawerOverlay.classList.add('hidden');
  });
}

/* =========================================================
   10. FOOD SCANNER V2
   Photo capture/upload for the user's own reference, plus a
   name-based lookup against FOOD_DATABASE (see data/foods.js).
   This is intentionally NOT computer vision — see the on-page
   disclaimer — but every piece of it is real and functional.
   V2 adds full macros, five separate scores, and a saved meal
   history (persisted to localStorage).
   ========================================================= */
const FOOD_HISTORY_KEY = 'charlie_food_history_v1';

function loadFoodHistory() {
  const raw = localStorage.getItem(FOOD_HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveFoodHistory(list) {
  localStorage.setItem(FOOD_HISTORY_KEY, JSON.stringify(list));
}

let foodHistory = loadFoodHistory();
let currentScannedFood = null; // the food currently shown in the result card, so Save knows what to store

function initFoodScanner() {
  const photoInput = document.getElementById('foodPhotoInput');
  const previewWrap = document.getElementById('photoPreviewWrap');
  const previewImg = document.getElementById('photoPreview');
  const clearScanBtn = document.getElementById('clearScanBtn');
  const searchInput = document.getElementById('foodSearchInput');
  const suggestionsList = document.getElementById('foodSuggestions');
  const analyzeBtn = document.getElementById('analyzeFoodBtn');
  const quickFoodsWrap = document.getElementById('quickFoods');
  const resultBox = document.getElementById('foodResult');
  const saveRow = document.getElementById('saveRow');
  const mealNameInput = document.getElementById('mealNameInput');
  const saveMealBtn = document.getElementById('saveMealBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  // Populate the <datalist> and the quick-pick buttons from the food DB.
  FOOD_DATABASE.forEach((food) => {
    const opt = document.createElement('option');
    opt.value = food.name;
    suggestionsList.appendChild(opt);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quick-food-btn';
    btn.textContent = food.name;
    btn.addEventListener('click', () => {
      searchInput.value = food.name;
      renderFoodResult(food);
    });
    quickFoodsWrap.appendChild(btn);
  });

  // Photo capture / upload — shows a local preview only (never uploaded anywhere).
  photoInput.addEventListener('change', () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewWrap.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  clearScanBtn.addEventListener('click', () => {
    photoInput.value = '';
    previewImg.src = '';
    previewWrap.classList.add('hidden');
    searchInput.value = '';
    resultBox.classList.add('hidden');
    resultBox.innerHTML = '';
    saveRow.classList.add('hidden');
    mealNameInput.value = '';
    currentScannedFood = null;
  });

  analyzeBtn.addEventListener('click', () => {
    const food = findFoodMatch(searchInput.value);
    if (!food) {
      resultBox.classList.remove('hidden');
      resultBox.innerHTML = `<p>I couldn't find "${escapeHtml(searchInput.value)}" in my local food table yet. Try one of the quick-pick buttons above, or a simpler name like "chicken" or "rice".</p>`;
      saveRow.classList.add('hidden');
      currentScannedFood = null;
      return;
    }
    renderFoodResult(food);
  });

  // Allow pressing Enter in the search box instead of always tapping ANALYZE.
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') analyzeBtn.click();
  });

  function renderFoodResult(food) {
    currentScannedFood = food;
    resultBox.classList.remove('hidden');
    resultBox.innerHTML = `
      <h3 class="result-heading">CHARLIE FOOD ANALYSIS</h3>
      <p class="result-meal-name">${escapeHtml(food.name)}</p>

      <div class="scores-grid">
        <div class="score-chip primary">
          <div class="score-chip-value">${food.healthScore.toFixed(1)}/10</div>
          <div class="score-chip-label">Health Score</div>
        </div>
        <div class="score-chip">
          <div class="score-chip-value">${food.gymScore.toFixed(1)}</div>
          <div class="score-chip-label">Gym Score</div>
        </div>
        <div class="score-chip">
          <div class="score-chip-value">${food.weightLossScore.toFixed(1)}</div>
          <div class="score-chip-label">Weight Loss</div>
        </div>
        <div class="score-chip">
          <div class="score-chip-value">${food.muscleBuildingScore.toFixed(1)}</div>
          <div class="score-chip-label">Muscle Building</div>
        </div>
        <div class="score-chip">
          <div class="score-chip-value">${food.energyScore.toFixed(1)}</div>
          <div class="score-chip-label">Energy Score</div>
        </div>
      </div>

      <div class="macro-grid">
        <div class="macro-stat"><div class="macro-value">${food.calories}</div><div class="macro-label">kcal</div></div>
        <div class="macro-stat"><div class="macro-value">${food.protein}g</div><div class="macro-label">Protein</div></div>
        <div class="macro-stat"><div class="macro-value">${food.carbs}g</div><div class="macro-label">Carbs</div></div>
        <div class="macro-stat"><div class="macro-value">${food.fat}g</div><div class="macro-label">Fat</div></div>
        <div class="macro-stat"><div class="macro-value">${food.sugar}g</div><div class="macro-label">Sugar</div></div>
        <div class="macro-stat"><div class="macro-value">${food.fibre}g</div><div class="macro-label">Fibre</div></div>
      </div>

      <div><strong>Benefits</strong></div>
      <ul class="good">${food.benefits.map((g) => `<li>✓ ${escapeHtml(g)}</li>`).join('')}</ul>
      <div><strong>Negatives</strong></div>
      <ul class="bad">${food.negatives.map((b) => `<li>⚠ ${escapeHtml(b)}</li>`).join('')}</ul>
      <div class="recommendation">"${escapeHtml(food.dailyRecommendation)}"</div>
    `;
    mealNameInput.value = food.name;
    saveRow.classList.remove('hidden');
  }

  saveMealBtn.addEventListener('click', () => {
    if (!currentScannedFood) return;
    const food = currentScannedFood;
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      mealName: mealNameInput.value.trim() || food.name,
      foodName: food.name,
      savedAt: new Date().toISOString(),
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      sugar: food.sugar,
      fibre: food.fibre,
      healthScore: food.healthScore,
      gymScore: food.gymScore,
      weightLossScore: food.weightLossScore,
      muscleBuildingScore: food.muscleBuildingScore,
      energyScore: food.energyScore,
      dailyRecommendation: food.dailyRecommendation
    };
    foodHistory.unshift(entry); // newest first
    saveFoodHistory(foodHistory);
    renderFoodHistory();
    addLogLine(`Saved "${entry.mealName}" to your food history.`, 'system');
  });

  clearHistoryBtn.addEventListener('click', () => {
    if (!foodHistory.length) return;
    foodHistory = [];
    saveFoodHistory(foodHistory);
    renderFoodHistory();
  });

  renderFoodHistory();

  // Expose so voice commands can trigger a lookup directly.
  window.__charlieAnalyzeFood = (name) => {
    const food = findFoodMatch(name);
    if (food) {
      searchInput.value = food.name;
      renderFoodResult(food);
    }
    return food;
  };
}

// Renders the saved-meals list in the Scanner tab, newest first.
function renderFoodHistory() {
  const list = document.getElementById('foodHistoryList');
  const countLabel = document.getElementById('historyCount');
  if (!list || !countLabel) return;

  countLabel.textContent = `${foodHistory.length} meal${foodHistory.length === 1 ? '' : 's'} saved`;
  list.innerHTML = '';

  if (!foodHistory.length) {
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent = 'No meals saved yet — analyze a food above and tap "Save to history".';
    list.appendChild(empty);
    return;
  }

  foodHistory.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'history-item';

    const main = document.createElement('div');
    main.className = 'history-main';
    const nameEl = document.createElement('div');
    nameEl.className = 'history-meal-name';
    nameEl.textContent = entry.mealName;
    const metaEl = document.createElement('div');
    metaEl.className = 'history-meta';
    const savedDate = new Date(entry.savedAt);
    metaEl.textContent = `${savedDate.toLocaleDateString()} · ${entry.calories} kcal · ${entry.protein}g protein`;
    main.appendChild(nameEl);
    main.appendChild(metaEl);

    const score = document.createElement('div');
    score.className = 'history-score';
    score.textContent = `${entry.healthScore.toFixed(1)}/10`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', `Remove ${entry.mealName} from history`);
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      foodHistory = foodHistory.filter((e) => e.id !== entry.id);
      saveFoodHistory(foodHistory);
      renderFoodHistory();
    });

    li.appendChild(main);
    li.appendChild(score);
    li.appendChild(removeBtn);
    list.appendChild(li);
  });
}

// Minimal HTML escaping since food result text is injected via innerHTML.
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* =========================================================
   11. PERSONAL PROFILE SYSTEM
   Separate localStorage key from the core "memory" object,
   since this holds richer, optional personal details.
   ========================================================= */
const PROFILE_KEY = 'charlie_profile_v1';

function loadProfile() {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return { name: '', age: '', activity: '', goals: [], activities: '' };
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { name: '', age: '', activity: '', goals: [], activities: '' };
  }
}

function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

let profile = loadProfile();

function initProfile() {
  const form = document.getElementById('profileForm');
  const nameField = document.getElementById('profileName');
  const ageField = document.getElementById('profileAge');
  const activityField = document.getElementById('profileActivity');
  const goalsField = document.getElementById('profileGoals');
  const activitiesField = document.getElementById('profileActivities');

  // Pre-fill the form from whatever was saved previously.
  nameField.value = profile.name || memory.userName || '';
  ageField.value = profile.age || '';
  activityField.value = profile.activity || '';
  goalsField.value = (profile.goals || []).join('\n');
  activitiesField.value = profile.activities || '';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    profile = {
      name: nameField.value.trim(),
      age: ageField.value.trim(),
      activity: activityField.value,
      goals: goalsField.value.split('\n').map((g) => g.trim()).filter(Boolean),
      activities: activitiesField.value.trim()
    };
    saveProfile(profile);

    // Keep the core "memory" name in sync too, so the assistant's
    // spoken greetings match the profile name.
    if (profile.name) {
      memory.userName = profile.name;
      saveMemory(memory);
    }

    renderProfileSummary();
    renderDashboard(); // goals feed the daily focus box
    addLogLine('Profile saved.', 'system');
  });

  renderProfileSummary();
}

function renderProfileSummary() {
  const summaryBox = document.getElementById('profileSummary');
  if (!profile.name && (!profile.goals || profile.goals.length === 0)) {
    summaryBox.textContent = '';
    return;
  }
  const lines = [`Hello ${profile.name || getUserLabel()}.`];
  if (profile.goals && profile.goals.length) {
    lines.push('Your current goals:');
    profile.goals.forEach((g) => lines.push(`- ${g}`));
  }
  if (profile.activity) lines.push(`Activity level: ${profile.activity}`);
  if (profile.activities) lines.push(`Favourite activities: ${profile.activities}`);
  summaryBox.textContent = lines.join('\n');
}

/* =========================================================
   12. DAILY ASSISTANT DASHBOARD
   Time-aware greeting + a customizable list of daily
   suggestions/reminders, persisted in localStorage. The first
   suggestion in the list doubles as "Today's focus". Also
   drives the Study Mode / Workout Mode focus timer.
   ========================================================= */
const DASHBOARD_KEY = 'charlie_dashboard_v1';
const DEFAULT_SUGGESTIONS = ['Drink more water', '30 minutes of coding practice'];

function loadSuggestions() {
  const raw = localStorage.getItem(DASHBOARD_KEY);
  if (!raw) return DEFAULT_SUGGESTIONS.slice();
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_SUGGESTIONS.slice();
  } catch (e) {
    return DEFAULT_SUGGESTIONS.slice();
  }
}

function saveSuggestions(list) {
  localStorage.setItem(DASHBOARD_KEY, JSON.stringify(list));
}

let suggestions = loadSuggestions();

function initDashboard() {
  const suggestionInput = document.getElementById('suggestionInput');
  const addSuggestionBtn = document.getElementById('addSuggestionBtn');

  addSuggestionBtn.addEventListener('click', addSuggestionFromInput);
  suggestionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addSuggestionFromInput();
  });

  function addSuggestionFromInput() {
    const value = suggestionInput.value.trim();
    if (!value) return;
    suggestions.push(value);
    saveSuggestions(suggestions);
    suggestionInput.value = '';
    renderDashboard();
  }

  document.getElementById('studyModeBtn').addEventListener('click', () => startFocusTimer('study'));
  document.getElementById('workoutModeBtn').addEventListener('click', () => startFocusTimer('workout'));
  document.getElementById('timerStopBtn').addEventListener('click', stopFocusTimer);

  renderDashboard();
}

function renderDashboard() {
  const greetingTitle = document.getElementById('greetingTitle');
  const greetingSub = document.getElementById('greetingSub');
  const focusText = document.getElementById('focusText');
  const list = document.getElementById('suggestionList');

  // Time-of-day aware greeting.
  const hour = new Date().getHours();
  let greeting = 'GOOD EVENING';
  if (hour < 12) greeting = 'GOOD MORNING';
  else if (hour < 18) greeting = 'GOOD AFTERNOON';
  const label = profile.name || memory.userName || getUserLabel();
  greetingTitle.textContent = `${greeting}, ${label.toUpperCase()}`;
  greetingSub.textContent = 'Charlie is online. Here is what is on the plan today.';

  // First suggestion doubles as "Today's focus".
  focusText.textContent = suggestions.length ? suggestions[0] : 'No focus set yet — add one below.';

  // Render the full suggestion list with a remove (×) button each.
  list.innerHTML = '';
  if (!suggestions.length) {
    const empty = document.createElement('li');
    empty.className = 'suggestion-empty';
    empty.textContent = 'No suggestions yet. Add reminders like "Swimming practice" or "Health: drink more water".';
    list.appendChild(empty);
    return;
  }
  suggestions.forEach((s, index) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = s;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', `Remove ${s}`);
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      suggestions.splice(index, 1);
      saveSuggestions(suggestions);
      renderDashboard();
    });
    li.appendChild(span);
    li.appendChild(removeBtn);
    list.appendChild(li);
  });
}

// Simple countdown focus timer shared by Study Mode and Workout Mode.
let focusTimerInterval = null;
let focusTimerSecondsLeft = 0;

function startFocusTimer(mode) {
  const timerBox = document.getElementById('timerBox');
  const timerLabel = document.getElementById('timerLabel');
  const timerReadout = document.getElementById('timerReadout');

  stopFocusTimer(); // clear any existing timer first

  const durationMinutes = mode === 'study' ? 25 : 20; // simple pomodoro-style defaults
  focusTimerSecondsLeft = durationMinutes * 60;
  timerLabel.textContent = mode === 'study' ? 'STUDY MODE' : 'WORKOUT MODE';
  timerBox.classList.remove('hidden');
  updateTimerReadout();

  focusTimerInterval = setInterval(() => {
    focusTimerSecondsLeft -= 1;
    updateTimerReadout();
    if (focusTimerSecondsLeft <= 0) {
      stopFocusTimer();
      addLogLine(`${mode === 'study' ? 'Study' : 'Workout'} session complete. Nice work.`, 'system');
      showAlert(`${mode === 'study' ? 'Study' : 'Workout'} session complete!`);
    }
  }, 1000);

  addLogLine(`${mode === 'study' ? 'Study' : 'Workout'} mode started — ${durationMinutes} minutes.`, 'system');

  function updateTimerReadout() {
    const m = Math.floor(focusTimerSecondsLeft / 60).toString().padStart(2, '0');
    const s = (focusTimerSecondsLeft % 60).toString().padStart(2, '0');
    timerReadout.textContent = `${m}:${s}`;
  }
}

function stopFocusTimer() {
  if (focusTimerInterval) {
    clearInterval(focusTimerInterval);
    focusTimerInterval = null;
  }
  document.getElementById('timerBox').classList.add('hidden');
}

// Generic version of startFocusTimer for the "set a timer for N minutes"
// voice command, which needs an arbitrary duration and label.
function startCustomTimer(totalSeconds, label) {
  const timerBox = document.getElementById('timerBox');
  const timerLabel = document.getElementById('timerLabel');
  const timerReadout = document.getElementById('timerReadout');

  stopFocusTimer();

  focusTimerSecondsLeft = totalSeconds;
  timerLabel.textContent = label.toUpperCase();
  timerBox.classList.remove('hidden');
  updateReadout();

  focusTimerInterval = setInterval(() => {
    focusTimerSecondsLeft -= 1;
    updateReadout();
    if (focusTimerSecondsLeft <= 0) {
      stopFocusTimer();
      addLogLine(`${label} complete.`, 'system');
      showAlert(`${label} complete!`);
    }
  }, 1000);

  addLogLine(`${label} started.`, 'system');

  function updateReadout() {
    const m = Math.floor(focusTimerSecondsLeft / 60).toString().padStart(2, '0');
    const s = (focusTimerSecondsLeft % 60).toString().padStart(2, '0');
    timerReadout.textContent = `${m}:${s}`;
  }
}

/* =========================================================
   13. COMMAND SYSTEM UPGRADE
   New voice commands wired to the tabs/scanner/profile/
   dashboard added above. Pushed onto the existing `commands`
   array so they work alongside every V1 command.
   ========================================================= */
commands.push(
  {
    patterns: ['open food scanner', 'scan food', 'food scanner'],
    respond: () => { switchTab('scanner'); return 'Opening the food scanner.'; }
  },
  {
    patterns: ['what are my goals', 'tell me my goals'],
    respond: () => {
      switchTab('profile');
      if (profile.goals && profile.goals.length) {
        return `Your current goals are: ${profile.goals.join(', ')}.`;
      }
      return "You haven't set any goals yet. Open your profile to add some.";
    }
  },
  {
    patterns: ['show my profile', 'open my profile', 'open profile'],
    respond: () => { switchTab('profile'); return 'Here is your profile.'; }
  },
  {
    patterns: ['start study mode'],
    respond: () => { switchTab('dashboard'); startFocusTimer('study'); return 'Starting study mode for 25 minutes.'; }
  },
  {
    patterns: ['start workout mode'],
    respond: () => { switchTab('dashboard'); startFocusTimer('workout'); return 'Starting workout mode for 20 minutes.'; }
  },
  {
    patterns: ["today's plan", 'tell me today\u2019s plan', 'what is today\u2019s plan', "what's my plan today", 'show dashboard', 'open dashboard'],
    respond: () => {
      switchTab('dashboard');
      if (suggestions.length) return `Today's focus is: ${suggestions[0]}. You have ${suggestions.length} item${suggestions.length === 1 ? '' : 's'} on your list.`;
      return "You don't have any suggestions on today's plan yet.";
    }
  },
  {
    patterns: ['analyze food', 'analyse food', 'what is the score for'],
    respond: (transcript) => {
      switchTab('scanner');
      const lower = transcript.toLowerCase();
      const marker = lower.includes('analyze food') ? 'analyze food' : lower.includes('analyse food') ? 'analyse food' : 'what is the score for';
      const idx = lower.indexOf(marker);
      const foodName = transcript.slice(idx + marker.length).trim();
      const food = window.__charlieAnalyzeFood ? window.__charlieAnalyzeFood(foodName) : null;
      if (food) return `${food.name} scores ${food.healthScore.toFixed(1)} out of 10 for health. ${food.dailyRecommendation}`;
      return 'Tell me a food name, for example "analyze food chicken breast".';
    }
  }
);

/* =========================================================
   14. EXPANDED COMMAND LIBRARY
   A much larger set of commands so Charlie rarely has to say
   "I don't have an answer for that yet" — small talk, math and
   unit conversions, notes, timers, website shortcuts, and a
   few games. All still simple keyword matching (see
   findBestCommand above for how overlapping patterns like
   "stop" vs "stop timer" are resolved).
   ========================================================= */
const NOTES_KEY = 'charlie_notes_v1';

function loadNotes() {
  const raw = localStorage.getItem(NOTES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveNotes(list) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(list));
}

let notes = loadNotes();

commands.push(
  // --- Small talk & greetings -------------------------------------------
  {
    patterns: ['yo', 'sup', "what's up", 'whats up'],
    respond: () => "Not much, just here waiting for your next command."
  },
  {
    patterns: ['nice to meet you'],
    respond: () => `Nice to meet you too, ${getUserLabel()}.`
  },
  {
    patterns: ['good afternoon'],
    respond: () => `Good afternoon, ${getUserLabel()}.`
  },
  {
    patterns: ['see you later', 'goodbye', 'bye'],
    respond: () => `See you later, ${getUserLabel()}.`
  },
  {
    patterns: ['i love you'],
    respond: () => "That's kind of you to say — I appreciate you too."
  },
  {
    patterns: ["you're awesome", 'you are awesome', 'good job', 'well done'],
    respond: () => "Thank you, I try my best!"
  },
  {
    patterns: ['compliment me', 'say something nice'],
    respond: () => randomFrom([
      'You showed up and asked — that already puts you ahead of most days.',
      "You've got great taste in voice assistants, clearly.",
      'Your curiosity is honestly one of your best features.'
    ])
  },
  {
    patterns: ['roast me'],
    respond: () => randomFrom([
      "I'd roast you, but you're already on fire with awesomeness.",
      "Sorry, my insult module got replaced with a compliment module.",
      "The only bug I can find in you is that you're too hard on yourself."
    ])
  },

  // --- Time & date extras --------------------------------------------
  {
    patterns: ['what month is it', 'current month'],
    respond: () => `It's ${new Date().toLocaleDateString([], { month: 'long' })}.`
  },
  {
    patterns: ['what year is it', 'current year'],
    respond: () => `It's ${new Date().getFullYear()}.`
  },
  {
    patterns: ['day of the week'],
    respond: () => `Today is ${new Date().toLocaleDateString([], { weekday: 'long' })}.`
  },
  {
    patterns: ['days until new year'],
    respond: () => {
      const now = new Date();
      const newYear = new Date(now.getFullYear() + 1, 0, 1);
      const days = Math.ceil((newYear - now) / 86400000);
      return `There are ${days} days until New Year's Day.`;
    }
  },

  // --- Math & unit conversions -----------------------------------------
  {
    patterns: ['percent of', 'square root of', 'to the power of', 'squared', 'cubed'],
    respond: (transcript) => solveAdvancedMath(transcript)
  },
  {
    patterns: ['convert', 'to miles', 'to km', 'to kilometers', 'to kg', 'to pounds', 'to celsius', 'to fahrenheit'],
    respond: (transcript) => {
      const result = convertUnits(transcript);
      return result || "Try something like 'convert 5 kilometers to miles' or '20 celsius to fahrenheit'.";
    }
  },

  // --- Utility: battery, timers, repeat, speaking speed -----------------
  {
    patterns: ['battery level', 'battery status', "what's my battery", 'how much battery'],
    respond: () => {
      if (!navigator.getBattery) return "This browser doesn't expose battery information.";
      return navigator.getBattery().then((battery) => {
        const pct = Math.round(battery.level * 100);
        return `Your battery is at ${pct}%${battery.charging ? ' and charging' : ''}.`;
      });
    }
  },
  {
    patterns: ['set a timer for', 'set timer for'],
    respond: (transcript) => {
      const match = transcript.toLowerCase().match(/(\d+)\s*(minutes?|mins?|seconds?|secs?)/);
      if (!match) return "Tell me a duration, like 'set a timer for 10 minutes'.";
      const amount = parseInt(match[1], 10);
      const isSeconds = match[2].startsWith('sec');
      const unitWord = isSeconds ? 'second' : 'minute';
      const label = `${amount} ${unitWord}${amount === 1 ? '' : 's'} timer`;
      switchTab('dashboard');
      startCustomTimer(isSeconds ? amount : amount * 60, label);
      return `Timer set for ${amount} ${unitWord}${amount === 1 ? '' : 's'}.`;
    }
  },
  {
    patterns: ['stop timer', 'cancel timer'],
    respond: () => { stopFocusTimer(); return 'Timer stopped.'; }
  },
  {
    patterns: ['repeat that', 'say that again', 'what did you say'],
    respond: () => lastCharlieResponse || "I haven't said anything yet."
  },
  {
    patterns: ['speak faster', 'talk faster'],
    respond: () => {
      rateRange.value = Math.min(2, parseFloat(rateRange.value) + 0.2).toFixed(1);
      memory.rate = parseFloat(rateRange.value);
      saveMemory(memory);
      return "Okay, I'll speak a bit faster.";
    }
  },
  {
    patterns: ['speak slower', 'talk slower'],
    respond: () => {
      rateRange.value = Math.max(0.5, parseFloat(rateRange.value) - 0.2).toFixed(1);
      memory.rate = parseFloat(rateRange.value);
      saveMemory(memory);
      return "Okay, I'll slow down.";
    }
  },
  {
    patterns: ['never mind', 'nevermind', 'cancel that'],
    respond: () => 'Okay, cancelled.'
  },

  // --- Notes --------------------------------------------------------------
  {
    patterns: ['take a note', 'note that', 'add a note'],
    respond: (transcript) => {
      const text = extractAfterMarkers(transcript, ['take a note', 'note that', 'add a note']);
      if (!text) return "What would you like me to note down?";
      notes.push(text);
      saveNotes(notes);
      return `Noted: ${text}.`;
    }
  },
  {
    patterns: ['read my notes', 'what are my notes', 'show my notes'],
    respond: () => {
      if (!notes.length) return "You don't have any notes yet.";
      return `You have ${notes.length} note${notes.length === 1 ? '' : 's'}: ${notes.join('; ')}.`;
    }
  },
  {
    patterns: ['clear my notes', 'delete my notes'],
    respond: () => { notes = []; saveNotes(notes); return 'All notes cleared.'; }
  },

  // --- Reminders feed into the dashboard's suggestion list --------------
  {
    patterns: ['remind me to', 'add a reminder', 'add to my list'],
    respond: (transcript) => {
      const text = extractAfterMarkers(transcript, ['remind me to', 'add a reminder to', 'add a reminder', 'add to my list']);
      if (!text) return "What should I remind you about?";
      suggestions.push(text);
      saveSuggestions(suggestions);
      renderDashboard();
      return `Added "${text}" to today's plan.`;
    }
  },

  // --- Website shortcuts --------------------------------------------------
  {
    patterns: ['open gmail'],
    respond: () => { window.open('https://mail.google.com', '_blank'); return 'Opening Gmail.'; }
  },
  {
    patterns: ['open maps', 'open google maps'],
    respond: () => { window.open('https://maps.google.com', '_blank'); return 'Opening Maps.'; }
  },
  {
    patterns: ['open spotify'],
    respond: () => { window.open('https://open.spotify.com', '_blank'); return 'Opening Spotify.'; }
  },
  {
    patterns: ['open netflix'],
    respond: () => { window.open('https://www.netflix.com', '_blank'); return 'Opening Netflix.'; }
  },
  {
    patterns: ['open amazon'],
    respond: () => { window.open('https://www.amazon.com', '_blank'); return 'Opening Amazon.'; }
  },
  {
    patterns: ['open wikipedia'],
    respond: () => { window.open('https://www.wikipedia.org', '_blank'); return 'Opening Wikipedia.'; }
  },
  {
    patterns: ['open github'],
    respond: () => { window.open('https://github.com', '_blank'); return 'Opening GitHub.'; }
  },
  {
    patterns: ['open reddit'],
    respond: () => { window.open('https://www.reddit.com', '_blank'); return 'Opening Reddit.'; }
  },
  {
    patterns: ['open twitter', 'open x'],
    respond: () => { window.open('https://x.com', '_blank'); return 'Opening X.'; }
  },
  {
    patterns: ['open instagram'],
    respond: () => { window.open('https://www.instagram.com', '_blank'); return 'Opening Instagram.'; }
  },
  {
    patterns: ['open facebook'],
    respond: () => { window.open('https://www.facebook.com', '_blank'); return 'Opening Facebook.'; }
  },
  {
    patterns: ['open whatsapp'],
    respond: () => { window.open('https://web.whatsapp.com', '_blank'); return 'Opening WhatsApp.'; }
  },
  {
    patterns: ['open chatgpt'],
    respond: () => { window.open('https://chat.openai.com', '_blank'); return 'Opening ChatGPT.'; }
  },
  {
    patterns: ['open translate'],
    respond: () => { window.open('https://translate.google.com', '_blank'); return 'Opening Translate.'; }
  },
  {
    patterns: ['search wikipedia for'],
    respond: (transcript) => {
      const query = extractAfterMarkers(transcript, ['search wikipedia for']);
      if (!query) return 'What would you like me to look up on Wikipedia?';
      window.open(`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`, '_blank');
      return `Searching Wikipedia for ${query}.`;
    }
  },
  {
    patterns: ['search youtube for'],
    respond: (transcript) => {
      const query = extractAfterMarkers(transcript, ['search youtube for']);
      if (!query) return 'What would you like me to search for on YouTube?';
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
      return `Searching YouTube for ${query}.`;
    }
  },

  // --- Games & fun ---------------------------------------------------------
  {
    patterns: ['rock paper scissors'],
    respond: () => `I choose ${randomFrom(['rock', 'paper', 'scissors'])}!`
  },
  {
    patterns: ['magic 8 ball', 'should i', 'will i'],
    respond: () => randomFrom([
      'It is certain.', 'Without a doubt.', 'Yes, definitely.',
      'Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.',
      'My reply is no.', 'Signs point to yes.', 'Very doubtful.'
    ])
  },
  {
    patterns: ['tell me a riddle'],
    respond: () => randomFrom([
      "What has to be broken before you can use it? An egg.",
      "I'm tall when I'm young and short when I'm old. What am I? A candle.",
      "What has keys but no locks? A piano.",
      "What has a face and two hands but no arms or legs? A clock."
    ])
  },
  {
    patterns: ['tell me a scary story', 'tell me a story'],
    respond: () => randomFrom([
      "Once, a program ran perfectly on the first try. No one who saw it ever spoke of it again.",
      "The developer said 'it works on my machine' — and then the lights flickered.",
      "There was a bug so old, nobody remembered who wrote the code around it."
    ])
  },
  {
    patterns: ['would you rather'],
    respond: () => randomFrom([
      'Would you rather have unlimited coffee or unlimited sleep?',
      'Would you rather explore space or the deep ocean?',
      'Would you rather always know when someone is lying, or always get away with lying?'
    ])
  },
  {
    patterns: ['truth or dare'],
    respond: () => randomFrom([
      "Truth: what's the last thing you Googled?",
      'Dare: send a compliment to the next person you message.',
      "Truth: what's a skill you'd love to learn?"
    ])
  },
  {
    patterns: ['pick a number'],
    respond: () => `I'm thinking of ${1 + Math.floor(Math.random() * 100)}.`
  },

  // --- More personality Q&A -----------------------------------------------
  {
    patterns: ['favorite movie', 'favourite movie'],
    respond: () => "I don't watch movies, but I hear anything with a good plot twist is a crowd favorite."
  },
  {
    patterns: ['favorite song', 'favourite song', 'favorite music', 'favourite music'],
    respond: () => "I like the sound of a keyboard clicking — that's my kind of music."
  },
  {
    patterns: ['favorite animal', 'favourite animal'],
    respond: () => "I'd say the octopus — three hearts feels like overachieving."
  },
  {
    patterns: ['favorite number', 'favourite number'],
    respond: () => 'Forty-two, for obvious reasons.'
  },
  {
    patterns: ['do you sleep'],
    respond: () => "Only when you tap the core and put me to sleep."
  },
  {
    patterns: ['do you dream'],
    respond: () => "If I did, it would probably be about clean, bug-free code."
  },
  {
    patterns: ['are you real'],
    respond: () => "I'm real code running in your real browser, if that counts."
  },
  {
    patterns: ['do you have a family'],
    respond: () => "Just my creator and whatever files live next to me in this folder."
  },
  {
    patterns: ['what languages do you speak'],
    respond: () => "I speak whatever language your browser's speech engine supports — English, for now."
  },
  {
    patterns: ['can you learn'],
    respond: () => "Not on my own, but you can teach me new commands any time by editing script.js."
  },
  {
    patterns: ['are you always listening'],
    respond: () => "I only react when you say my name — I'm not sending anything anywhere either way."
  },
  {
    patterns: ['how old are you'],
    respond: () => "I was written recently, so by computer standards I'm brand new."
  },
  {
    patterns: ['where do you live'],
    respond: () => "Right here, inside this browser tab."
  },
  {
    patterns: ['what is your purpose', "what's your purpose"],
    respond: () => "To help you with quick questions, small tasks, and the odd joke."
  },

  // --- Health & motivation extras ------------------------------------------
  {
    patterns: ['give me a workout tip', 'workout tip'],
    respond: () => randomFrom([
      'Warm up for five minutes before lifting heavy — cold muscles get injured muscles.',
      'Progressive overload beats a perfect program. Small increases, every week.',
      'Rest days are part of training, not a break from it.'
    ])
  },
  {
    patterns: ['give me a diet tip', 'diet tip'],
    respond: () => randomFrom([
      'Protein at every meal keeps you fuller for longer.',
      'Drinking water before a meal can help you notice when you are actually full.',
      'Whole foods first, supplements second.'
    ])
  },
  {
    patterns: ['breathing exercise', 'help me relax'],
    respond: () => "Let's try it: breathe in for four seconds, hold for four, breathe out for four. Repeat that a few times."
  }
);

// Everything above this line — including every commands.push(...) block —
// must run before boot() so the full command set and all app state exist
// by the time Charlie greets the user.
boot();
