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
const alertBanner  = document.getElementById('alertBanner');

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
    respond: () => {
      isAwake = false;
      return 'Going to sleep. Tap the core to wake me.';
    }
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

  // V2 systems — each is independent and safe to init in any order.
  initTabs();
  initSettingsDrawer();
  initFoodScanner();
  initProfile();
  initDashboard();
}

boot();

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
