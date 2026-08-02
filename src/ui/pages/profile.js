// Name/age/activity/goals form — feeds the dashboard greeting and the
// "what are my goals" voice command.
import { profileStore, memoryStore, getUserLabel } from '../../store/stores.js';
import { addLogLine } from '../transcript.js';
import { flashState } from '../../core/assistant.js';
import { renderDashboard } from './dashboard.js';

const form = document.getElementById('profileForm');
const nameField = document.getElementById('profileName');
const ageField = document.getElementById('profileAge');
const activityField = document.getElementById('profileActivity');
const goalsField = document.getElementById('profileGoals');
const activitiesField = document.getElementById('profileActivities');
const summaryBox = document.getElementById('profileSummary');

export function renderProfileSummary() {
  const profile = profileStore.get();
  if (!profile.name && (!profile.goals || profile.goals.length === 0)) {
    summaryBox.textContent = '';
    return;
  }
  const lines = [`Hello ${profile.name || getUserLabel()}.`];
  if (profile.goals && profile.goals.length) {
    lines.push('Your current goals:');
    profile.goals.forEach((g) => lines.push(`- ${g}`));
  }
  if (profile.activity) lines.push(`Activity level: ${profile.activity}`);
  if (profile.activities) lines.push(`Favourite activities: ${profile.activities}`);
  summaryBox.textContent = lines.join('\n');
}

export function initProfile() {
  const profile = profileStore.get();

  // Pre-fill the form from whatever was saved previously.
  nameField.value = profile.name || memoryStore.get().userName || '';
  ageField.value = profile.age || '';
  activityField.value = profile.activity || '';
  goalsField.value = (profile.goals || []).join('\n');
  activitiesField.value = profile.activities || '';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const next = {
      name: nameField.value.trim(),
      age: ageField.value.trim(),
      activity: activityField.value,
      goals: goalsField.value
        .split('\n')
        .map((g) => g.trim())
        .filter(Boolean),
      activities: activitiesField.value.trim(),
    };
    profileStore.set(next);
    flashState('learning');

    // Keep the core "memory" name in sync too, so the assistant's
    // spoken greetings match the profile name.
    if (next.name) {
      memoryStore.update((m) => ({ ...m, userName: next.name }));
    }

    renderProfileSummary();
    renderDashboard(); // goals feed the daily focus box
    addLogLine('Profile saved.', 'system');
  });

  renderProfileSummary();
}
