// Real badges computed from real stored data — workout counts, streaks,
// weight-log consistency, habit follow-through — same convention as
// study/achievements.js (pure functions over plain data, unit-testable).
import { computeDailyStreak } from '../lib/streaks.js';

export function computeWorkoutStreak(workouts, today = new Date()) {
  return computeDailyStreak(
    workouts.map((w) => w.date),
    today,
  );
}

export function computeFitnessAchievements({ workouts, habits, weightEntries }) {
  const workoutCount = workouts.length;
  const streak = computeWorkoutStreak(workouts);
  const habitCompletions = habits.reduce((sum, h) => sum + h.completions.length, 0);
  const weightEntryCount = weightEntries.length;

  return [
    {
      id: 'first-workout',
      title: 'First Workout',
      description: 'Log your first workout.',
      unlocked: workoutCount >= 1,
      progressText: `${Math.min(workoutCount, 1)}/1 workouts`,
    },
    {
      id: 'ten-workouts',
      title: 'Building Momentum',
      description: 'Log 10 workouts.',
      unlocked: workoutCount >= 10,
      progressText: `${Math.min(workoutCount, 10)}/10 workouts`,
    },
    {
      id: 'fifty-workouts',
      title: 'Fitness Habit',
      description: 'Log 50 workouts.',
      unlocked: workoutCount >= 50,
      progressText: `${Math.min(workoutCount, 50)}/50 workouts`,
    },
    {
      id: 'three-day-streak',
      title: '3-Day Streak',
      description: 'Work out three days in a row.',
      unlocked: streak >= 3,
      progressText: `${Math.min(streak, 3)}/3 days`,
    },
    {
      id: 'seven-day-streak',
      title: '7-Day Streak',
      description: 'Work out seven days in a row.',
      unlocked: streak >= 7,
      progressText: `${Math.min(streak, 7)}/7 days`,
    },
    {
      id: 'habit-builder',
      title: 'Habit Builder',
      description: 'Complete habit check-ins 20 times in total.',
      unlocked: habitCompletions >= 20,
      progressText: `${Math.min(habitCompletions, 20)}/20 check-ins`,
    },
    {
      id: 'weight-tracker',
      title: 'Consistent Tracker',
      description: 'Log your weight 5 times.',
      unlocked: weightEntryCount >= 5,
      progressText: `${Math.min(weightEntryCount, 5)}/5 entries`,
    },
  ];
}
