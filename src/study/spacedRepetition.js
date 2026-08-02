// A Leitner-box scheduler — real spaced repetition, not a random shuffle.
// Five boxes, each with a longer review interval; a correct recall promotes
// a card one box, a miss drops it straight back to box 1.
const BOX_INTERVAL_DAYS = [1, 2, 4, 8, 16];
export const MAX_BOX = BOX_INTERVAL_DAYS.length;

export function createCard(front, back) {
  const now = new Date().toISOString();
  return {
    box: 1,
    lastReviewed: null,
    nextReview: now, // due immediately — a new card should show up for its first review
    front,
    back,
    createdAt: now,
  };
}

export function isDue(card, now = new Date()) {
  return new Date(card.nextReview) <= now;
}

export function reviewCard(card, remembered, now = new Date()) {
  const box = remembered ? Math.min(card.box + 1, MAX_BOX) : 1;
  const intervalDays = BOX_INTERVAL_DAYS[box - 1];
  const nextReview = new Date(now.getTime() + intervalDays * 86_400_000).toISOString();
  return { ...card, box, lastReviewed: now.toISOString(), nextReview };
}

export function isMastered(card) {
  return card.box === MAX_BOX;
}
