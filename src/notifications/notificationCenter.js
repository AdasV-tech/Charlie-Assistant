// In-app notification feed (the bell icon) plus gated browser Notification
// API integration. notify() is the one real entry point everything else
// calls — see ui/pages/dashboard.js's timer completions for the current
// trigger; more phases will call this as they add their own real events.
import { createStore } from '../store/createStore.js';

function arrayDeserialize(raw) {
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

const NOTIFICATION_LIMIT = 50;

export const notificationsStore = createStore('charlie_notifications_v1', [], {
  deserialize: arrayDeserialize,
});
export const notificationsEnabledStore = createStore('charlie_notifications_enabled_v1', false);

const notificationsBtn = document.getElementById('notificationsBtn');
const notificationBadge = document.getElementById('notificationBadge');
const notificationPanelOverlay = document.getElementById('notificationPanelOverlay');
const notificationList = document.getElementById('notificationList');
const clearNotificationsBtn = document.getElementById('clearNotificationsBtn');
const notificationsToggle = document.getElementById('notificationsToggle');

function renderBadge() {
  const unread = notificationsStore.get().filter((n) => !n.read).length;
  notificationBadge.textContent = unread > 9 ? '9+' : String(unread);
  notificationBadge.classList.toggle('hidden', unread === 0);
}

function renderList() {
  const items = notificationsStore.get();
  notificationList.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'notification-empty';
    empty.textContent = 'Nothing yet — Charlie will let you know when something finishes.';
    notificationList.appendChild(empty);
    return;
  }

  items.forEach((entry) => {
    const li = document.createElement('li');
    li.className = entry.read ? '' : 'unread';

    const text = document.createElement('span');
    text.textContent = entry.message;

    const time = document.createElement('span');
    time.className = 'notification-time';
    time.textContent = new Date(entry.at).toLocaleString();

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '✕';
    removeBtn.setAttribute('aria-label', 'Dismiss notification');
    removeBtn.addEventListener('click', () => {
      notificationsStore.set(notificationsStore.get().filter((n) => n.id !== entry.id));
      renderList();
      renderBadge();
    });

    li.appendChild(text);
    li.appendChild(time);
    li.appendChild(removeBtn);
    notificationList.appendChild(li);
  });
}

// The one real entry point for creating a notification — adds it to the
// persisted feed, and additionally fires a real browser Notification when
// the user has opted in, permission is actually granted, and the tab isn't
// currently visible (no point interrupting someone already looking at it).
export function notify(message) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    message,
    at: new Date().toISOString(),
    read: false,
  };
  notificationsStore.set([entry, ...notificationsStore.get()].slice(0, NOTIFICATION_LIMIT));
  renderBadge();
  if (!notificationPanelOverlay.classList.contains('hidden')) renderList();

  const canUseBrowserNotifications =
    notificationsEnabledStore.get() &&
    document.hidden &&
    'Notification' in window &&
    Notification.permission === 'granted';
  if (canUseBrowserNotifications) {
    new Notification('Charlie', { body: message });
  }
}

function openPanel() {
  renderList();
  notificationsStore.update((list) => list.map((n) => ({ ...n, read: true })));
  renderBadge();
  notificationPanelOverlay.classList.remove('hidden');
}

export function initNotificationCenter() {
  renderBadge();

  notificationsBtn.addEventListener('click', openPanel);
  notificationPanelOverlay.addEventListener('click', (e) => {
    if (e.target === notificationPanelOverlay) notificationPanelOverlay.classList.add('hidden');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !notificationPanelOverlay.classList.contains('hidden')) {
      notificationPanelOverlay.classList.add('hidden');
    }
  });
  clearNotificationsBtn.addEventListener('click', () => {
    notificationsStore.set([]);
    renderList();
    renderBadge();
  });

  notificationsToggle.checked = notificationsEnabledStore.get();
  notificationsToggle.addEventListener('change', async () => {
    if (!notificationsToggle.checked) {
      notificationsEnabledStore.set(false);
      return;
    }
    if ('Notification' in window && Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        notificationsToggle.checked = false;
        return;
      }
    }
    notificationsEnabledStore.set(true);
  });
}
