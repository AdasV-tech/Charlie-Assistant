import { describe, it, expect } from 'vitest';
import { computeStudyStreak, computeAchievements } from '../src/study/achievements.js';

function sessionOn(dateStr) {
  return { mode: 'study', completedAt: new Date(`${dateStr}T09:00:00Z`).toISOString() };
}

describe('computeStudyStreak', () => {
  it('is 0 with no sessions', () => {
    expect(computeStudyStreak([], new Date('2026-01-10T12:00:00Z'))).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const sessions = [sessionOn('2026-01-08'), sessionOn('2026-01-09'), sessionOn('2026-01-10')];
    expect(computeStudyStreak(sessions, new Date('2026-01-10T18:00:00Z'))).toBe(3);
  });

  it('still counts the streak as alive if only yesterday has a session', () => {
    const sessions = [sessionOn('2026-01-08'), sessionOn('2026-01-09')];
    expect(computeStudyStreak(sessions, new Date('2026-01-10T06:00:00Z'))).toBe(2);
  });

  it('resets to 0 once a day is skipped', () => {
    const sessions = [sessionOn('2026-01-01'), sessionOn('2026-01-09')];
    expect(computeStudyStreak(sessions, new Date('2026-01-10T12:00:00Z'))).toBe(1);
  });
});

describe('computeAchievements', () => {
  it('unlocks nothing with empty data', () => {
    const achievements = computeAchievements({
      studySessions: [],
      flashcards: [],
      assignments: [],
    });
    expect(achievements.every((a) => !a.unlocked)).toBe(true);
  });

  it('unlocks First Session after one completed session', () => {
    const achievements = computeAchievements({
      studySessions: [sessionOn('2026-01-01')],
      flashcards: [],
      assignments: [],
    });
    const first = achievements.find((a) => a.id === 'first-session');
    expect(first.unlocked).toBe(true);
    const consistent = achievements.find((a) => a.id === 'getting-consistent');
    expect(consistent.unlocked).toBe(false);
  });

  it('unlocks Flashcard Master only once 10 cards reach the top box', () => {
    const mastered = Array.from({ length: 10 }, () => ({ box: 5 }));
    const achievements = computeAchievements({
      studySessions: [],
      flashcards: mastered,
      assignments: [],
    });
    expect(achievements.find((a) => a.id === 'flashcard-master').unlocked).toBe(true);
  });

  it('unlocks Assignment Finisher only counting done assignments', () => {
    const assignments = [
      { status: 'done' },
      { status: 'done' },
      { status: 'done' },
      { status: 'done' },
      { status: 'done' },
      { status: 'pending' },
    ];
    const achievements = computeAchievements({ studySessions: [], flashcards: [], assignments });
    expect(achievements.find((a) => a.id === 'assignment-finisher').unlocked).toBe(true);
  });
});
