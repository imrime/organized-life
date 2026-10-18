// @ts-check
// Tasks, projects and notes logic (pure). docs/spec/rooms/bedroom.md B5, docs/spec/04-data-model.md §3.6.

import { addDays, combine, isValidLocalDate, isValidTime } from '../../core/time.js';

/**
 * @typedef {{
 *   id: string, title: string, notes?: string, context: 'personal'|'homework'|'study', status: 'todo'|'doing'|'done',
 *   completedAt?: string|null, dueDate?: string|null, dueTime?: string|null, reminderOffsetMin: number|null,
 *   priority: 'low'|'normal'|'high', projectId?: string|null, moduleId?: string|null,
 *   checklist: { id: string, label: string, done: boolean }[], grade?: string, order: number, updatedAt?: string,
 * }} Task
 * @typedef {{ id: string, name: string, context: string, color: string, notes?: string, archived: boolean }} Project
 * @typedef {{ id: string, title: string, body: string, pinned: boolean, context: string, moduleId?: string|null, updatedAt?: string }} Note
 */

/** @param {Task} task @param {string} today */
export function dueState(task, today) {
  if (!task.dueDate) return 'none';
  if (task.dueDate < today) return 'overdue';
  if (task.dueDate === today) return 'today';
  if (task.dueDate === addDays(today, 1)) return 'tomorrow';
  return 'later';
}

const PRIORITY = { high: 0, normal: 1, low: 2 };

/** @param {Task} a @param {Task} b */
function byDue(a, b) {
  return (
    (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
    (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99') ||
    PRIORITY[a.priority] - PRIORITY[b.priority] ||
    a.order - b.order
  );
}

/**
 * Sections for the Tasks tab.
 * @param {Task[]} tasks
 * @param {string} today
 * @param {'today'|'upcoming'|'all'|'done'} filter
 * @param {string|null} context null = all contexts
 * @returns {{ key: string, items: Task[] }[]}
 */
export function taskSections(tasks, today, filter, context) {
  const scoped = tasks.filter((task) => !context || task.context === context);
  if (filter === 'done') {
    const done = scoped.filter((task) => task.status === 'done').sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
    return done.length ? [{ key: 'done', items: done }] : [];
  }
  const open = scoped.filter((task) => task.status !== 'done').sort(byDue);
  /** @type {Record<string, Task[]>} */
  const groups = { overdue: [], today: [], tomorrow: [], later: [], none: [] };
  for (const task of open) groups[dueState(task, today)].push(task);
  let keys = ['overdue', 'today', 'tomorrow', 'later', 'none'];
  if (filter === 'today') keys = ['overdue', 'today'];
  if (filter === 'upcoming') keys = ['tomorrow', 'later'];
  return keys.filter((k) => groups[k].length).map((key) => ({ key, items: groups[key] }));
}

/** Overdue + due today, not done (desk badge). @param {Task[]} tasks @param {string} today */
export function attentionCount(tasks, today) {
  let overdue = 0;
  let dueToday = 0;
  for (const task of tasks) {
    if (task.status === 'done') continue;
    const state = dueState(task, today);
    if (state === 'overdue') overdue++;
    if (state === 'today') dueToday++;
  }
  return { overdue, dueToday };
}

/**
 * @param {{ title: string, dueDate: string, dueTime: string, context: string, moduleId?: string|null }} form
 * @returns {Record<string, string>}
 */
export function validateTask(form) {
  /** @type {Record<string, string>} */
  const errors = {};
  if (!form.title.trim()) errors.title = 'form.errors.required';
  else if (form.title.length > 120) errors.title = 'form.errors.tooLong';
  if (form.dueDate && !isValidLocalDate(form.dueDate)) errors.dueDate = 'form.errors.date';
  if (form.dueTime && !form.dueDate) errors.dueTime = 'tasks.errors.timeNeedsDate';
  else if (form.dueTime && !isValidTime(form.dueTime)) errors.dueTime = 'form.errors.time';
  if (form.context === 'study' && !form.moduleId) errors.moduleId = 'study.errors.module';
  return errors;
}

/** @param {Project} project @param {Task[]} tasks */
export function projectProgress(project, tasks) {
  const own = tasks.filter((task) => task.projectId === project.id);
  const done = own.filter((task) => task.status === 'done').length;
  const next = own.filter((task) => task.status !== 'done').sort(byDue)[0] ?? null;
  return { done, total: own.length, next };
}

/** Checklist progress text input. @param {Task} task */
export function checklistProgress(task) {
  const total = task.checklist?.length ?? 0;
  return total ? { done: task.checklist.filter((c) => c.done).length, total } : null;
}

/**
 * Reminder instants for tasks with a due date and a reminder offset (no time → 09:00).
 * @param {Task[]} tasks
 * @param {Date} from
 * @param {Date} to
 */
export function taskReminders(tasks, from, to) {
  /** @type {{ task: Task, at: Date }[]} */
  const out = [];
  for (const task of tasks) {
    if (task.status === 'done' || !task.dueDate || task.reminderOffsetMin === null || task.reminderOffsetMin === undefined) continue;
    const base = combine(task.dueDate, task.dueTime || '09:00');
    const at = new Date(base.getTime() - task.reminderOffsetMin * 60_000);
    if (at >= from && at <= to) out.push({ task, at });
  }
  return out;
}

/** Notes: pinned first, then most recently edited; optional text filter. @param {Note[]} notes @param {(n: Note) => boolean} [match] */
export function sortedNotes(notes, match = () => true) {
  return notes.filter(match).sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

/** Title shown for a note: its title or the first line of the body. @param {Note} note */
export function noteTitle(note) {
  return note.title.trim() || note.body.trim().split('\n')[0].slice(0, 60);
}
