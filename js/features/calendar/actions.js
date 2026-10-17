// @ts-check
// Calendar mutations.

import { appStore } from '../../core/store.js';
import { eventFromForm } from './model.js';

/** @typedef {import('./model.js').EventForm} EventForm */

/**
 * @param {EventForm} form
 * @param {string|null} id
 */
export function saveEvent(form, id) {
  return appStore.mutate('calendar.save', (tx) => {
    const previous = id ? tx.get('events', id) : undefined;
    const fields = eventFromForm(form, previous?.recurrence);
    return id ? tx.patch('events', id, fields) : tx.insert('events', { ...fields, moduleId: null, color: null });
  });
}

/** @param {string} id */
export function deleteEvent(id) {
  return appStore.mutate('calendar.delete', (tx) => tx.remove('events', id));
}

/**
 * Hides one occurrence of a recurring event.
 * @param {string} id
 * @param {string} date
 */
export function deleteOccurrence(id, date) {
  return appStore.mutate('calendar.deleteOccurrence', (tx) => {
    const event = tx.get('events', id);
    if (!event?.recurrence) return;
    const exDates = [...new Set([...(event.recurrence.exDates ?? []), date])].sort();
    tx.patch('events', id, { recurrence: { ...event.recurrence, exDates } });
  });
}

/**
 * Completes/reopens a task from the calendar (virtual deadline item).
 * @param {string} id
 * @param {boolean} done
 */
export function setTaskDone(id, done) {
  return appStore.mutate('tasks.toggle', (tx) =>
    tx.patch('tasks', id, { status: done ? 'done' : 'todo', completedAt: done ? new Date().toISOString() : null }),
  );
}
