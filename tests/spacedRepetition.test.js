import { describe, it, expect } from 'vitest';
import {
  createCard,
  isDue,
  reviewCard,
  isMastered,
  MAX_BOX,
} from '../src/study/spacedRepetition.js';

describe('createCard', () => {
  it('starts in box 1 and is due immediately', () => {
    const card = createCard('front', 'back');
    expect(card.box).toBe(1);
    expect(isDue(card)).toBe(true);
  });
});

describe('reviewCard', () => {
  it('promotes a box on a correct recall', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const card = { ...createCard('q', 'a'), box: 1 };
    const reviewed = reviewCard(card, true, now);
    expect(reviewed.box).toBe(2);
    expect(reviewed.nextReview).toBe(new Date(now.getTime() + 2 * 86_400_000).toISOString());
  });

  it('drops back to box 1 on a miss regardless of current box', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const card = { ...createCard('q', 'a'), box: 4 };
    const reviewed = reviewCard(card, false, now);
    expect(reviewed.box).toBe(1);
    expect(reviewed.nextReview).toBe(new Date(now.getTime() + 1 * 86_400_000).toISOString());
  });

  it('never promotes past the max box', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const card = { ...createCard('q', 'a'), box: MAX_BOX };
    const reviewed = reviewCard(card, true, now);
    expect(reviewed.box).toBe(MAX_BOX);
  });

  it('sets lastReviewed to the review time', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const card = createCard('q', 'a');
    const reviewed = reviewCard(card, true, now);
    expect(reviewed.lastReviewed).toBe(now.toISOString());
  });
});

describe('isDue', () => {
  it('is false for a card whose nextReview is in the future', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const card = reviewCard(createCard('q', 'a'), true, now);
    expect(isDue(card, now)).toBe(false);
    expect(isDue(card, new Date('2026-01-05T00:00:00Z'))).toBe(true);
  });
});

describe('isMastered', () => {
  it('is true only at the max box', () => {
    expect(isMastered({ box: MAX_BOX })).toBe(true);
    expect(isMastered({ box: MAX_BOX - 1 })).toBe(false);
  });
});
