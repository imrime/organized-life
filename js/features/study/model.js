// @ts-check
// Study logic (pure): modules, assignments, timetable, deadlines and exams (docs/spec/rooms/study.md).

import { addDays, diffDays, weekday } from '../../core/time.js';
import { occurrences } from '../calendar/model.js';
import { isValidLink } from '../media/model.js';

/**
 * @typedef {{ id: string, name: string, code?: string, color: string, teacher?: string, term?: string, credits?: number|null,
 *   links: { id: string, label: string, url: string }[], nextActionOverride?: string, notes?: string, archived: boolean }} StudyModule
 * @typedef {{ id: string, title: string, context: string, status: string, dueDate?: string|null, dueTime?: string|null, moduleId?: string|null, grade?: string }} Assignment
 * @typedef {import('../calendar/model.js').CalendarEvent} CalendarEvent
 * @typedef {{ id: string, moduleId?: string|null, type: string, title: string, author?: string, url?: string|null, citation?: string, status: string, notes?: string }} StudyResource
 */

export const RESOURCE_TYPES = ['book', 'article', 'video', 'link', 'document', 'other'];
export const RESOURCE_ICON = /** @type {Record<string, string>} */ ({ book: '📘', article: '📄', video: '🎞️', link: '🔗', document: '📎', other: '🗒️' });

/** @param {Assignment[]} tasks */
export const assignments = (tasks) => tasks.filter((t) => t.context === 'study');

/** Open assignments of a module, earliest due first (undated last). @param {Assignment[]} tasks @param {string} moduleId */
export function openAssignments(tasks, moduleId) {
  return assignments(tasks)
    .filter((t) => t.moduleId === moduleId && t.status !== 'done')
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || (a.dueTime ?? '').localeCompare(b.dueTime ?? ''));
}

/**
 * Next action: the override text, else the earliest open assignment.
 * @param {StudyModule} module
 * @param {Assignment[]} tasks
 * @returns {{ text: string, task?: Assignment }|null}
 */
export function nextAction(module, tasks) {
  if (module.nextActionOverride?.trim()) return { text: module.nextActionOverride.trim() };
  const task = openAssignments(tasks, module.id)[0];
  return task ? { text: task.title, task } : null;
}

/**
 * Assignment sections (spec S1): Overdue · This week · Later · No date · Done.
 * @param {Assignment[]} tasks
 * @param {string} today
 */
export function assignmentSections(tasks, today) {
  const list = assignments(tasks);
  const weekEnd = addDays(today, 6);
  const open = list.filter((t) => t.status !== 'done').sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  return [
    { key: 'overdue', items: open.filter((t) => t.dueDate && t.dueDate < today) },
    { key: 'week', items: open.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd) },
    { key: 'later', items: open.filter((t) => t.dueDate && t.dueDate > weekEnd) },
    { key: 'nodate', items: open.filter((t) => !t.dueDate) },
    { key: 'done', items: list.filter((t) => t.status === 'done').sort((a, b) => (b.dueDate ?? '').localeCompare(a.dueDate ?? '')) },
  ].filter((s) => s.items.length);
}

/** Badge counts: overdue and due within 2 days. @param {Assignment[]} tasks @param {string} today */
export function dueCounts(tasks, today) {
  const open = assignments(tasks).filter((t) => t.status !== 'done' && t.dueDate);
  return {
    overdue: open.filter((t) => /** @type {string} */ (t.dueDate) < today).length,
    soon: open.filter((t) => /** @type {string} */ (t.dueDate) >= today && diffDays(today, /** @type {string} */ (t.dueDate)) <= 2).length,
  };
}

/**
 * Classes on a date, by start time.
 * @param {CalendarEvent[]} events
 * @param {string} date
 */
export function classesOn(events, date) {
  return events.filter((e) => e.kind === 'class' && occurrences(e, date, date).length).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
}

/** Weekdays (1–7) with at least one class. @param {CalendarEvent[]} events */
export function classDays(events) {
  const days = new Set();
  for (const e of events.filter((x) => x.kind === 'class')) (e.recurrence?.byWeekday?.length ? e.recurrence.byWeekday : [weekday(e.date)]).forEach((d) => days.add(d));
  return days;
}

/**
 * Deadlines: study tasks with a due date + deadline events linked to a module, upcoming first.
 * @param {Assignment[]} tasks
 * @param {CalendarEvent[]} events
 * @param {string} today
 * @returns {{ key: string, title: string, date: string, time?: string|null, moduleId?: string|null, task?: Assignment, event?: CalendarEvent }[]}
 */
export function deadlines(tasks, events, today) {
  const fromTasks = assignments(tasks)
    .filter((t) => t.dueDate && t.status !== 'done')
    .map((t) => ({ key: `t:${t.id}`, title: t.title, date: /** @type {string} */ (t.dueDate), time: t.dueTime, moduleId: t.moduleId, task: t }));
  const fromEvents = events
    .filter((e) => e.kind === 'deadline' && e.moduleId)
    .flatMap((e) => occurrences(e, addDays(today, -30), addDays(today, 365)).slice(0, 1).map((date) => ({ key: `e:${e.id}:${date}`, title: e.title, date, time: e.start, moduleId: e.moduleId, event: e })));
  return [...fromTasks, ...fromEvents].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
}

/** Upcoming exams (today onwards), soonest first. @param {CalendarEvent[]} events @param {string} today */
export function upcomingExams(events, today) {
  return events
    .filter((e) => e.kind === 'exam')
    .map((e) => ({ event: e, date: occurrences(e, today, addDays(today, 730))[0] }))
    .filter((x) => x.date)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.event.start ?? '').localeCompare(b.event.start ?? ''));
}

/** Days until a date (negative = past). @param {string} today @param {string} date */
export const daysUntil = (today, date) => diffDays(today, date);

/**
 * @param {{ name: string, links: { label: string, url: string }[] }} form
 * @returns {Record<string, string>}
 */
export function validateModule(form) {
  /** @type {Record<string, string>} */
  const errors = {};
  if (!form.name.trim()) errors.name = 'form.errors.required';
  if (form.links.some((l) => l.url.trim() && !isValidLink(l.url.trim()))) errors.links = 'media.errors.link';
  return errors;
}

/**
 * @param {{ moduleId: string, days: number[], start: string, end: string }} form
 * @returns {Record<string, string>}
 */
export function validateClass(form) {
  /** @type {Record<string, string>} */
  const errors = {};
  if (!form.moduleId) errors.moduleId = 'study.errors.module';
  if (!form.days.length) errors.days = 'study.errors.days';
  if (!form.start || !form.end || form.end <= form.start) errors.time = 'calendar.errors.endBeforeStart';
  return errors;
}

/**
 * Resource folders: active modules + General, with counts.
 * @param {StudyModule[]} modules
 * @param {StudyResource[]} resources
 * @param {{ moduleId?: string|null, context: string }[]} notes
 */
export function folders(modules, resources, notes) {
  const studyNotes = notes.filter((n) => n.context === 'study');
  const mk = (/** @type {string|null} */ id) => ({
    resources: resources.filter((r) => (r.moduleId ?? null) === id).length,
    reading: resources.filter((r) => (r.moduleId ?? null) === id && r.status === 'reading').length,
    notes: studyNotes.filter((n) => (n.moduleId ?? null) === id).length,
  });
  return [...modules.filter((m) => !m.archived).map((m) => ({ id: m.id, module: m, ...mk(m.id) })), { id: null, module: null, ...mk(null) }];
}
