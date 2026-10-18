// @ts-check
// Routine mutations.

import { appStore } from '../../core/store.js';
import { newId } from '../../core/ids.js';
import { runId, toggledRun } from './model.js';

/** @typedef {import('./model.js').Routine} Routine */

/**
 * @param {Routine} routine
 * @param {string} stepId
 * @param {string} date
 */
export function toggleStep(routine, stepId, date) {
  return appStore.mutate('routines.step', (tx) => {
    const id = runId(routine.id, date);
    const run = tx.get('routineRuns', id);
    const next = toggledRun(routine, /** @type {any} */ (run), stepId, new Date().toISOString());
    if (run) tx.patch('routineRuns', id, next);
    else tx.insert('routineRuns', { id, routineId: routine.id, date, ...next });
  });
}

/**
 * Single-checkbox habits (no steps).
 * @param {Routine} routine
 * @param {string} date
 * @param {boolean} done
 */
export function setHabitDone(routine, date, done) {
  return appStore.mutate('routines.habit', (tx) => {
    const id = runId(routine.id, date);
    const fields = { doneStepIds: [], completedAt: done ? new Date().toISOString() : null };
    if (tx.get('routineRuns', id)) tx.patch('routineRuns', id, fields);
    else tx.insert('routineRuns', { id, routineId: routine.id, date, ...fields });
  });
}

/**
 * Saves steps/days/reminder/name of a routine (renaming drops the seed key so the user's text wins).
 * @param {string} id
 * @param {{ name?: string, steps?: {id?: string, label: string, seedKey?: string}[], days?: number[], reminderTime?: string|null, enabled?: boolean }} patch
 */
export function saveRoutine(id, patch) {
  return appStore.mutate('routines.save', (tx) => {
    const fields = { ...patch };
    if (patch.steps) fields.steps = patch.steps.map((s) => ({ id: s.id ?? newId(), label: s.label, ...(s.seedKey && !s.label ? { seedKey: s.seedKey } : {}) }));
    return tx.patch('routines', id, fields);
  });
}

/**
 * @param {{ name: string, owner: string, slot: Routine['slot'], days: number[], reminderTime?: string|null, steps?: {label: string}[] }} fields
 */
export function addRoutine(fields) {
  return appStore.mutate('routines.add', (tx) => {
    const order = tx.all('routines').filter((r) => r.owner === fields.owner).length;
    return tx.insert('routines', {
      ...fields,
      steps: (fields.steps ?? []).map((s) => ({ id: newId(), label: s.label })),
      reminderTime: fields.reminderTime ?? null,
      enabled: true,
      order,
    });
  });
}

/** @param {string} id */
export function deleteRoutine(id) {
  return appStore.mutate('routines.delete', (tx) => tx.remove('routines', id));
}
