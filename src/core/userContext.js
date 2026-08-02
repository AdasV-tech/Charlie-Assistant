// Builds a compact, real-data summary of the user's current state, fed
// into Gemini's system prompt so open-ended answers can reference what's
// actually going on (active projects, due assignments, streaks) instead of
// staying generic. Deliberately short — a handful of honest lines, never a
// full dump of every store.
import {
  memoryStore,
  profileStore,
  projectsStore,
  assignmentsStore,
  focusSessionsStore,
  workoutsStore,
  habitsStore,
} from '../store/stores.js';
import { isPastDue } from '../lib/dateLabels.js';
import { computeStudyStreak } from '../study/achievements.js';
import { computeWorkoutStreak } from '../fitness/achievements.js';

// Pure — takes plain data so it stays unit-testable (same convention as
// study/achievements.js and fitness/achievements.js).
export function summarizeUserContext({
  userName,
  profile,
  projects,
  assignments,
  studySessions,
  workouts,
  habits,
}) {
  const lines = [];

  if (userName) lines.push(`The user's name is ${userName}.`);
  if (profile?.goals?.length) lines.push(`Their goals: ${profile.goals.join(', ')}.`);
  if (profile?.activity) lines.push(`Activity level: ${profile.activity}.`);

  const inProgress = projects.filter((p) => p.status === 'in-progress');
  if (inProgress.length) {
    lines.push(`Active projects: ${inProgress.map((p) => p.name).join(', ')}.`);
  }

  const pendingAssignments = assignments.filter((a) => a.status !== 'done');
  if (pendingAssignments.length) {
    const overdueCount = pendingAssignments.filter((a) => isPastDue(a.dueDate)).length;
    const overdueNote = overdueCount ? `, ${overdueCount} overdue` : '';
    lines.push(
      `${pendingAssignments.length} pending assignment${pendingAssignments.length === 1 ? '' : 's'}${overdueNote}.`,
    );
  }

  const studyStreak = computeStudyStreak(studySessions);
  if (studyStreak > 0) {
    lines.push(`Current study streak: ${studyStreak} day${studyStreak === 1 ? '' : 's'}.`);
  }

  const workoutStreak = computeWorkoutStreak(workouts);
  if (workoutStreak > 0) {
    lines.push(`Current workout streak: ${workoutStreak} day${workoutStreak === 1 ? '' : 's'}.`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const habitsDueToday = habits.filter((h) => !h.completions.includes(today));
  if (habitsDueToday.length) {
    lines.push(
      `Habits not yet checked off today: ${habitsDueToday.map((h) => h.name).join(', ')}.`,
    );
  }

  return lines.join(' ');
}

export function buildUserContextSummary() {
  return summarizeUserContext({
    userName: memoryStore.get().userName,
    profile: profileStore.get(),
    projects: projectsStore.get(),
    assignments: assignmentsStore.get(),
    studySessions: focusSessionsStore.get().filter((s) => s.mode === 'study'),
    workouts: workoutsStore.get(),
    habits: habitsStore.get(),
  });
}
