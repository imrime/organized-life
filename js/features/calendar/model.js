// @ts-check
// Calendar logic (pure): recurrence expansion, agenda, month grid, validation, reminders.
// docs/spec/rooms/bedroom.md B2, docs/spec/04-data-model.md §2–3.3.

import { addDays, addMonths, combine, diffDays, isValidLocalDate, isValidTime, parseTime, startOfWeek, weekday } from '../../core/time.js';

/**
 * @typedef {{ freq: 'daily'|'weekly'|'monthly'|'yearly', interval: number, byWeekday?: number[], until?: string|null, exDates?: string[] }} Recurrence
 * @typedef {{
 *   id: string, title: string, kind: 'event'|'deadline'|'exam'|'class'|'reminder', date: string, allDay: boolean,
 *   start?: string|null, end?: string|null, recurrence?: Recurrence|null, reminderOffsetMin: number|null,
 *   location?: string, notes?: string, moduleId?: string|null, color?: string|null,
 * }} CalendarEvent
 * @typedef {{ id: string, title: string, dueDate?: string|null, dueTime?: string|null, status: string, priority?: string }} TaskLike
 * @typedef {{ type: 'event', date: string, event: CalendarEvent } | { type: 'task', date: string, task: TaskLike }} AgendaItem
 */

export const KINDS = /** @type {const} */ (['event', 'deadline', 'reminder', 'exam', 'class']);
export const REMINDER_OFFSETS = /** @type {const} */ ([null, 0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080]);

/**
 * Occurrence dates of an event within [from, to] (inclusive LocalDates).
 * @param {Pick<CalendarEvent, 'date'|'recurrence'>} event
 * @param {string} from
 * @param {string} to
 * @returns {string[]}
 */
export function occurrences(event, from, to) {
  const start = event.date;
  const rec = event.recurrence;
  if (!rec) return start >= from && start <= to ? [start] : [];
  const interval = Math.max(1, Math.floor(rec.interval || 1));
  const until = rec.until && rec.until < to ? rec.until : to;
  const skip = new Set(rec.exDates ?? []);
  /** @type {string[]} */
  const out = [];
  /** @param {string} d */
  const add = (d) => {
    if (d >= start && d >= from && d <= until && !skip.has(d)) out.push(d);
  };
  if (until < from || until < start) return out;

  if (rec.freq === 'daily') {
    const k0 = Math.max(0, Math.floor(diffDays(start, from) / interval));
    for (let d = addDays(start, k0 * interval); d <= until; d = addDays(d, interval)) add(d);
  } else if (rec.freq === 'weekly') {
    const days = rec.byWeekday?.length ? rec.byWeekday : [weekday(start)];
    const firstWeek = startOfWeek(start, 1);
    const k0 = Math.max(0, Math.floor(diffDays(firstWeek, startOfWeek(from, 1)) / 7 / interval));
    for (let week = addDays(firstWeek, k0 * interval * 7); week <= until; week = addDays(week, interval * 7)) {
      for (const wd of [...days].sort((a, b) => a - b)) add(addDays(week, wd - 1));
    }
  } else {
    const months = rec.freq === 'yearly' ? 12 * interval : interval;
    const day = Number(start.slice(8, 10));
    const [sy, sm] = start.split('-').map(Number);
    const [fy, fm] = from.split('-').map(Number);
    const monthsToFrom = (fy - sy) * 12 + (fm - sm);
    const k0 = Math.max(0, Math.floor(monthsToFrom / months) - 1);
    for (let k = k0; ; k++) {
      const d = addMonths(start, k * months, day);
      if (d > until) break;
      add(d);
    }
  }
  return out.sort();
}

/**
 * @param {AgendaItem} a
 * @param {AgendaItem} b
 */
function compareItems(a, b) {
  const timeOf = (/** @type {AgendaItem} */ item) =>
    item.type === 'event' ? (item.event.allDay ? -1 : parseTime(item.event.start ?? '00:00')) : item.task.dueTime ? parseTime(item.task.dueTime) : -1;
  const titleOf = (/** @type {AgendaItem} */ item) => (item.type === 'event' ? item.event.title : item.task.title);
  return timeOf(a) - timeOf(b) || titleOf(a).localeCompare(titleOf(b));
}

/**
 * Agenda items per date for [from, to]: event occurrences plus tasks due on those dates (virtual deadlines).
 * @param {CalendarEvent[]} events
 * @param {TaskLike[]} tasks
 * @param {string} from
 * @param {string} to
 * @returns {Map<string, AgendaItem[]>}
 */
export function agenda(events, tasks, from, to) {
  /** @type {Map<string, AgendaItem[]>} */
  const map = new Map();
  /** @param {AgendaItem} item */
  const push = (item) => {
    const list = map.get(item.date) ?? [];
    list.push(item);
    map.set(item.date, list);
  };
  for (const event of events) for (const date of occurrences(event, from, to)) push({ type: 'event', date, event });
  for (const task of tasks) {
    if (task.dueDate && task.dueDate >= from && task.dueDate <= to) push({ type: 'task', date: task.dueDate, task });
  }
  for (const list of map.values()) list.sort(compareItems);
  return map;
}

/**
 * 6 × 7 dates covering a month, starting on the user's week start.
 * @param {number} year
 * @param {number} month 1–12
 * @param {1|7} weekStart
 */
export function monthGrid(year, month, weekStart) {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const start = startOfWeek(first, weekStart);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/**
 * @param {string} date LocalDate
 * @param {Date} now
 */
export function defaultEvent(date, now) {
  const nextHour = Math.min(22, now.getHours() + 1);
  const start = `${String(nextHour).padStart(2, '0')}:00`;
  return {
    title: '',
    kind: /** @type {CalendarEvent['kind']} */ ('event'),
    date,
    allDay: false,
    start,
    end: `${String(nextHour + 1).padStart(2, '0')}:00`,
    repeat: /** @type {'none'|Recurrence['freq']} */ ('none'),
    byWeekday: /** @type {number[]} */ ([]),
    until: '',
    reminderOffsetMin: /** @type {number|null} */ (10),
    location: '',
    notes: '',
  };
}

/** @typedef {ReturnType<typeof defaultEvent>} EventForm */

/**
 * @param {CalendarEvent} event
 * @returns {EventForm}
 */
export function formFromEvent(event) {
  return {
    title: event.title,
    kind: event.kind,
    date: event.date,
    allDay: event.allDay,
    start: event.start ?? '09:00',
    end: event.end ?? '10:00',
    repeat: event.recurrence?.freq ?? 'none',
    byWeekday: event.recurrence?.byWeekday ?? [],
    until: event.recurrence?.until ?? '',
    reminderOffsetMin: event.reminderOffsetMin,
    location: event.location ?? '',
    notes: event.notes ?? '',
  };
}

/**
 * @param {EventForm} form
 * @param {Recurrence|null|undefined} [previous] keeps exDates when editing a series
 */
export function eventFromForm(form, previous) {
  const recurrence =
    form.repeat === 'none'
      ? null
      : {
          freq: form.repeat,
          interval: 1,
          byWeekday: form.repeat === 'weekly' ? (form.byWeekday.length ? form.byWeekday : [weekday(form.date)]) : undefined,
          until: form.until || null,
          exDates: previous?.exDates ?? [],
        };
  return {
    title: form.title.trim(),
    kind: form.kind,
    date: form.date,
    allDay: form.allDay,
    start: form.allDay ? null : form.start,
    end: form.allDay ? null : form.end,
    recurrence,
    reminderOffsetMin: form.reminderOffsetMin,
    location: form.location.trim(),
    notes: form.notes,
  };
}

/**
 * @param {EventForm} form
 * @returns {Record<string, string>} field → i18n error key
 */
export function validateEvent(form) {
  /** @type {Record<string, string>} */
  const errors = {};
  if (!form.title.trim()) errors.title = 'form.errors.required';
  else if (form.title.length > 120) errors.title = 'form.errors.tooLong';
  if (!isValidLocalDate(form.date)) errors.date = 'form.errors.date';
  if (!form.allDay) {
    if (!isValidTime(form.start)) errors.start = 'form.errors.time';
    if (!isValidTime(form.end)) errors.end = 'form.errors.time';
    else if (isValidTime(form.start) && parseTime(form.end) <= parseTime(form.start)) errors.end = 'calendar.errors.endBeforeStart';
  }
  if (form.repeat !== 'none' && form.until && form.until < form.date) errors.until = 'calendar.errors.untilBeforeStart';
  return errors;
}

/**
 * Reminder instants for events with a reminder offset, within [from, to].
 * All-day items count the offset from 09:00 of their day.
 * @param {CalendarEvent[]} events
 * @param {Date} from
 * @param {Date} to
 * @param {(d: Date) => string} toLocal
 */
export function eventReminders(events, from, to, toLocal) {
  /** @type {{ event: CalendarEvent, date: string, at: Date }[]} */
  const out = [];
  // Offsets up to a week: look ahead by that much in calendar days.
  const fromDate = toLocal(from);
  const toDate = addDays(toLocal(to), 8);
  for (const event of events) {
    if (event.reminderOffsetMin === null || event.reminderOffsetMin === undefined) continue;
    for (const date of occurrences(event, addDays(fromDate, -1), toDate)) {
      const base = combine(date, event.allDay ? '09:00' : event.start ?? '09:00');
      const at = new Date(base.getTime() - event.reminderOffsetMin * 60_000);
      if (at >= from && at <= to) out.push({ event, date, at });
    }
  }
  return out;
}

/**
 * Start instant of an event occurrence (all-day → local midnight).
 * @param {CalendarEvent} event
 * @param {string} date
 */
export function startOf(event, date) {
  return combine(date, event.allDay ? '00:00' : event.start ?? '00:00');
}
