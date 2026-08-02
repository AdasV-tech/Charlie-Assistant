// Curated, fixed content that rotates once a day (deterministically, by
// day number — not random on every render) rather than anything generated.
const QUOTES = [
  'Small steps every day still get you there.',
  'The best time to start was yesterday. The next best time is now.',
  'Progress, not perfection.',
  "You don't have to see the whole staircase, just take the first step.",
  'Discipline is choosing between what you want now and what you want most.',
  'Done is better than perfect.',
  'A little progress each day adds up to big results.',
  "You don't need more time, you just need to decide.",
  'Focus on being productive instead of busy.',
  'Rest when you need to, but never quit.',
];

const CHALLENGES = [
  'Drink 8 glasses of water today.',
  'Take a 10-minute walk outside.',
  'Learn one new thing, however small.',
  'Write down three things you’re grateful for.',
  'Do a 5-minute stretch break.',
  'Tidy up one small area of your space.',
  'Message someone you haven’t spoken to in a while.',
  'Try a 25-minute focused work session, no phone.',
  'Go to bed 30 minutes earlier tonight.',
  'Cook one meal instead of ordering in.',
];

function dayNumber() {
  return Math.floor(Date.now() / 86_400_000);
}

function pickOfTheDay(list, offset = 0) {
  const index = (((dayNumber() + offset) % list.length) + list.length) % list.length;
  return list[index];
}

export function getQuoteOfTheDay() {
  return pickOfTheDay(QUOTES);
}

// Offset by 3 purely so the quote and challenge don't always rotate on the
// exact same day as each other — keeps the two widgets feeling independent.
export function getDailyChallenge() {
  return pickOfTheDay(CHALLENGES, 3);
}
