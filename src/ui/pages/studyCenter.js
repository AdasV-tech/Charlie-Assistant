// Study Center: subjects, assignments, flashcards with real spaced
// repetition, a subject-aware Pomodoro timer, daily/weekly/monthly goals
// measured against actual logged study minutes, achievements computed from
// that same real data, and a calendar heatmap of study activity.
import {
  subjectsStore,
  assignmentsStore,
  flashcardsStore,
  studyGoalsStore,
  focusSessionsStore,
} from '../../store/stores.js';
import { escapeHtml } from '../../lib/utils.js';
import { relativeDayLabel, isPastDue } from '../../lib/dateLabels.js';
import { rangeForPeriod, sumInRange } from '../../lib/dateRanges.js';
import { createCountdown, formatMMSS } from '../../lib/timerEngine.js';
import { heatmapHTML } from '../components/heatmap.js';
import {
  createCard,
  reviewCard,
  isDue,
  isMastered,
  MAX_BOX,
} from '../../study/spacedRepetition.js';
import { computeAchievements, computeStudyStreak } from '../../study/achievements.js';
import { addLogLine } from '../transcript.js';
import { showToast } from '../toast.js';
import { queueSpeech } from '../../core/assistant.js';
import { notify } from '../../notifications/notificationCenter.js';

const studyStatsEl = document.getElementById('studyStats');

const pomodoroSubjectSelect = document.getElementById('pomodoroSubjectSelect');
const pomodoroDurationSelect = document.getElementById('pomodoroDurationSelect');
const pomodoroBox = document.getElementById('pomodoroBox');
const pomodoroReadout = document.getElementById('pomodoroReadout');
const pomodoroLabel = document.getElementById('pomodoroLabel');
const pomodoroStartBtn = document.getElementById('pomodoroStartBtn');
const pomodoroStopBtn = document.getElementById('pomodoroStopBtn');

const subjectNameInput = document.getElementById('subjectNameInput');
const subjectColorInput = document.getElementById('subjectColorInput');
const addSubjectBtn = document.getElementById('addSubjectBtn');
const subjectChipList = document.getElementById('subjectChipList');

const assignmentForm = document.getElementById('assignmentForm');
const assignmentTitleInput = document.getElementById('assignmentTitleInput');
const assignmentSubjectSelect = document.getElementById('assignmentSubjectSelect');
const assignmentDueInput = document.getElementById('assignmentDueInput');
const assignmentPriorityInput = document.getElementById('assignmentPriorityInput');
const assignmentFilterSubject = document.getElementById('assignmentFilterSubject');
const assignmentFilterStatus = document.getElementById('assignmentFilterStatus');
const assignmentList = document.getElementById('assignmentList');

const flashcardForm = document.getElementById('flashcardForm');
const flashcardSubjectSelect = document.getElementById('flashcardSubjectSelect');
const flashcardFrontInput = document.getElementById('flashcardFrontInput');
const flashcardBackInput = document.getElementById('flashcardBackInput');
const dueCardCount = document.getElementById('dueCardCount');
const startReviewBtn = document.getElementById('startReviewBtn');
const flashcardBox = document.getElementById('flashcardBox');
const flashcardFace = document.getElementById('flashcardFace');
const flipCardBtn = document.getElementById('flipCardBtn');
const flashcardGradeActions = document.getElementById('flashcardGradeActions');
const forgotCardBtn = document.getElementById('forgotCardBtn');
const gotItCardBtn = document.getElementById('gotItCardBtn');
const flashcardList = document.getElementById('flashcardList');

const goalForm = document.getElementById('goalForm');
const goalPeriodSelect = document.getElementById('goalPeriodSelect');
const goalTargetInput = document.getElementById('goalTargetInput');
const goalList = document.getElementById('goalList');

const achievementGrid = document.getElementById('achievementGrid');
const studyHeatmap = document.getElementById('studyHeatmap');

const SUBJECT_SELECTS = [
  pomodoroSubjectSelect,
  assignmentSubjectSelect,
  flashcardSubjectSelect,
  assignmentFilterSubject,
];

/* -------------------------- Subjects -------------------------- */
function getSubjectById(id) {
  return subjectsStore.get().find((s) => s.id === id);
}

function populateSubjectSelects() {
  const subjects = subjectsStore.get();
  SUBJECT_SELECTS.forEach((select) => {
    const previousValue = select.value;
    const placeholder =
      select === assignmentFilterSubject
        ? '<option value="">All subjects</option>'
        : '<option value="">No subject</option>';
    select.innerHTML =
      placeholder +
      subjects.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    if (subjects.some((s) => s.id === previousValue)) select.value = previousValue;
  });
}

function renderSubjectChips() {
  const subjects = subjectsStore.get();
  subjectChipList.innerHTML = '';
  if (!subjects.length) {
    const empty = document.createElement('li');
    empty.className = 'subject-chip-empty';
    empty.textContent = 'No subjects yet — add one to tag assignments and flashcards.';
    subjectChipList.appendChild(empty);
    return;
  }
  subjects.forEach((subject) => {
    const li = document.createElement('li');
    li.className = 'subject-chip';
    li.innerHTML = `
      <span class="subject-chip-dot" style="background: ${subject.color};"></span>
      <span>${escapeHtml(subject.name)}</span>
      <button type="button" data-delete-subject="${subject.id}" aria-label="Delete ${escapeHtml(subject.name)}">✕</button>
    `;
    subjectChipList.appendChild(li);
  });
}

function addSubjectFromForm() {
  const name = subjectNameInput.value.trim();
  if (!name) return;
  const subject = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    color: subjectColorInput.value,
    createdAt: new Date().toISOString(),
  };
  subjectsStore.set([...subjectsStore.get(), subject]);
  subjectNameInput.value = '';
  renderStudyCenter();
}

function deleteSubject(id) {
  subjectsStore.set(subjectsStore.get().filter((s) => s.id !== id));
  renderStudyCenter();
}

/* -------------------------- Assignments -------------------------- */
function renderAssignments() {
  const subjectFilter = assignmentFilterSubject.value;
  const statusFilter = assignmentFilterStatus.value;

  let assignments = assignmentsStore.get();
  if (subjectFilter) assignments = assignments.filter((a) => a.subjectId === subjectFilter);
  if (statusFilter) assignments = assignments.filter((a) => a.status === statusFilter);

  const sorted = [...assignments].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
    return (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99');
  });

  assignmentList.innerHTML = '';
  if (!sorted.length) {
    const empty = document.createElement('li');
    empty.className = 'assignment-empty';
    empty.textContent = assignmentsStore.get().length
      ? 'No assignments match this filter.'
      : 'No assignments yet.';
    assignmentList.appendChild(empty);
    return;
  }

  sorted.forEach((assignment) => {
    const subject = getSubjectById(assignment.subjectId);
    const overdue = assignment.status !== 'done' && isPastDue(assignment.dueDate);
    const li = document.createElement('li');
    li.className = `assignment-item${assignment.status === 'done' ? ' assignment-done' : ''}`;
    li.innerHTML = `
      <label class="assignment-check">
        <input type="checkbox" data-toggle-assignment="${assignment.id}" ${assignment.status === 'done' ? 'checked' : ''} />
        <span class="assignment-title">${escapeHtml(assignment.title)}</span>
      </label>
      <div class="assignment-meta">
        <span class="priority-dot priority-${assignment.priority}" title="${assignment.priority} priority"></span>
        ${subject ? `<span class="subject-chip-dot subject-chip-dot--inline" style="background: ${subject.color};"></span><span class="assignment-subject">${escapeHtml(subject.name)}</span>` : ''}
        <span class="${overdue ? 'project-deadline overdue' : 'project-deadline'}">${escapeHtml(relativeDayLabel(assignment.dueDate, { noDateLabel: 'No due date' }))}</span>
      </div>
      <button type="button" class="assignment-delete" data-delete-assignment="${assignment.id}" aria-label="Delete ${escapeHtml(assignment.title)}">✕</button>
    `;
    assignmentList.appendChild(li);
  });
}

function addAssignmentFromForm(e) {
  e.preventDefault();
  const title = assignmentTitleInput.value.trim();
  if (!title) return;
  const assignment = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    subjectId: assignmentSubjectSelect.value || null,
    dueDate: assignmentDueInput.value || null,
    priority: assignmentPriorityInput.value,
    status: 'pending',
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  assignmentsStore.set([...assignmentsStore.get(), assignment]);
  assignmentForm.reset();
  renderStudyCenter();
}

function toggleAssignmentStatus(id) {
  assignmentsStore.set(
    assignmentsStore.get().map((a) =>
      a.id === id
        ? {
            ...a,
            status: a.status === 'done' ? 'pending' : 'done',
            completedAt: a.status === 'done' ? null : new Date().toISOString(),
          }
        : a,
    ),
  );
  renderStudyCenter();
}

function deleteAssignment(id) {
  assignmentsStore.set(assignmentsStore.get().filter((a) => a.id !== id));
  renderStudyCenter();
}

/* -------------------------- Flashcards -------------------------- */
let reviewQueue = [];
let reviewIndex = 0;
let reviewFlipped = false;

function updateDueCardCount() {
  dueCardCount.textContent = flashcardsStore.get().filter((c) => isDue(c)).length;
}

function renderFlashcards() {
  const cards = flashcardsStore.get();
  flashcardList.innerHTML = '';
  if (!cards.length) {
    const empty = document.createElement('li');
    empty.className = 'flashcard-list-empty';
    empty.textContent = 'No flashcards yet — add one above.';
    flashcardList.appendChild(empty);
    return;
  }
  cards.forEach((card) => {
    const subject = getSubjectById(card.subjectId);
    const li = document.createElement('li');
    li.className = 'flashcard-list-item';
    li.innerHTML = `
      <div class="flashcard-list-main">
        <span class="flashcard-list-front">${escapeHtml(card.front)}</span>
        ${subject ? `<span class="subject-chip-dot subject-chip-dot--inline" style="background: ${subject.color};"></span><span class="assignment-subject">${escapeHtml(subject.name)}</span>` : ''}
      </div>
      <span class="flashcard-box-label">${isMastered(card) ? 'Mastered' : `Box ${card.box}/${MAX_BOX}`}</span>
      <button type="button" data-delete-flashcard="${card.id}" aria-label="Delete card">✕</button>
    `;
    flashcardList.appendChild(li);
  });
  updateDueCardCount();
}

function addFlashcardFromForm(e) {
  e.preventDefault();
  const front = flashcardFrontInput.value.trim();
  const back = flashcardBackInput.value.trim();
  if (!front || !back) return;
  const card = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    subjectId: flashcardSubjectSelect.value || null,
    ...createCard(front, back),
  };
  flashcardsStore.set([...flashcardsStore.get(), card]);
  flashcardForm.reset();
  renderStudyCenter();
}

function deleteFlashcard(id) {
  flashcardsStore.set(flashcardsStore.get().filter((c) => c.id !== id));
  renderStudyCenter();
}

function showReviewCard() {
  if (reviewIndex >= reviewQueue.length) {
    flashcardBox.classList.add('hidden');
    showToast('Review complete!');
    reviewQueue = [];
    reviewIndex = 0;
    renderFlashcards();
    return;
  }
  reviewFlipped = false;
  flashcardGradeActions.classList.add('hidden');
  flashcardFace.textContent = reviewQueue[reviewIndex].front;
  flashcardFace.classList.remove('flashcard-face--back');
}

function startReview() {
  reviewQueue = flashcardsStore.get().filter((c) => isDue(c));
  reviewIndex = 0;
  if (!reviewQueue.length) {
    showToast('No cards are due for review right now.');
    return;
  }
  flashcardBox.classList.remove('hidden');
  showReviewCard();
}

function flipReviewCard() {
  if (reviewIndex >= reviewQueue.length) return;
  reviewFlipped = !reviewFlipped;
  flashcardFace.textContent = reviewFlipped
    ? reviewQueue[reviewIndex].back
    : reviewQueue[reviewIndex].front;
  flashcardFace.classList.toggle('flashcard-face--back', reviewFlipped);
  flashcardGradeActions.classList.toggle('hidden', !reviewFlipped);
}

function gradeReviewCard(remembered) {
  if (reviewIndex >= reviewQueue.length) return;
  const card = reviewQueue[reviewIndex];
  const updated = reviewCard(card, remembered);
  flashcardsStore.set(
    flashcardsStore.get().map((c) => (c.id === card.id ? { ...c, ...updated } : c)),
  );
  reviewIndex += 1;
  showReviewCard();
}

/* -------------------------- Goals -------------------------- */
function studyMinutesInRange(start, end) {
  const sessions = focusSessionsStore
    .get()
    .filter((s) => s.mode === 'study')
    .map((s) => ({ ...s, durationMinutes: s.durationMinutes ?? 25 }));
  return sumInRange(sessions, 'completedAt', 'durationMinutes', start, end);
}

function renderGoals() {
  const goals = studyGoalsStore.get();
  goalList.innerHTML = '';
  if (!goals.length) {
    const empty = document.createElement('li');
    empty.className = 'goal-empty';
    empty.textContent = 'No goals yet — set a daily, weekly, or monthly study target.';
    goalList.appendChild(empty);
    return;
  }
  goals.forEach((goal) => {
    const { start, end } = rangeForPeriod(goal.period);
    const actual = studyMinutesInRange(start, end);
    const pct = Math.min(100, Math.round((actual / goal.target) * 100));
    const li = document.createElement('li');
    li.className = 'goal-item';
    li.innerHTML = `
      <div class="goal-item-header">
        <span class="goal-period">${goal.period}</span>
        <span class="goal-progress-text">${actual}/${goal.target} min</span>
        <button type="button" data-delete-goal="${goal.id}" aria-label="Delete goal">✕</button>
      </div>
      <div class="project-progress-bar"><div class="project-progress-fill" style="width: ${pct}%;"></div></div>
    `;
    goalList.appendChild(li);
  });
}

function addGoalFromForm(e) {
  e.preventDefault();
  const target = parseInt(goalTargetInput.value, 10);
  if (!target || target <= 0) return;
  const goal = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    period: goalPeriodSelect.value,
    target,
    createdAt: new Date().toISOString(),
  };
  studyGoalsStore.set([...studyGoalsStore.get(), goal]);
  goalForm.reset();
  goalPeriodSelect.value = 'weekly';
  renderStudyCenter();
}

function deleteGoal(id) {
  studyGoalsStore.set(studyGoalsStore.get().filter((g) => g.id !== id));
  renderGoals();
}

/* -------------------------- Achievements + heatmap -------------------------- */
function renderAchievements() {
  const achievements = computeAchievements({
    studySessions: focusSessionsStore.get().filter((s) => s.mode === 'study'),
    flashcards: flashcardsStore.get(),
    assignments: assignmentsStore.get(),
  });
  achievementGrid.innerHTML = achievements
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

function renderHeatmap() {
  const dailyMinutes = new Map();
  focusSessionsStore
    .get()
    .filter((s) => s.mode === 'study')
    .forEach((s) => {
      const key = new Date(s.completedAt).toISOString().slice(0, 10);
      dailyMinutes.set(key, (dailyMinutes.get(key) || 0) + (s.durationMinutes ?? 25));
    });
  studyHeatmap.innerHTML = heatmapHTML(dailyMinutes, { weeks: 12, unitLabel: 'min studied' });
}

/* -------------------------- Stats -------------------------- */
function renderStats() {
  const studySessions = focusSessionsStore.get().filter((s) => s.mode === 'study');
  const streak = computeStudyStreak(studySessions);
  const mastered = flashcardsStore.get().filter(isMastered).length;
  const assignmentsDone = assignmentsStore.get().filter((a) => a.status === 'done').length;

  studyStatsEl.innerHTML = `
    <div class="project-stat"><div class="project-stat-value">${studySessions.length}</div><div class="project-stat-label">Sessions</div></div>
    <div class="project-stat"><div class="project-stat-value">${streak}</div><div class="project-stat-label">Day Streak</div></div>
    <div class="project-stat"><div class="project-stat-value">${mastered}</div><div class="project-stat-label">Cards Mastered</div></div>
    <div class="project-stat"><div class="project-stat-value">${assignmentsDone}</div><div class="project-stat-label">Assignments Done</div></div>
  `;
}

/* -------------------------- Pomodoro -------------------------- */
const pomodoroCountdown = createCountdown({
  onTick: (secondsLeft) => {
    pomodoroReadout.textContent = formatMMSS(secondsLeft);
  },
  onComplete: () => {
    const subject = getSubjectById(pomodoroSubjectSelect.value);
    const durationMinutes = parseInt(pomodoroDurationSelect.value, 10);
    focusSessionsStore.set([
      ...focusSessionsStore.get(),
      {
        mode: 'study',
        completedAt: new Date().toISOString(),
        durationMinutes,
        subjectId: subject ? subject.id : null,
      },
    ]);
    stopPomodoro();
    const subjectNote = subject ? ` on ${subject.name}` : '';
    addLogLine(`Study session complete${subjectNote}. Nice work.`, 'system');
    showToast('Study session complete!');
    notify(`Study session complete${subjectNote}. Nice work.`);
    queueSpeech(`Study session complete${subjectNote}. Nice work.`);
    renderStudyCenter();
  },
});

function startPomodoro() {
  const durationMinutes = parseInt(pomodoroDurationSelect.value, 10);
  const subject = getSubjectById(pomodoroSubjectSelect.value);
  pomodoroLabel.textContent = subject ? subject.name : 'General study';
  pomodoroBox.classList.remove('hidden');
  pomodoroStartBtn.classList.add('hidden');
  pomodoroStopBtn.classList.remove('hidden');
  pomodoroSubjectSelect.disabled = true;
  pomodoroDurationSelect.disabled = true;
  pomodoroCountdown.start(durationMinutes * 60);
  addLogLine(`Study session started — ${durationMinutes} minutes.`, 'system');
}

function stopPomodoro() {
  pomodoroCountdown.stop();
  pomodoroBox.classList.add('hidden');
  pomodoroStartBtn.classList.remove('hidden');
  pomodoroStopBtn.classList.add('hidden');
  pomodoroSubjectSelect.disabled = false;
  pomodoroDurationSelect.disabled = false;
}

/* -------------------------- Top-level render + init -------------------------- */
export function renderStudyCenter() {
  populateSubjectSelects();
  renderSubjectChips();
  renderAssignments();
  renderFlashcards();
  renderGoals();
  renderAchievements();
  renderHeatmap();
  renderStats();
}

export function initStudyCenter() {
  addSubjectBtn.addEventListener('click', addSubjectFromForm);
  subjectChipList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-delete-subject]');
    if (btn) deleteSubject(btn.dataset.deleteSubject);
  });

  assignmentForm.addEventListener('submit', addAssignmentFromForm);
  assignmentFilterSubject.addEventListener('change', renderAssignments);
  assignmentFilterStatus.addEventListener('change', renderAssignments);
  assignmentList.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('[data-delete-assignment]');
    if (deleteBtn) deleteAssignment(deleteBtn.dataset.deleteAssignment);
  });
  assignmentList.addEventListener('change', (e) => {
    const checkbox = e.target.closest('[data-toggle-assignment]');
    if (checkbox) toggleAssignmentStatus(checkbox.dataset.toggleAssignment);
  });

  flashcardForm.addEventListener('submit', addFlashcardFromForm);
  flashcardList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-delete-flashcard]');
    if (btn) deleteFlashcard(btn.dataset.deleteFlashcard);
  });
  startReviewBtn.addEventListener('click', startReview);
  flipCardBtn.addEventListener('click', flipReviewCard);
  forgotCardBtn.addEventListener('click', () => gradeReviewCard(false));
  gotItCardBtn.addEventListener('click', () => gradeReviewCard(true));

  goalForm.addEventListener('submit', addGoalFromForm);
  goalList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-delete-goal]');
    if (btn) deleteGoal(btn.dataset.deleteGoal);
  });

  pomodoroStartBtn.addEventListener('click', startPomodoro);
  pomodoroStopBtn.addEventListener('click', stopPomodoro);

  renderStudyCenter();
}
