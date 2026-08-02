import { describe, it, expect } from 'vitest';
import { summarizeUserContext } from '../src/core/userContext.js';

const EMPTY = {
  userName: null,
  profile: {},
  projects: [],
  assignments: [],
  studySessions: [],
  workouts: [],
  habits: [],
};

describe('summarizeUserContext', () => {
  it('returns an empty string with no data at all', () => {
    expect(summarizeUserContext(EMPTY)).toBe('');
  });

  it('mentions the user by name', () => {
    expect(summarizeUserContext({ ...EMPTY, userName: 'Adas' })).toContain(
      "The user's name is Adas.",
    );
  });

  it('lists profile goals and activity level', () => {
    const summary = summarizeUserContext({
      ...EMPTY,
      profile: { goals: ['Learn guitar', 'Run a 5k'], activity: 'moderate' },
    });
    expect(summary).toContain('Learn guitar, Run a 5k');
    expect(summary).toContain('Activity level: moderate.');
  });

  it('lists only in-progress projects by name', () => {
    const summary = summarizeUserContext({
      ...EMPTY,
      projects: [
        { name: 'Website redesign', status: 'in-progress' },
        { name: 'Old archived thing', status: 'completed' },
      ],
    });
    expect(summary).toContain('Active projects: Website redesign.');
    expect(summary).not.toContain('Old archived thing');
  });

  it('counts pending and overdue assignments', () => {
    const summary = summarizeUserContext({
      ...EMPTY,
      assignments: [
        { status: 'pending', dueDate: '2020-01-01' },
        { status: 'pending', dueDate: '2099-01-01' },
        { status: 'done', dueDate: '2020-01-01' },
      ],
    });
    expect(summary).toContain('2 pending assignments, 1 overdue.');
  });

  it('reports study and workout streaks only when positive', () => {
    const summary = summarizeUserContext({
      ...EMPTY,
      studySessions: [{ completedAt: new Date().toISOString() }],
    });
    expect(summary).toContain('Current study streak: 1 day.');
    expect(summary).not.toContain('workout streak');
  });

  it('lists habits not yet checked off today', () => {
    const summary = summarizeUserContext({
      ...EMPTY,
      habits: [
        { name: 'Stretch', completions: [] },
        { name: 'Read', completions: [new Date().toISOString().slice(0, 10)] },
      ],
    });
    expect(summary).toContain('Habits not yet checked off today: Stretch.');
    expect(summary).not.toContain('Read.');
  });
});
