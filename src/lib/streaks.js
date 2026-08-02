// Shared "consecutive days" streak math — used by the Study Center's study
// streak and the Fitness Center's workout streak, so both count consecutive
// days the same way (including the "still alive if only yesterday counts"
// rule, so a streak doesn't reset every morning before today's entry lands).
function dateKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

// dateStrings: any array of date-like values (ISO timestamps or 'YYYY-MM-DD').
export function computeDailyStreak(dateStrings, today = new Date()) {
  const days = new Set(dateStrings.map(dateKey));
  let streak = 0;
  const cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(dateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
