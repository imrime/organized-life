// @ts-check
// Task, project and note mutations.

import { appStore } from '../../core/store.js';
import { newId } from '../../core/ids.js';

/** @typedef {import('./model.js').Task} Task */

/**
 * @param {string} title
 * @param {{ context?: string, dueDate?: string|null, projectId?: string|null }} [defaults]
 */
export function quickAddTask(title, { context = 'personal', dueDate = null, projectId = null } = {}) {
  return appStore.mutate('tasks.add', (tx) =>
    tx.insert('tasks', {
      title: title.trim().slice(0, 120),
      notes: '',
      context,
      status: 'todo',
      completedAt: null,
      dueDate,
      dueTime: null,
      reminderOffsetMin: null,
      priority: 'normal',
      projectId,
      moduleId: null,
      checklist: [],
      grade: '',
      order: tx.all('tasks').length,
    }),
  );
}

/**
 * @param {Record<string, any>} form
 * @param {string|null} id
 */
export function saveTask(form, id) {
  return appStore.mutate('tasks.save', (tx) => {
    const previous = id ? tx.get('tasks', id) : undefined;
    const fields = {
      title: form.title.trim(),
      notes: form.notes,
      context: form.context,
      status: form.status,
      completedAt: form.status === 'done' ? previous?.completedAt ?? new Date().toISOString() : null,
      dueDate: form.dueDate || null,
      dueTime: form.dueDate && form.dueTime ? form.dueTime : null,
      reminderOffsetMin: form.dueDate ? form.reminderOffsetMin : null,
      priority: form.priority,
      projectId: form.projectId || null,
      checklist: form.checklist.filter((/** @type {any} */ c) => c.label.trim()).map((/** @type {any} */ c) => ({ id: c.id ?? newId(), label: c.label.trim(), done: Boolean(c.done) })),
      grade: form.grade ?? '',
    };
    return id ? tx.patch('tasks', id, fields) : tx.insert('tasks', { ...fields, moduleId: null, order: tx.all('tasks').length });
  });
}

/** @param {string} id @param {boolean} done */
export function setTaskDone(id, done) {
  return appStore.mutate('tasks.toggle', (tx) =>
    tx.patch('tasks', id, { status: done ? 'done' : 'todo', completedAt: done ? new Date().toISOString() : null }),
  );
}

/** @param {string} id @param {string} itemId */
export function toggleChecklistItem(id, itemId) {
  return appStore.mutate('tasks.checklist', (tx) => {
    const task = tx.get('tasks', id);
    if (!task) return;
    tx.patch('tasks', id, { checklist: task.checklist.map((/** @type {any} */ c) => (c.id === itemId ? { ...c, done: !c.done } : c)) });
  });
}

/** @param {string} id */
export function deleteTask(id) {
  return appStore.mutate('tasks.delete', (tx) => tx.remove('tasks', id));
}

/**
 * @param {{ name: string, color: string, notes: string, context?: string }} form
 * @param {string|null} id
 */
export function saveProject(form, id) {
  return appStore.mutate('projects.save', (tx) => {
    const fields = { name: form.name.trim(), color: form.color, notes: form.notes };
    return id ? tx.patch('projects', id, fields) : tx.insert('projects', { ...fields, context: form.context ?? 'personal', archived: false });
  });
}

/** @param {string} id @param {boolean} archived */
export function setProjectArchived(id, archived) {
  return appStore.mutate('projects.archive', (tx) => tx.patch('projects', id, { archived }));
}

/**
 * Deletes a project; its tasks are kept (unassigned) unless `withTasks`.
 * @param {string} id
 * @param {boolean} withTasks
 */
export function deleteProject(id, withTasks) {
  return appStore.mutate('projects.delete', (tx) => {
    for (const task of tx.all('tasks').filter((t) => t.projectId === id)) {
      if (withTasks) tx.remove('tasks', task.id);
      else tx.patch('tasks', task.id, { projectId: null });
    }
    tx.remove('projects', id);
  });
}

/**
 * Creates or updates a note (autosave: called while typing, debounced by the caller).
 * @param {{ title: string, body: string, pinned: boolean }} form
 * @param {string|null} id
 * @param {string} [context]
 */
export function saveNote(form, id, context = 'personal') {
  return appStore.mutate(
    'notes.save',
    (tx) => {
      const fields = { title: form.title, body: form.body, pinned: form.pinned };
      return id && tx.get('notes', id) ? tx.patch('notes', id, fields) : tx.insert('notes', { ...fields, id: id ?? undefined, context, moduleId: null });
    },
    { quiet: false },
  );
}

/** @param {string} id */
export function deleteNote(id) {
  return appStore.mutate('notes.delete', (tx) => tx.remove('notes', id));
}
