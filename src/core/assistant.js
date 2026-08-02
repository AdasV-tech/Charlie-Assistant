// Charlie's voice runtime: the emotional-state machine, speech synthesis,
// speech recognition, and wake-word handling. Kept as one module rather
// than split further — the barge-in/interrupt behavior below depends on a
// handful of counters (`speechToken`, `isProcessing`, `isListening`) that
// all have to stay in lock-step, so splitting this into separate
// "recognition" and "synthesis" files would mean threading that shared
// state back and forth between them for no real benefit.
//
// Ten states in total: sleeping, listening, thinking, speaking, connecting,
// searching, learning, busy, offline, and updating. Each one is a real,
// triggered condition, not decoration — see setState()'s call sites here
// and in commands/packs/*.js for exactly what causes each. "updating" has
// no web trigger today (this build has no update mechanism) but shares its
// visual definition in styles/main.css with the desktop app's own update
// flow for a consistent vocabulary across both; nothing here ever sets it.
//
// All DOM/API wiring happens inside initAssistant() rather than at module
// load time (like every other page module's init*()), so importing this
// file — e.g. from a test, or transitively through commands/registry.js —
// never requires a real document to already contain the app's markup.
import { dispatch } from '../commands/registry.js';
import { resetGeminiHistory } from '../commands/gemini.js';
import { memoryStore, getUserLabel } from '../store/stores.js';
import { addLogLine, updateLiveTranscript, clearLiveTranscript } from '../ui/transcript.js';
import { showAlert } from '../ui/toast.js';
import { setParticleState } from './particles.js';

const coreButton = document.getElementById('coreButton');
const statusLabel = document.getElementById('statusLabel');
const voiceSelect = document.getElementById('voiceSelect');
const rateRange = document.getElementById('rateRange');
const pitchRange = document.getElementById('pitchRange');
const volumeRange = document.getElementById('volumeRange');

// Exported so command packs can flash a state (searching/learning/busy)
// around whatever they're doing — it's always safely superseded moments
// later when their reply is spoken, via speak()'s own utterance.onstart.
export function setState(state) {
  document.body.setAttribute('data-state', state);
  statusLabel.textContent = state.toUpperCase();
  setParticleState(state);
}

/* ---------------------------------------------------------
   SPEECH SYNTHESIS
   --------------------------------------------------------- */
const synth = window.speechSynthesis;
let availableVoices = [];
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
  const { voiceIndex } = memoryStore.get();
  if (voiceIndex !== null && availableVoices[voiceIndex]) {
    voiceSelect.value = voiceIndex;
  }
}

// Bumped on every speak() call so a stale utterance's onend/onerror (from
// one that just got interrupted) can't clobber state for the one that
// superseded it — the classic race when barge-in cancels mid-speech.
let speechToken = 0;

function restingState() {
  if (!isAwake) return 'sleeping';
  return navigator.onLine === false ? 'offline' : 'listening';
}

export function speak(text) {
  if (!('speechSynthesis' in window)) {
    addLogLine('Speech output is not supported in this browser.', 'system');
    isProcessing = false;
    return;
  }

  // Cancel anything currently playing/queued — this is also what makes
  // barge-in work: a new speak() call always wins immediately.
  synth.cancel();
  const token = ++speechToken;

  const utterance = new SpeechSynthesisUtterance(text);
  const chosenVoice = availableVoices[voiceSelect.value];
  if (chosenVoice) utterance.voice = chosenVoice;
  utterance.rate = parseFloat(rateRange.value);
  utterance.pitch = parseFloat(pitchRange.value);
  utterance.volume = parseFloat(volumeRange.value);

  utterance.onstart = () => {
    if (token !== speechToken) return;
    setState('speaking');
    // No longer "processing" once actual audio starts — the mic can listen
    // right through the response so saying "Charlie" again interrupts it.
    isProcessing = false;
    startListening();
  };
  utterance.onend = () => {
    if (token !== speechToken) return;
    isProcessing = false;
    setState(restingState());
    if (isAwake) startListening();
    drainSpeechQueue();
  };
  utterance.onerror = () => {
    if (token !== speechToken) return;
    isProcessing = false;
    setState(restingState());
    if (isAwake) startListening();
    drainSpeechQueue();
  };

  lastCharlieResponse = text;
  addLogLine(text, 'charlie');
  synth.speak(utterance);
}

export function getLastResponse() {
  return lastCharlieResponse;
}

// Ambient announcements (a completed Study/Workout timer) that shouldn't
// barge over an active conversation the way speak() deliberately does for
// direct responses — they wait their turn instead, then play in order.
const speechQueue = [];

function drainSpeechQueue() {
  if (synth.speaking || isProcessing || speechQueue.length === 0) return;
  speak(speechQueue.shift());
}

export function queueSpeech(text) {
  if (!('speechSynthesis' in window)) return;
  if (!synth.speaking && !isProcessing) {
    speak(text);
    return;
  }
  speechQueue.push(text);
}

// For UI-driven moments with no speak() call to naturally supersede the
// flash afterward (e.g. saving the Profile form) — reverts to whatever the
// resting state should be, unless a voice command became active in the
// meantime, in which case that takes priority and this simply no-ops.
export function flashState(state, durationMs = 1200) {
  setState(state);
  setTimeout(() => {
    if (!isProcessing && !synth.speaking) setState(restingState());
  }, durationMs);
}

// Used by the "speak faster/slower" voice commands. Matches the original
// clamp values exactly; the range input's own min/max attributes provide
// the real ceiling/floor in the UI (see Phase 1 for reconciling the two).
export function speakFaster() {
  rateRange.value = Math.min(2, parseFloat(rateRange.value) + 0.2).toFixed(1);
  memoryStore.update((m) => ({ ...m, rate: parseFloat(rateRange.value) }));
}
export function speakSlower() {
  rateRange.value = Math.max(0.5, parseFloat(rateRange.value) - 0.2).toFixed(1);
  memoryStore.update((m) => ({ ...m, rate: parseFloat(rateRange.value) }));
}

/* ---------------------------------------------------------
   SPEECH RECOGNITION
   --------------------------------------------------------- */
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
let isAwake = false;
// True while a heard phrase is being handled (thinking + speaking) so the
// continuous-listening restart doesn't kick in mid-response.
let isProcessing = false;

export function wake() {
  isAwake = true;
  setState(restingState());
  addLogLine('Charlie is awake and listening. Tap the core to sleep.', 'system');
}

// Full stop, used when the user actively taps the core: drops out of
// recognition immediately rather than waiting for the natural onend.
export function sleep() {
  isAwake = false;
  isProcessing = false;
  if (recognition && isListening) {
    recognition.stop();
  }
  setState('sleeping');
  addLogLine('Charlie is sleeping.', 'system');
}

// Lazy variant used by the "go to sleep" / "power off" voice commands:
// flips the flag only, so the in-flight recognition/response cycle that's
// currently handling the phrase can finish naturally and transition itself
// via onend, rather than force-stopping recognition mid-cycle.
export function requestSleep() {
  isAwake = false;
}

export function isCharlieAwake() {
  return isAwake;
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
// only ever fully stops when the user taps the core (sleep()). Runs even
// while Charlie is talking (see utterance.onstart above) so saying
// "Charlie" again barges in and interrupts the current response.
function startListening() {
  if (!recognition || isListening || isProcessing) return;
  try {
    recognition.start();
  } catch {
    // Already starting/started — safe to ignore.
  }
}

function setUpRecognition() {
  recognition = new SpeechRecognitionAPI();
  recognition.lang = 'en-US';
  recognition.continuous = false; // one phrase per session, but we auto-restart below
  recognition.interimResults = true;

  recognition.onstart = () => {
    isListening = true;
    // Don't stomp the "speaking" visual if we're just quietly listening
    // for a barge-in while Charlie talks.
    if (!synth.speaking) setState(restingState());
  };

  recognition.onresult = (event) => {
    const result = event.results[event.results.length - 1];
    const transcript = result[0].transcript.trim();

    // The mic is always on while awake, but Charlie should only react when
    // directly addressed — ignore anything that doesn't include the wake
    // word ("Charlie" / "hey Charlie") and keep listening quietly. This
    // applies to interim results too, so background conversation never
    // shows up live on screen just because it happened to be overheard —
    // only speech actually addressed to Charlie ever gets displayed.
    if (!containsWakeWord(transcript)) {
      return;
    }

    if (!result.isFinal) {
      updateLiveTranscript(stripWakeWord(transcript) || transcript);
      return;
    }
    clearLiveTranscript();

    // Barge-in: saying the wake word while Charlie is talking cuts him off
    // immediately instead of waiting for the response to finish. Bump the
    // token first so the interrupted utterance's onend/onerror (which can
    // fire well before the new response is ready, e.g. mid Gemini fetch)
    // can't clobber the "thinking" state we're about to set below.
    if (synth.speaking) {
      speechToken++;
      synth.cancel();
    }

    addLogLine(transcript, 'user');
    setState('thinking');
    isProcessing = true;
    const command = stripWakeWord(transcript);
    // Handled immediately — no artificial delay before Charlie responds.
    if (!command) {
      speak(`Yes ${getUserLabel()}? I'm listening.`);
    } else {
      // The third argument only ever fires right before the Gemini
      // network call — see commands/registry.js — so "connecting" only
      // ever shows up for the fallback path that actually waits on it.
      dispatch(command, speak, () => setState('connecting'));
    }
  };

  recognition.onerror = (event) => {
    isListening = false;
    clearLiveTranscript(); // e.g. the user trailed off before a final result arrived
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
    if (!synth.speaking) setState(restingState());
  };

  recognition.onend = () => {
    isListening = false;
    clearLiveTranscript(); // a session ending always means "not final" for anything left live
    if (isAwake) {
      // A recognition session can time out mid-response (we run it
      // concurrently with speaking for barge-in) — don't flicker the UI
      // away from "speaking" just because that segment ended.
      if (!synth.speaking) setState(restingState());
      // Keep listening for "hey Charlie" / follow-up commands until the
      // core button is pressed — never go back to sleep just because a
      // response finished.
      startListening();
    } else {
      setState('sleeping');
    }
  };
}

export function resetMemory() {
  memoryStore.reset();
  rateRange.value = 1;
  pitchRange.value = 1;
  volumeRange.value = 1;
  resetGeminiHistory();
}

export function initAssistant() {
  setState('sleeping');

  populateVoiceList();
  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = populateVoiceList;
  }
  rateRange.value = memoryStore.get().rate;
  pitchRange.value = memoryStore.get().pitch;
  // ?? not ||: volume 0 (muted) is a legitimate saved value, unlike rate/pitch
  // which can never legitimately be 0. Also covers saved data from before
  // volume existed, where the field is simply absent.
  volumeRange.value = memoryStore.get().volume ?? 1;

  voiceSelect.addEventListener('change', () => {
    memoryStore.update((m) => ({ ...m, voiceIndex: parseInt(voiceSelect.value, 10) }));
  });
  rateRange.addEventListener('change', () => {
    memoryStore.update((m) => ({ ...m, rate: parseFloat(rateRange.value) }));
  });
  pitchRange.addEventListener('change', () => {
    memoryStore.update((m) => ({ ...m, pitch: parseFloat(pitchRange.value) }));
  });
  volumeRange.addEventListener('change', () => {
    memoryStore.update((m) => ({ ...m, volume: parseFloat(volumeRange.value) }));
  });

  if (SpeechRecognitionAPI) {
    setUpRecognition();
  } else {
    const message = 'Speech recognition is not supported in this browser. Try Chrome or Edge.';
    addLogLine(message, 'system');
    showAlert(message);
  }

  // Real, live network-status awareness — only matters visually while
  // awake and not already mid-response, so it never stomps on an active
  // thinking/speaking moment.
  window.addEventListener('offline', () => {
    if (isAwake && !isProcessing && !synth.speaking) setState('offline');
  });
  window.addEventListener('online', () => {
    if (isAwake && document.body.dataset.state === 'offline') setState('listening');
  });

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
      sleep();
      return;
    }

    wake();
    startListening();
  });
}
