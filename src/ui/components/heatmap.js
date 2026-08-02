// Reusable GitHub-style calendar heatmap — built for the Study Center's
// daily-study-minutes view, written generically enough that the Fitness
// Center's habit/workout tracking can reuse this same grid rather than
// re-deriving it later.
function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function levelFor(value, max) {
  if (!value || max <= 0) return 0;
  const ratio = value / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

// valuesByDate: a Map or plain object of 'YYYY-MM-DD' -> number.
export function heatmapHTML(valuesByDate, { weeks = 12, unitLabel = 'min' } = {}) {
  const values = valuesByDate instanceof Map ? valuesByDate : new Map(Object.entries(valuesByDate));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(start.getDate() - weeks * 7 + 1);
  start.setDate(start.getDate() - start.getDay()); // back up to the preceding Sunday

  const max = Math.max(0, ...values.values());
  const days = [];
  for (const d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const key = dateKey(d);
    const value = values.get(key) || 0;
    days.push({ key, value, level: levelFor(value, max) });
  }
  // Pad the final week out to a full 7 columns so the grid stays rectangular.
  while (days.length % 7 !== 0) days.push(null);

  const columnCount = days.length / 7;
  const columnsHtml = Array.from({ length: columnCount }, (_, w) => {
    const column = days.slice(w * 7, w * 7 + 7);
    const cellsHtml = column
      .map((cell) =>
        cell
          ? `<div class="heatmap-cell heatmap-level-${cell.level}" title="${cell.key}: ${cell.value} ${unitLabel}"></div>`
          : '<div class="heatmap-cell heatmap-cell--empty"></div>',
      )
      .join('');
    return `<div class="heatmap-column">${cellsHtml}</div>`;
  }).join('');

  return `<div class="heatmap-grid">${columnsHtml}</div>`;
}
