// Small, dependency-free helpers shared across the app.

export function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Minimal HTML escaping for content injected via innerHTML (food results,
// history entries, etc.) — everything here already goes through this before
// hitting the DOM as markup.
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
