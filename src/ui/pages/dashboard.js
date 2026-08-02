// Daily greeting, focus/suggestions list, the Study/Workout focus timer,
// and the Dashboard 2.0 widgets: scores, quick actions, weather, quote and
// daily challenge, and a recent-conversations feed.
import {
  suggestionsStore,
  profileStore,
  memoryStore,
  getUserLabel,
  foodHistoryStore,
  focusSessionsStore,
  conversationStore,
  workoutsStore,
} from '../../store/stores.js';
import { addLogLine } from '../transcript.js';
import { showToast } from '../toast.js';
import { queueSpeech } from '../../core/assistant.js';
import { notify } from '../../notifications/notificationCenter.js';
import { switchTab } from '../tabs.js';
import { scoreRingHTML } from '../../lib/scoreRing.js';
import { getCurrentWeather } from '../../dashboard/weatherService.js';
import { getQuoteOfTheDay, getDailyChallenge } from '../../dashboard/dailyContent.js';
import { createCountdown, formatMMSS } from '../../lib/timerEngine.js';

const greetingTitle = document.getElementById('greetingTitle');
const greetingSub = document.getElementById('greetingSub');
const focusText = document.getElementById('focusText');
const suggestionList = document.getElementById('suggestionList');
const suggestionInput = document.getElementById('suggestionInput');
const addSuggestionBtn = document.getElementById('addSuggestionBtn');
const timerBox = document.getElementById('timerBox');
const timerLabel = document.getElementById('timerLabel');
const timerReadout = document.getElementById('timerReadout');
const productivityScoreRing = document.getElementById('productivityScoreRing');
const productivityScoreCaption = document.getElementById('productivityScoreCaption');
const healthScoreRing = document.getElementById('healthScoreRing');
const healthScoreCaption = document.getElementById('healthScoreCaption');
const quickActionsWrap = document.getElementById('quickActions');
const weatherWidget = document.getElementById('weatherWidget');
const quoteText = document.getElementById('quoteText');
const challengeText = document.getElementById('challengeText');
const recentConversationsList = document.getElementById('recentConversations');

export function renderDashboard() {
  const hour = new Date().getHours();
  let greeting = 'GOOD EVENING';
  if (hour < 12) greeting = 'GOOD MORNING';
  else if (hour < 18) greeting = 'GOOD AFTERNOON';

  const label = profileStore.get().name || memoryStore.get().userName || getUserLabel();
  greetingTitle.textContent = `${greeting}, ${label.toUpperCase()}`;
  greetingSub.textContent = 'Charlie is online. Here is what is on the plan today.';

  const suggestions = suggestionsStore.get();
  focusText.textContent = suggestions.length ? suggestions[0] : 'No focus set yet — add one below.';

  renderScores();
  renderDailyContent();
  renderRecentConversations();
  renderWeatherWidget();

  suggestionList.innerHTML = '';
  if (!suggestions.length) {
    const empty = document.createElement('li');
    empty.className = 'suggestion-empty';
    empty.textContent =
      'No suggestions yet. Add reminders like "Swimming practice" or "Health: drink more water".';
    suggestionList.appendChild(empty);
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
      const next = suggestionsStore.get();
      next.splice(index, 1);
      suggestionsStore.set(next);
      renderDashboard();
    });
    li.appendChild(span);
    li.appendChild(removeBtn);
    suggestionList.appendChild(li);
  });
}

function addSuggestion(value) {
  const suggestions = suggestionsStore.get();
  suggestions.push(value);
  suggestionsStore.set(suggestions);
}

function addSuggestionFromInput() {
  const value = suggestionInput.value.trim();
  if (!value) return;
  addSuggestion(value);
  suggestionInput.value = '';
  renderDashboard();
}

/* --------------------------------------------------------
   Scores — real numbers from real data, not decoration. Productivity
   comes from today's completed focus sessions; health from the average
   score of today's logged meals. Both show an honest "no data yet"
   caption rather than a fake number when there's nothing to compute from.
   -------------------------------------------------------- */
function isToday(isoString) {
  const d = new Date(isoString);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function renderScores() {
  const sessionsToday = focusSessionsStore.get().filter((s) => isToday(s.completedAt)).length;
  const productivity = Math.min(100, sessionsToday * 40);
  productivityScoreRing.innerHTML = scoreRingHTML(productivity, 100, { size: 76, decimals: 0 });
  productivityScoreCaption.textContent = sessionsToday
    ? `${sessionsToday} focus session${sessionsToday === 1 ? '' : 's'} today`
    : 'No focus sessions yet today';

  const mealsToday = foodHistoryStore.get().filter((m) => isToday(m.savedAt));
  if (mealsToday.length) {
    const avg = mealsToday.reduce((sum, m) => sum + m.healthScore, 0) / mealsToday.length;
    healthScoreRing.innerHTML = scoreRingHTML(Math.round(avg * 10), 100, { size: 76, decimals: 0 });
    healthScoreCaption.textContent = `${mealsToday.length} meal${mealsToday.length === 1 ? '' : 's'} logged today`;
  } else {
    healthScoreRing.innerHTML = scoreRingHTML(0, 100, { size: 76, decimals: 0 });
    healthScoreCaption.textContent = 'No meals logged today';
  }
}

/* --------------------------------------------------------
   Quick actions — static, rendered once at init.
   -------------------------------------------------------- */
const QUICK_ACTIONS = [
  { label: '📷 Scanner', action: () => switchTab('scanner') },
  { label: '📚 Study Mode', action: () => startFocusTimer('study') },
  { label: '💪 Workout Mode', action: () => startFocusTimer('workout') },
  { label: '📁 Projects', action: () => switchTab('projects') },
  { label: '🎓 Study Center', action: () => switchTab('study') },
  { label: '🏋️ Fitness Center', action: () => switchTab('fitness') },
  { label: '👤 Profile', action: () => switchTab('profile') },
];

function renderQuickActions() {
  quickActionsWrap.innerHTML = '';
  QUICK_ACTIONS.forEach((quickAction) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quick-action-btn';
    btn.textContent = quickAction.label;
    btn.addEventListener('click', quickAction.action);
    quickActionsWrap.appendChild(btn);
  });
}

/* --------------------------------------------------------
   Weather — real lookup via Geolocation + Open-Meteo (see
   dashboard/weatherService.js). Honest fallback text, no fake data, if
   location access is denied or the request fails.
   -------------------------------------------------------- */
async function renderWeatherWidget() {
  try {
    const weather = await getCurrentWeather();
    weatherWidget.innerHTML = `
      <div class="dashboard-widget-title">WEATHER</div>
      <div class="weather-main">
        <span class="weather-icon">${weather.icon}</span>
        <span class="weather-temp">${Math.round(weather.temperature)}°C</span>
      </div>
      <div class="weather-label">${weather.label}</div>
    `;
  } catch {
    weatherWidget.innerHTML = `
      <div class="dashboard-widget-title">WEATHER</div>
      <p class="dashboard-widget-status">Enable location access to see local weather here.</p>
    `;
  }
}

function renderDailyContent() {
  quoteText.textContent = `“${getQuoteOfTheDay()}”`;
  challengeText.textContent = getDailyChallenge();
}

/* --------------------------------------------------------
   Recent conversations — the last few real exchanges from the persisted
   transcript (see ui/transcript.js), not sample content.
   -------------------------------------------------------- */
function renderRecentConversations() {
  const entries = conversationStore
    .get()
    .filter((e) => e.who === 'user' || e.who === 'charlie')
    .slice(-6)
    .reverse();

  recentConversationsList.innerHTML = '';
  if (!entries.length) {
    const empty = document.createElement('li');
    empty.className = 'recent-conversation-empty';
    empty.textContent = 'No conversations yet — tap the core and say hello.';
    recentConversationsList.appendChild(empty);
    return;
  }

  entries.forEach((entry) => {
    const li = document.createElement('li');
    li.className = `recent-conversation-item who-${entry.who}`;
    const who = document.createElement('span');
    who.className = 'recent-conversation-who';
    who.textContent = entry.who === 'user' ? 'YOU' : 'CHARLIE';
    const text = document.createElement('span');
    text.textContent = entry.text;
    li.appendChild(who);
    li.appendChild(text);
    recentConversationsList.appendChild(li);
  });
}

/* --------------------------------------------------------
   Focus timer — Dashboard's own countdown display, powered by the shared
   countdown engine (lib/timerEngine.js) also used by the Study Center's
   subject-aware Pomodoro.
   -------------------------------------------------------- */
const dashboardCountdown = createCountdown({
  onTick: (secondsLeft) => {
    timerReadout.textContent = formatMMSS(secondsLeft);
  },
  onComplete: () => dashboardTimerComplete?.(),
});
let dashboardTimerComplete = null;

export function stopFocusTimer() {
  dashboardCountdown.stop();
  timerBox.classList.add('hidden');
}

function runTimer(totalSeconds, label, onComplete) {
  stopFocusTimer();
  timerLabel.textContent = label;
  timerBox.classList.remove('hidden');
  dashboardTimerComplete = () => {
    stopFocusTimer();
    onComplete();
  };
  dashboardCountdown.start(totalSeconds);
}

export function startFocusTimer(mode) {
  const durationMinutes = mode === 'study' ? 25 : 20; // simple pomodoro-style defaults
  const label = mode === 'study' ? 'STUDY MODE' : 'WORKOUT MODE';
  runTimer(durationMinutes * 60, label, () => {
    const modeLabel = mode === 'study' ? 'Study' : 'Workout';
    focusSessionsStore.set([
      ...focusSessionsStore.get(),
      { mode, completedAt: new Date().toISOString(), durationMinutes },
    ]);
    // A quick-start Workout Mode session also counts toward the Fitness
    // Center's log/streak/goals — the same 20 minutes shouldn't be invisible
    // there just because it started from the Dashboard's shortcut.
    if (mode === 'workout') {
      workoutsStore.set([
        ...workoutsStore.get(),
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: 'Workout Mode',
          type: 'cardio',
          durationMinutes,
          caloriesBurned: null,
          date: new Date().toISOString().slice(0, 10),
          notes: '',
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    addLogLine(`${modeLabel} session complete. Nice work.`, 'system');
    showToast(`${modeLabel} session complete!`);
    notify(`${modeLabel} session complete. Nice work.`);
    // Queued, not spoken directly — if the user's mid-conversation with
    // Charlie when the timer ends, this waits its turn instead of barging in.
    queueSpeech(`${modeLabel} session complete. Nice work.`);
    renderScores();
  });
  addLogLine(
    `${mode === 'study' ? 'Study' : 'Workout'} mode started — ${durationMinutes} minutes.`,
    'system',
  );
}

// Generic version for the "set a timer for N minutes" voice command, which
// needs an arbitrary duration and label. Deliberately not logged as a focus
// session — that's specifically Study/Workout Mode, not any ad hoc timer.
export function startCustomTimer(totalSeconds, label) {
  runTimer(totalSeconds, label.toUpperCase(), () => {
    addLogLine(`${label} complete.`, 'system');
    showToast(`${label} complete!`);
    notify(`${label} complete.`);
    queueSpeech(`${label} complete.`);
  });
  addLogLine(`${label} started.`, 'system');
}

export function initDashboard() {
  addSuggestionBtn.addEventListener('click', addSuggestionFromInput);
  suggestionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addSuggestionFromInput();
  });

  document.getElementById('studyModeBtn').addEventListener('click', () => startFocusTimer('study'));
  document
    .getElementById('workoutModeBtn')
    .addEventListener('click', () => startFocusTimer('workout'));
  document.getElementById('timerStopBtn').addEventListener('click', stopFocusTimer);

  renderQuickActions();
  renderDashboard();
}
