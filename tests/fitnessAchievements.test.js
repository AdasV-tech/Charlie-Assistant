import { describe, it, expect } from 'vitest';
import { computeWorkoutStreak, computeFitnessAchievements } from '../src/fitness/achievements.js';

function workoutOn(dateStr) {
  return { date: dateStr, name: 'Run', type: 'cardio', durationMinutes: 30 };
}

describe('computeWorkoutStreak', () => {
  it('is 0 with no workouts', () => {
    expect(computeWorkoutStreak([], new Date('2026-01-10T12:00:00Z'))).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const workouts = [workoutOn('2026-01-09'), workoutOn('2026-01-10')];
    expect(computeWorkoutStreak(workouts, new Date('2026-01-10T18:00:00Z'))).toBe(2);
  });

  it('resets once a day is skipped', () => {
    const workouts = [workoutOn('2026-01-01'), workoutOn('2026-01-10')];
    expect(computeWorkoutStreak(workouts, new Date('2026-01-10T12:00:00Z'))).toBe(1);
  });
});

describe('computeFitnessAchievements', () => {
  it('unlocks nothing with empty data', () => {
    const achievements = computeFitnessAchievements({
      workouts: [],
      habits: [],
      weightEntries: [],
    });
    expect(achievements.every((a) => !a.unlocked)).toBe(true);
  });

  it('unlocks First Workout after one logged workout', () => {
    const achievements = computeFitnessAchievements({
      workouts: [workoutOn('2026-01-01')],
      habits: [],
      weightEntries: [],
    });
    expect(achievements.find((a) => a.id === 'first-workout').unlocked).toBe(true);
    expect(achievements.find((a) => a.id === 'ten-workouts').unlocked).toBe(false);
  });

  it('unlocks Habit Builder only once total completions reach 20', () => {
    const habits = [
      { id: '1', name: 'Stretch', targetPerWeek: 7, completions: Array(12).fill('2026-01-01') },
      { id: '2', name: 'Walk', targetPerWeek: 7, completions: Array(8).fill('2026-01-01') },
    ];
    const achievements = computeFitnessAchievements({ workouts: [], habits, weightEntries: [] });
    expect(achievements.find((a) => a.id === 'habit-builder').unlocked).toBe(true);
  });

  it('unlocks Consistent Tracker only once 5 weight entries exist', () => {
    const weightEntries = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      weightKg: 70,
    }));
    const achievements = computeFitnessAchievements({ workouts: [], habits: [], weightEntries });
    expect(achievements.find((a) => a.id === 'weight-tracker').unlocked).toBe(true);
  });
});
