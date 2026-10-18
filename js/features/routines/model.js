// @ts-check
// Routine logic (pure): active days, completion, streaks, history. docs/spec/04-data-model.md §3.5.

import { addDays, weekday } from '../../core/time.js';

/**
 * @typedef {{ id: string, label: string, seedKey?: string }} Step
 * @typedef {{
 *   id: string, name: string, seedKey?: string, owner: string, slot: 'morning'|'evening'|'bedtime'|'habit',
 *   steps: Step[], days: number[], reminderTime?: string|null, enabled: boolean, order: number,
 * }} Routine
 * @typedef {{ id: string, routineId: string, date: string, doneStepIds: string[], completedAt?: string|null }} RoutineRun
 */

/** Deterministic run id: one run per routine per day. */
export const runId = (/** @type {string} */ routineId, /** @type {string} */ date) => `${routineId}:${date}`;

/** @param {Routine} routine @param {string} date */
export function isActiveOn(routine, date) {
  return routine.enabled && routine.days.includes(weekday(date));
}

/** @param {Routine} routine @param {RoutineRun|undefined} run */
export function isComplete(routine, run) {
  if (!run) return false;
  if (!routine.steps.length) return Boolean(run.completedAt);
  return routine.steps.every((s) => run.doneStepIds.includes(s.id));
}

/**
 * Consecutive active days completed, counting back from yesterday (+1 when today is already done).
 * Inactive days don't break the streak.
 * @param {Routine} routine
 * @param {(date: string) => RoutineRun|undefined} runOn
 * @param {string} today
 */
export function streak(routine, runOn, today) {
  let count = isActiveOn(routine, today) && isComplete(routine, runOn(today)) ? 1 : 0;
  let date = addDays(today, -1);
  for (let i = 0; i < 400; i++, date = addDays(date, -1)) {
    if (!routine.days.includes(weekday(date))) continue;
    if (!isComplete(routine, runOn(date))) break;
    count++;
  }
  return count;
}

/**
 * Per-day state for the last `days` days ending today.
 * @param {Routine} routine
 * @param {(date: string) => RoutineRun|undefined} runOn
 * @param {string} today
 * @param {number} [days]
 * @returns {{ date: string, state: 'done'|'partial'|'none'|'inactive' }[]}
 */
export function history(routine, runOn, today, days = 14) {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1);
    const run = runOn(date);
    if (isComplete(routine, run)) return { date, state: 'done' };
    if (!routine.days.includes(weekday(date))) return { date, state: 'inactive' };
    return { date, state: run && run.doneStepIds.length ? 'partial' : 'none' };
  });
}

/**
 * Most recent completed date, or null.
 * @param {Routine} routine
 * @param {RoutineRun[]} runs
 */
export function lastDone(routine, runs) {
  const done = runs.filter((r) => r.routineId === routine.id && isComplete(routine, r)).map((r) => r.date).sort();
  return done[done.length - 1] ?? null;
}

/** Morning 05:00–14:59, evening otherwise (spec BA1). @param {Date} now */
export function careSlotAt(now) {
  const h = now.getHours();
  return h >= 5 && h < 15 ? 'morning' : 'evening';
}

/**
 * Toggles a step in a run and recomputes completion.
 * @param {Routine} routine
 * @param {RoutineRun|undefined} run
 * @param {string} stepId
 * @param {string} nowIso
 */
export function toggledRun(routine, run, stepId, nowIso) {
  const done = new Set(run?.doneStepIds ?? []);
  if (done.has(stepId)) done.delete(stepId);
  else done.add(stepId);
  const doneStepIds = routine.steps.map((s) => s.id).filter((id) => done.has(id));
  const complete = doneStepIds.length === routine.steps.length && routine.steps.length > 0;
  return { doneStepIds, completedAt: complete ? run?.completedAt ?? nowIso : null };
}
