// Modes share one page: Assistant / Scanner / Dashboard / Projects / Profile.
// Only one .tab-panel is visible at a time, driven by data-tab on each button.
import { renderDashboard } from './pages/dashboard.js';
import { renderProfileSummary } from './pages/profile.js';
import { renderProjects } from './pages/projects.js';

export function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.tabPanel === tabName);
  });
  // Refresh each page's data whenever it's switched into view.
  if (tabName === 'dashboard') renderDashboard();
  if (tabName === 'profile') renderProfileSummary();
  if (tabName === 'projects') renderProjects();
}

export function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}
