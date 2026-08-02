// Shared daily/weekly/monthly range math — used by the Study Center's
// study-minute goals and the Fitness Center's workout-minute goals so both
// compute "actual vs target" the same way.
export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function rangeForPeriod(period) {
  const end = new Date(startOfToday());
  end.setDate(end.getDate() + 1);
  if (period === 'daily') return { start: startOfToday(), end };
  if (period === 'weekly') {
    const start = new Date(startOfToday());
    start.setDate(start.getDate() - 6);
    return { start, end };
  }
  const now = new Date();
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end };
}

// Sums entries[valueField] for entries whose entries[dateField] falls within [start, end).
export function sumInRange(entries, dateField, valueField, start, end) {
  return entries
    .filter((e) => {
      const t = new Date(e[dateField]);
      return t >= start && t < end;
    })
    .reduce((sum, e) => sum + (e[valueField] ?? 0), 0);
}
