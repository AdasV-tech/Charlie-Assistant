// Real badges computed from real stored data — session counts, streaks,
// mastered flashcards, finished assignments — never a decorative unlock.
// Takes plain data rather than importing the stores directly so it stays
// pure and unit-testable (same convention as food/foodInsights.js).
import { isMastered } from './spacedRepetition.js';
import { computeDailyStreak } from '../lib/streaks.js';

export function computeStudyStreak(studySessions, today = new Date()) {
  return computeDailyStreak(
    studySessions.map((s) => s.completedAt),
    today,
  );
}

export function computeAchievements({ studySessions, flashcards, assignments }) {
  const sessionCount = studySessions.length;
  const streak = computeStudyStreak(studySessions);
  const reviewedCount = flashcards.filter((c) => c.lastReviewed).length;
  const masteredCount = flashcards.filter(isMastered).length;
  const completedAssignments = assignments.filter((a) => a.status === 'done').length;

  return [
    {
      id: 'first-session',
      title: 'First Session',
      description: 'Complete your first study session.',
      unlocked: sessionCount >= 1,
      progressText: `${Math.min(sessionCount, 1)}/1 sessions`,
    },
    {
      id: 'getting-consistent',
      title: 'Getting Consistent',
      description: 'Complete 10 study sessions.',
      unlocked: sessionCount >= 10,
      progressText: `${Math.min(sessionCount, 10)}/10 sessions`,
    },
    {
      id: 'dedicated-scholar',
      title: 'Dedicated Scholar',
      description: 'Complete 50 study sessions.',
      unlocked: sessionCount >= 50,
      progressText: `${Math.min(sessionCount, 50)}/50 sessions`,
    },
    {
      id: 'three-day-streak',
      title: '3-Day Streak',
      description: 'Study three days in a row.',
      unlocked: streak >= 3,
      progressText: `${Math.min(streak, 3)}/3 days`,
    },
    {
      id: 'seven-day-streak',
      title: '7-Day Streak',
      description: 'Study seven days in a row.',
      unlocked: streak >= 7,
      progressText: `${Math.min(streak, 7)}/7 days`,
    },
    {
      id: 'flashcard-starter',
      title: 'Flashcard Starter',
      description: 'Review flashcards 10 times.',
      unlocked: reviewedCount >= 10,
      progressText: `${Math.min(reviewedCount, 10)}/10 reviews`,
    },
    {
      id: 'flashcard-master',
      title: 'Flashcard Master',
      description: 'Get 10 flashcards to the top box.',
      unlocked: masteredCount >= 10,
      progressText: `${Math.min(masteredCount, 10)}/10 mastered`,
    },
    {
      id: 'assignment-finisher',
      title: 'Assignment Finisher',
      description: 'Complete 5 assignments.',
      unlocked: completedAssignments >= 5,
      progressText: `${Math.min(completedAssignments, 5)}/5 done`,
    },
    {
      id: 'assignment-machine',
      title: 'Assignment Machine',
      description: 'Complete 20 assignments.',
      unlocked: completedAssignments >= 20,
      progressText: `${Math.min(completedAssignments, 20)}/20 done`,
    },
  ];
}
