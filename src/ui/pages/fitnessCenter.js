// Fitness Center: a manual workout log, habit tracking, a water tracker,
// a weight trend chart, a manual sleep log (honestly not device-synced),
// goals measured against real logged workout minutes, achievements
// computed from that same data, and a workout-activity heatmap.
import {
  workoutsStore,
  habitsStore,
  waterLogStore,
  waterGoalStore,
  weightLogStore,
  sleepLogStore,
  fitnessGoalsStore,
} from '../../store/stores.js';
import { escapeHtml } from '../../lib/utils.js';
import { rangeForPeriod, sumInRange } from '../../lib/dateRanges.js';
import { computeDailyStreak } from '../../lib/streaks.js';
import { heatmapHTML } from '../components/heatmap.js';
import { computeFitnessAchievements, computeWorkoutStreak } from '../../fitness/achievements.js';
import { addLogLine } from '../transcript.js';
import { showToast } from '../toast.js';

const fitnessStatsEl = document.getElementById('fitnessStats');

const workoutForm = document.getElementById('workoutForm');
const workoutNameInput = document.getElementById('workoutNameInput');
const workoutTypeInput = document.getElementById('workoutTypeInput');
const workoutDateInput = document.getElementById('workoutDateInput');
const workoutDurationInput = document.getElementById('workoutDurationInput');
const workoutCaloriesInput = document.getElementById('workoutCaloriesInput');
const workoutList = document.getElementById('workoutList');

const habitNameInput = document.getElementById('habitNameInput');
const habitTargetInput = document.getElementById('habitTargetInput');
const addHabitBtn = document.getElementById('addHabitBtn');
const habitList = document.getElementById('habitList');

const waterDecrementBtn = document.getElementById('waterDecrementBtn');
const waterIncrementBtn = document.getElementById('waterIncrementBtn');
const waterTodayCount = document.getElementById('waterTodayCount');
const waterGoalInput = document.getElementById('waterGoalInput');
const waterBarFill = document.getElementById('waterBarFill');

const weightForm = document.getElementById('weightForm');
const weightDateInput = document.getElementById('weightDateInput');
const weightValueInput = document.getElementById('weightValueInput');
const weightChart = document.getElementById('weightChart');
const weightSummary = document.getElementById('weightSummary');

const sleepForm = document.getElementById('sleepForm');
const sleepDateInput = document.getElementById('sleepDateInput');
const sleepHoursInput = document.getElementById('sleepHoursInput');
const sleepList = document.getElementById('sleepList');
const sleepSummary = document.getElementById('sleepSummary');

const fitnessGoalForm = document.getElementById('fitnessGoalForm');
const fitnessGoalPeriodSelect = document.getElementById('fitnessGoalPeriodSelect');
const fitnessGoalTargetInput = document.getElementById('fitnessGoalTargetInput');
const fitnessGoalList = document.getElementById('fitnessGoalList');

const fitnessAchievementGrid = document.getElementById('fitnessAchievementGrid');
const fitnessHeatmap = document.getElementById('fitnessHeatmap');

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/* -------------------------- Workouts -------------------------- */
function renderWorkouts() {
  const workouts = [...workoutsStore.get()].sort((a, b) => b.date.localeCompare(a.date));
  workoutList.innerHTML = '';
  if (!workouts.length) {
    const empty = document.createElement('li');
    empty.className = 'workout-empty';
    empty.textContent = 'No workouts logged yet.';
    workoutList.appendChild(empty);
    return;
  }
  workouts.forEach((workout) => {
    const li = document.createElement('li');
    li.className = 'workout-item';
    li.innerHTML = `
      <div class="workout-item-main">
        <span class="workout-name">${escapeHtml(workout.name)}</span>
        <span class="workout-meta">${escapeHtml(workout.type)} · ${workout.durationMinutes} min${workout.caloriesBurned ? ` · ${workout.caloriesBurned} cal` : ''} · ${escapeHtml(workout.date)}</span>
      </div>
      <button type="button" data-delete-workout="${workout.id}" aria-label="Delete workout">✕</button>
    `;
    workoutList.appendChild(li);
  });
}

function addWorkoutFromForm(e) {
  e.preventDefault();
  const name = workoutNameInput.value.trim();
  const durationMinutes = parseInt(workoutDurationInput.value, 10);
  if (!name || !durationMinutes) return;
  const workout = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    type: workoutTypeInput.value,
    durationMinutes,
    caloriesBurned: workoutCaloriesInput.value ? parseInt(workoutCaloriesInput.value, 10) : null,
    date: workoutDateInput.value || todayKey(),
    notes: '',
    createdAt: new Date().toISOString(),
  };
  workoutsStore.set([...workoutsStore.get(), workout]);
  workoutForm.reset();
  addLogLine(`Logged workout: ${name}.`, 'system');
  showToast('Workout logged!');
  renderFitnessCenter();
}

function deleteWorkout(id) {
  workoutsStore.set(workoutsStore.get().filter((w) => w.id !== id));
  renderFitnessCenter();
}

/* -------------------------- Habits -------------------------- */
function renderHabits() {
  const habits = habitsStore.get();
  habitList.innerHTML = '';
  if (!habits.length) {
    const empty = document.createElement('li');
    empty.className = 'habit-empty';
    empty.textContent = 'No habits yet — add one to start tracking.';
    habitList.appendChild(empty);
    return;
  }
  const { start, end } = rangeForPeriod('weekly');
  habits.forEach((habit) => {
    const doneToday = habit.completions.includes(todayKey());
    const completionsThisWeek = habit.completions.filter((d) => {
      const t = new Date(d);
      return t >= start && t < end;
    }).length;
    const streak = computeDailyStreak(habit.completions);
    const li = document.createElement('li');
    li.className = 'habit-item';
    li.innerHTML = `
      <div class="habit-item-main">
        <span class="habit-name">${escapeHtml(habit.name)}</span>
        <span class="habit-progress">${completionsThisWeek}/${habit.targetPerWeek} this week · ${streak} day streak</span>
      </div>
      <button type="button" class="secondary-btn habit-toggle${doneToday ? ' habit-toggle--done' : ''}" data-toggle-habit="${habit.id}">
        ${doneToday ? 'DONE TODAY' : 'MARK DONE'}
      </button>
      <button type="button" class="habit-delete" data-delete-habit="${habit.id}" aria-label="Delete habit">✕</button>
    `;
    habitList.appendChild(li);
  });
}

function addHabitFromForm() {
  const name = habitNameInput.value.trim();
  const targetPerWeek = parseInt(habitTargetInput.value, 10) || 5;
  if (!name) return;
  const habit = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    targetPerWeek,
    completions: [],
    createdAt: new Date().toISOString(),
  };
  habitsStore.set([...habitsStore.get(), habit]);
  habitNameInput.value = '';
  renderFitnessCenter();
}

function toggleHabitToday(id) {
  const today = todayKey();
  habitsStore.set(
    habitsStore.get().map((h) => {
      if (h.id !== id) return h;
      const isDone = h.completions.includes(today);
      return {
        ...h,
        completions: isDone ? h.completions.filter((d) => d !== today) : [...h.completions, today],
      };
    }),
  );
  renderFitnessCenter();
}

function deleteHabit(id) {
  habitsStore.set(habitsStore.get().filter((h) => h.id !== id));
  renderFitnessCenter();
}

/* -------------------------- Water -------------------------- */
function getTodayWaterGlasses() {
  const entry = waterLogStore.get().find((e) => e.date === todayKey());
  return entry ? entry.glasses : 0;
}

function setTodayWaterGlasses(glasses) {
  const clamped = Math.max(0, glasses);
  const today = todayKey();
  const log = waterLogStore.get();
  const existing = log.find((e) => e.date === today);
  waterLogStore.set(
    existing
      ? log.map((e) => (e.date === today ? { ...e, glasses: clamped } : e))
      : [...log, { date: today, glasses: clamped }],
  );
  renderWater();
}

function renderWater() {
  const glasses = getTodayWaterGlasses();
  const goal = waterGoalStore.get();
  waterTodayCount.textContent = glasses;
  waterGoalInput.value = goal;
  const pct = Math.min(100, Math.round((glasses / goal) * 100));
  waterBarFill.style.width = `${pct}%`;
}

/* -------------------------- Weight -------------------------- */
function renderWeight() {
  const entries = [...weightLogStore.get()].sort((a, b) => a.date.localeCompare(b.date));
  if (!entries.length) {
    weightChart.innerHTML = '<p class="fitness-empty">No weight entries yet.</p>';
    weightSummary.textContent = '';
    return;
  }
  const recent = entries.slice(-14);
  const max = Math.max(...recent.map((e) => e.weightKg));
  const min = Math.min(...recent.map((e) => e.weightKg));
  const range = max - min || 1;
  weightChart.innerHTML = `
    <div class="trend-chart">
      ${recent
        .map((e) => {
          const heightPct = 15 + ((e.weightKg - min) / range) * 85;
          return `<div class="trend-bar-wrap"><div class="trend-bar" style="height: ${heightPct}%;" title="${escapeHtml(e.date)}: ${e.weightKg} kg"></div></div>`;
        })
        .join('')}
    </div>
  `;
  const latest = entries[entries.length - 1];
  const first = entries[0];
  const change = latest.weightKg - first.weightKg;
  const changeLabel =
    change === 0
      ? 'no change'
      : `${change > 0 ? '+' : ''}${change.toFixed(1)} kg since first entry`;
  weightSummary.textContent = `Latest: ${latest.weightKg} kg on ${latest.date} (${changeLabel}).`;
}

function addWeightFromForm(e) {
  e.preventDefault();
  const weightKg = parseFloat(weightValueInput.value);
  const date = weightDateInput.value;
  if (!weightKg || !date) return;
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date,
    weightKg,
    createdAt: new Date().toISOString(),
  };
  weightLogStore.set([...weightLogStore.get(), entry]);
  weightForm.reset();
  renderWeight();
  renderFitnessStats();
}

/* -------------------------- Sleep -------------------------- */
function renderSleep() {
  const entries = [...sleepLogStore.get()].sort((a, b) => b.date.localeCompare(a.date));
  sleepList.innerHTML = '';
  if (!entries.length) {
    const empty = document.createElement('li');
    empty.className = 'sleep-empty';
    empty.textContent = 'No sleep entries yet.';
    sleepList.appendChild(empty);
    sleepSummary.textContent = '';
    return;
  }
  entries.slice(0, 7).forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'sleep-item';
    li.innerHTML = `<span>${escapeHtml(entry.date)}</span><span>${entry.hours} hrs</span>`;
    sleepList.appendChild(li);
  });
  const recentAvg =
    entries.slice(0, 7).reduce((sum, e) => sum + e.hours, 0) / Math.min(entries.length, 7);
  sleepSummary.textContent = `Average over last ${Math.min(entries.length, 7)} night${Math.min(entries.length, 7) === 1 ? '' : 's'}: ${recentAvg.toFixed(1)} hrs.`;
}

function addSleepFromForm(e) {
  e.preventDefault();
  const hours = parseFloat(sleepHoursInput.value);
  const date = sleepDateInput.value;
  if (!hours || !date) return;
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date,
    hours,
    createdAt: new Date().toISOString(),
  };
  sleepLogStore.set([...sleepLogStore.get(), entry]);
  sleepForm.reset();
  renderSleep();
}

/* -------------------------- Goals -------------------------- */
function workoutMinutesInRange(start, end) {
  return sumInRange(workoutsStore.get(), 'date', 'durationMinutes', start, end);
}

function renderFitnessGoals() {
  const goals = fitnessGoalsStore.get();
  fitnessGoalList.innerHTML = '';
  if (!goals.length) {
    const empty = document.createElement('li');
    empty.className = 'goal-empty';
    empty.textContent = 'No goals yet — set a daily, weekly, or monthly workout-minutes target.';
    fitnessGoalList.appendChild(empty);
    return;
  }
  goals.forEach((goal) => {
    const { start, end } = rangeForPeriod(goal.period);
    const actual = workoutMinutesInRange(start, end);
    const pct = Math.min(100, Math.round((actual / goal.target) * 100));
    const li = document.createElement('li');
    li.className = 'goal-item';
    li.innerHTML = `
      <div class="goal-item-header">
        <span class="goal-period">${goal.period}</span>
        <span class="goal-progress-text">${actual}/${goal.target} min</span>
        <button type="button" data-delete-fitness-goal="${goal.id}" aria-label="Delete goal">✕</button>
      </div>
      <div class="project-progress-bar"><div class="project-progress-fill" style="width: ${pct}%;"></div></div>
    `;
    fitnessGoalList.appendChild(li);
  });
}

function addFitnessGoalFromForm(e) {
  e.preventDefault();
  const target = parseInt(fitnessGoalTargetInput.value, 10);
  if (!target || target <= 0) return;
  const goal = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    period: fitnessGoalPeriodSelect.value,
    target,
    createdAt: new Date().toISOString(),
  };
  fitnessGoalsStore.set([...fitnessGoalsStore.get(), goal]);
  fitnessGoalForm.reset();
  fitnessGoalPeriodSelect.value = 'weekly';
  renderFitnessGoals();
}

function deleteFitnessGoal(id) {
  fitnessGoalsStore.set(fitnessGoalsStore.get().filter((g) => g.id !== id));
  renderFitnessGoals();
}

/* -------------------------- Achievements + heatmap -------------------------- */
function renderFitnessAchievements() {
  const achievements = computeFitnessAchievements({
    workouts: workoutsStore.get(),
    habits: habitsStore.get(),
    weightEntries: weightLogStore.get(),
  });
  fitnessAchievementGrid.innerHTML = achievements
    .map(
      (a) => `
        <div class="achievement-card${a.unlocked ? ' achievement-unlocked' : ''}">
          <div class="achievement-title">${escapeHtml(a.title)}</div>
          <div class="achievement-desc">${escapeHtml(a.description)}</div>
          <div class="achievement-progress">${escapeHtml(a.progressText)}</div>
        </div>
      `,
    )
    .join('');
}

function renderFitnessHeatmap() {
  const dailyMinutes = new Map();
  workoutsStore.get().forEach((w) => {
    dailyMinutes.set(w.date, (dailyMinutes.get(w.date) || 0) + w.durationMinutes);
  });
  fitnessHeatmap.innerHTML = heatmapHTML(dailyMinutes, { weeks: 12, unitLabel: 'min worked out' });
}

/* -------------------------- Stats -------------------------- */
function renderFitnessStats() {
  const workouts = workoutsStore.get();
  const streak = computeWorkoutStreak(workouts);
  const habits = habitsStore.get();
  const weightEntries = weightLogStore.get();

  fitnessStatsEl.innerHTML = `
    <div class="project-stat"><div class="project-stat-value">${workouts.length}</div><div class="project-stat-label">Workouts</div></div>
    <div class="project-stat"><div class="project-stat-value">${streak}</div><div class="project-stat-label">Day Streak</div></div>
    <div class="project-stat"><div class="project-stat-value">${habits.length}</div><div class="project-stat-label">Habits</div></div>
    <div class="project-stat"><div class="project-stat-value">${weightEntries.length}</div><div class="project-stat-label">Weigh-ins</div></div>
  `;
}

/* -------------------------- Top-level render + init -------------------------- */
export function renderFitnessCenter() {
  renderWorkouts();
  renderHabits();
  renderWater();
  renderWeight();
  renderSleep();
  renderFitnessGoals();
  renderFitnessAchievements();
  renderFitnessHeatmap();
  renderFitnessStats();
}

export function initFitnessCenter() {
  workoutForm.addEventListener('submit', addWorkoutFromForm);
  workoutList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-delete-workout]');
    if (btn) deleteWorkout(btn.dataset.deleteWorkout);
  });

  addHabitBtn.addEventListener('click', addHabitFromForm);
  habitList.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('[data-toggle-habit]');
    if (toggleBtn) toggleHabitToday(toggleBtn.dataset.toggleHabit);
    const deleteBtn = e.target.closest('[data-delete-habit]');
    if (deleteBtn) deleteHabit(deleteBtn.dataset.deleteHabit);
  });

  waterIncrementBtn.addEventListener('click', () =>
    setTodayWaterGlasses(getTodayWaterGlasses() + 1),
  );
  waterDecrementBtn.addEventListener('click', () =>
    setTodayWaterGlasses(getTodayWaterGlasses() - 1),
  );
  waterGoalInput.addEventListener('change', () => {
    const goal = parseInt(waterGoalInput.value, 10) || 8;
    waterGoalStore.set(goal);
    renderWater();
  });

  weightForm.addEventListener('submit', addWeightFromForm);
  sleepForm.addEventListener('submit', addSleepFromForm);

  fitnessGoalForm.addEventListener('submit', addFitnessGoalFromForm);
  fitnessGoalList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-delete-fitness-goal]');
    if (btn) deleteFitnessGoal(btn.dataset.deleteFitnessGoal);
  });

  renderFitnessCenter();
}
