// Project Manager: full CRUD over a persisted project list — progress,
// status, priority, tags, categories, deadlines, notes, and a local
// "attachment reference" (a file path or link the user types in, honestly
// not an actual upload — this is a client-only app with nowhere to host
// one) — plus search, filter, sort, and real statistics.
import { projectsStore } from '../../store/stores.js';
import { escapeHtml } from '../../lib/utils.js';
import { addLogLine } from '../transcript.js';
import { showToast } from '../toast.js';
import { flashState } from '../../core/assistant.js';

const projectStats = document.getElementById('projectStats');
const newProjectBtn = document.getElementById('newProjectBtn');
const projectForm = document.getElementById('projectForm');
const editingIdInput = document.getElementById('projectEditingId');
const nameInput = document.getElementById('projectNameInput');
const descInput = document.getElementById('projectDescInput');
const statusInput = document.getElementById('projectStatusInput');
const priorityInput = document.getElementById('projectPriorityInput');
const categoryInput = document.getElementById('projectCategoryInput');
const deadlineInput = document.getElementById('projectDeadlineInput');
const tagsInput = document.getElementById('projectTagsInput');
const progressInput = document.getElementById('projectProgressInput');
const progressValue = document.getElementById('projectProgressValue');
const notesInput = document.getElementById('projectNotesInput');
const attachmentInput = document.getElementById('projectAttachmentInput');
const addAttachmentBtn = document.getElementById('addAttachmentBtn');
const attachmentList = document.getElementById('attachmentList');
const cancelProjectBtn = document.getElementById('cancelProjectBtn');
const searchInput = document.getElementById('projectSearchInput');
const filterStatusInput = document.getElementById('projectFilterStatus');
const sortBySelect = document.getElementById('projectSortBy');
const projectList = document.getElementById('projectList');

const STATUS_LABELS = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'on-hold': 'On Hold',
  completed: 'Completed',
};
const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };

let pendingAttachments = [];

function deadlineLabel(deadline) {
  if (!deadline) return 'No deadline';
  const due = new Date(`${deadline}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due - now) / 86_400_000);
  if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due in ${diffDays} days`;
}

function isOverdue(project) {
  if (!project.deadline || project.status === 'completed') return false;
  return new Date(`${project.deadline}T00:00:00`) < new Date(new Date().toDateString());
}

/* -------------------------- Statistics -------------------------- */
function renderStats() {
  const projects = projectsStore.get();
  const total = projects.length;
  const completed = projects.filter((p) => p.status === 'completed').length;
  const inProgress = projects.filter((p) => p.status === 'in-progress').length;
  const overdue = projects.filter(isOverdue).length;
  const avgProgress = total ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / total) : 0;

  projectStats.innerHTML = `
    <div class="project-stat"><div class="project-stat-value">${total}</div><div class="project-stat-label">Total</div></div>
    <div class="project-stat"><div class="project-stat-value">${inProgress}</div><div class="project-stat-label">In Progress</div></div>
    <div class="project-stat"><div class="project-stat-value">${completed}</div><div class="project-stat-label">Completed</div></div>
    <div class="project-stat${overdue ? ' project-stat--warning' : ''}"><div class="project-stat-value">${overdue}</div><div class="project-stat-label">Overdue</div></div>
    <div class="project-stat"><div class="project-stat-value">${avgProgress}%</div><div class="project-stat-label">Avg. Progress</div></div>
  `;
}

/* -------------------------- Form -------------------------- */
function renderAttachmentList() {
  attachmentList.innerHTML = '';
  pendingAttachments.forEach((ref, index) => {
    const li = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = ref;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '✕';
    removeBtn.setAttribute('aria-label', `Remove ${ref}`);
    removeBtn.addEventListener('click', () => {
      pendingAttachments.splice(index, 1);
      renderAttachmentList();
    });
    li.appendChild(text);
    li.appendChild(removeBtn);
    attachmentList.appendChild(li);
  });
}

function openForm(project = null) {
  editingIdInput.value = project ? project.id : '';
  nameInput.value = project ? project.name : '';
  descInput.value = project ? project.description : '';
  statusInput.value = project ? project.status : 'not-started';
  priorityInput.value = project ? project.priority : 'medium';
  categoryInput.value = project ? project.category : '';
  deadlineInput.value = project ? project.deadline || '' : '';
  tagsInput.value = project ? project.tags.join(', ') : '';
  progressInput.value = project ? project.progress : 0;
  progressValue.textContent = `${progressInput.value}%`;
  notesInput.value = project ? project.notes : '';
  pendingAttachments = project ? [...project.attachments] : [];
  renderAttachmentList();

  projectForm.classList.remove('hidden');
  newProjectBtn.classList.add('hidden');
  nameInput.focus();
}

function closeForm() {
  projectForm.classList.add('hidden');
  newProjectBtn.classList.remove('hidden');
  projectForm.reset();
  pendingAttachments = [];
}

function saveProjectFromForm(e) {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;

  const now = new Date().toISOString();
  const editingId = editingIdInput.value;
  const projects = projectsStore.get();

  const fields = {
    name,
    description: descInput.value.trim(),
    status: statusInput.value,
    priority: priorityInput.value,
    category: categoryInput.value.trim(),
    deadline: deadlineInput.value || null,
    tags: tagsInput.value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    progress: parseInt(progressInput.value, 10),
    notes: notesInput.value.trim(),
    attachments: [...pendingAttachments],
    updatedAt: now,
  };

  if (editingId) {
    projectsStore.set(projects.map((p) => (p.id === editingId ? { ...p, ...fields } : p)));
    addLogLine(`Updated project "${name}".`, 'system');
  } else {
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: now, ...fields };
    projectsStore.set([entry, ...projects]);
    flashState('busy');
    addLogLine(`Created project "${name}".`, 'system');
    showToast(`Project "${name}" created.`);
  }

  closeForm();
  renderProjects();
}

function deleteProject(id) {
  projectsStore.set(projectsStore.get().filter((p) => p.id !== id));
  renderProjects();
}

/* -------------------------- List: search, filter, sort -------------------------- */
function getVisibleProjects() {
  const query = searchInput.value.trim().toLowerCase();
  const statusFilter = filterStatusInput.value;
  const sortBy = sortBySelect.value;

  let projects = projectsStore.get();

  if (statusFilter) projects = projects.filter((p) => p.status === statusFilter);
  if (query) {
    projects = projects.filter((p) =>
      `${p.name} ${p.description} ${p.category} ${p.tags.join(' ')}`.toLowerCase().includes(query),
    );
  }

  const sorted = [...projects];
  switch (sortBy) {
    case 'deadline':
      sorted.sort((a, b) => (a.deadline || '9999-99-99').localeCompare(b.deadline || '9999-99-99'));
      break;
    case 'priority':
      sorted.sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
      break;
    case 'progress':
      sorted.sort((a, b) => b.progress - a.progress);
      break;
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      sorted.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }
  return sorted;
}

function renderProjectList() {
  const projects = getVisibleProjects();
  projectList.innerHTML = '';

  if (!projects.length) {
    const empty = document.createElement('li');
    empty.className = 'project-empty';
    empty.textContent = projectsStore.get().length
      ? 'No projects match your search/filter.'
      : 'No projects yet — tap "+ New Project" to add one.';
    projectList.appendChild(empty);
    return;
  }

  projects.forEach((project) => {
    const li = document.createElement('li');
    li.className = 'project-card';

    const overdue = isOverdue(project);
    li.innerHTML = `
      <div class="project-card-header">
        <span class="priority-dot priority-${project.priority}" title="${project.priority} priority"></span>
        <span class="project-card-name">${escapeHtml(project.name)}</span>
        <span class="status-badge status-${project.status}">${STATUS_LABELS[project.status]}</span>
      </div>
      ${project.description ? `<p class="project-card-desc">${escapeHtml(project.description)}</p>` : ''}
      <div class="project-progress-bar"><div class="project-progress-fill" style="width: ${project.progress}%;"></div></div>
      <div class="project-card-meta">
        <span class="${overdue ? 'project-deadline overdue' : 'project-deadline'}">${escapeHtml(deadlineLabel(project.deadline))}</span>
        ${project.category ? `<span class="project-category">${escapeHtml(project.category)}</span>` : ''}
      </div>
      ${
        project.tags.length
          ? `<div class="project-tags">${project.tags.map((t) => `<span class="nutrient-tag">#${escapeHtml(t)}</span>`).join('')}</div>`
          : ''
      }
      <div class="project-card-actions">
        <button type="button" class="secondary-btn" data-edit-project="${project.id}">EDIT</button>
        <button type="button" class="secondary-btn" data-delete-project="${project.id}">DELETE</button>
      </div>
    `;
    projectList.appendChild(li);
  });
}

export function renderProjects() {
  renderStats();
  renderProjectList();
}

export function initProjects() {
  newProjectBtn.addEventListener('click', () => openForm());
  cancelProjectBtn.addEventListener('click', closeForm);
  projectForm.addEventListener('submit', saveProjectFromForm);

  progressInput.addEventListener('input', () => {
    progressValue.textContent = `${progressInput.value}%`;
  });

  addAttachmentBtn.addEventListener('click', () => {
    const ref = attachmentInput.value.trim();
    if (!ref) return;
    pendingAttachments.push(ref);
    attachmentInput.value = '';
    renderAttachmentList();
  });

  // Event delegation — cards are fully re-rendered on every change, so
  // listen once on the stable container rather than per-card.
  projectList.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit-project]');
    if (editBtn) {
      const project = projectsStore.get().find((p) => p.id === editBtn.dataset.editProject);
      if (project) openForm(project);
      return;
    }
    const deleteBtn = e.target.closest('[data-delete-project]');
    if (deleteBtn) deleteProject(deleteBtn.dataset.deleteProject);
  });

  searchInput.addEventListener('input', renderProjectList);
  filterStatusInput.addEventListener('change', renderProjectList);
  sortBySelect.addEventListener('change', renderProjectList);

  renderProjects();
}
