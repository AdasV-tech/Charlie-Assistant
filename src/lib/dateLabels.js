// Shared "due in N days / overdue by N days" logic — used by both the
// Project Manager's deadlines and the Study Center's assignment due dates,
// so the two don't drift into subtly different wording or math.
export function relativeDayLabel(dateStr, { noDateLabel = 'No date' } = {}) {
  if (!dateStr) return noDateLabel;
  const due = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due - now) / 86_400_000);
  if (diffDays < 0)
    return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due in ${diffDays} days`;
}

export function isPastDue(dateStr) {
  if (!dateStr) return false;
  return new Date(`${dateStr}T00:00:00`) < new Date(new Date().toDateString());
}
