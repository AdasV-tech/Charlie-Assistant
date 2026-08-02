// Floating, stacking, auto-dismissing notifications — replaces the old
// single-slot alert banner. Multiple calls stack independently instead of
// one overwriting another, and each dismisses itself on its own timer.
const toastStack = document.getElementById('toastStack');

const DEFAULT_DURATION_MS = 4200;
const LEAVE_TRANSITION_MS = 250;

export function showToast(message, { type = 'info', duration = DEFAULT_DURATION_MS } = {}) {
  if (!toastStack) return;

  const toast = document.createElement('div');
  toast.className = `toast${type === 'error' ? ' toast--error' : ''}`;
  toast.textContent = message;
  toastStack.appendChild(toast);

  // Two rAFs, not one: the element needs a layout with the starting
  // (invisible) styles committed before adding toast-visible, or the
  // transition can get collapsed into a no-op by the browser.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
  });

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-leaving');
    setTimeout(() => toast.remove(), LEAVE_TRANSITION_MS);
  }, duration);
}

// Matches the original showAlert(message) call shape used throughout the
// app for error-ish, attention-grabbing messages (mic denied, recognition
// errors) — kept as a named alias so call sites read clearly.
export function showAlert(message) {
  showToast(message, { type: 'error' });
}
