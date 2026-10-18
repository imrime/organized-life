// @ts-check
// Workout mutations: plans, sessions and sets, exercise library, fitness profile.

import { appStore } from '../../core/store.js';
import { newId } from '../../core/ids.js';
import { today } from '../../core/time.js';
import { PROFILE } from '../../core/schema.js';
import { lastSets, defaultRest } from './model.js';

/** @typedef {import('./model.js').WorkoutSession} WorkoutSession */
/** @typedef {import('./model.js').WorkoutSet} WorkoutSet */
/** @typedef {import('./model.js').PlanItem} PlanItem */
/** @typedef {import('../../core/store.js').Tx} Tx */

/**
 * @param {{ name: string, days: number[], items: PlanItem[], notes: string }} form
 * @param {string|null} id
 */
export function savePlan(form, id) {
  return appStore.mutate('workouts.plan', (tx) => {
    const fields = { name: form.name.trim(), days: [...form.days].sort(), items: form.items.map((i) => ({ ...i, id: i.id ?? newId() })), notes: form.notes };
    return id ? tx.patch('workoutPlans', id, fields) : tx.insert('workoutPlans', { ...fields, archived: false });
  });
}

/** @param {string} id @param {boolean} archived */
export function setPlanArchived(id, archived) {
  return appStore.mutate('workouts.planArchive', (tx) => tx.patch('workoutPlans', id, { archived }));
}

/** Sets for a new entry: from the plan item, else the last session, else one empty set. @param {Tx} tx @param {string} exerciseId @param {PlanItem} [item] */
function setsFor(tx, exerciseId, item) {
  const last = lastSets(/** @type {any} */ (tx.all('workoutSessions')), exerciseId);
  const n = item?.sets ?? Math.max(1, last.length || 3);
  return Array.from({ length: n }, (_, i) => {
    const prev = last[i] ?? last[last.length - 1];
    return {
      id: newId(),
      reps: item?.reps ?? prev?.reps ?? null,
      weightKg: item?.weightKg ?? prev?.weightKg ?? null,
      durationSec: item?.durationSec ?? prev?.durationSec ?? null,
      distanceM: prev?.distanceM ?? null,
      done: false,
    };
  });
}

/** @param {Tx} tx @param {string} exerciseId @param {PlanItem} [item] */
function entryFor(tx, exerciseId, item) {
  return { id: newId(), exerciseId, restSec: item?.restSec ?? defaultRest(/** @type {any} */ (tx.get('exercises', exerciseId))), sets: setsFor(tx, exerciseId, item) };
}

/** Starts a session from a plan (or empty). Only one session can be in progress. @param {string|null} planId */
export function startSession(planId) {
  return appStore.mutate('workouts.start', (tx) => {
    const running = tx.all('workoutSessions').find((s) => s.status === 'in_progress');
    if (running) return running;
    const plan = planId ? tx.get('workoutPlans', planId) : undefined;
    const entries = (plan?.items ?? []).map((/** @type {PlanItem} */ item) => entryFor(tx, item.exerciseId, item));
    return tx.insert('workoutSessions', { planId, date: today(), startedAt: new Date().toISOString(), finishedAt: null, status: 'in_progress', entries, notes: '' });
  });
}

/**
 * Patches one entry of a session through a function.
 * @param {string} label
 * @param {string} sessionId
 * @param {(entries: import('./model.js').Entry[]) => import('./model.js').Entry[]} fn
 * @param {{ quiet?: boolean }} [opts]
 */
function editEntries(label, sessionId, fn, opts) {
  return appStore.mutate(label, (tx) => {
    const s = tx.get('workoutSessions', sessionId);
    if (s) tx.patch('workoutSessions', sessionId, { entries: fn(s.entries) });
  }, opts);
}

/** @param {string} sessionId @param {string} entryId @param {string} setId @param {Partial<WorkoutSet>} patch */
export function updateSet(sessionId, entryId, setId, patch) {
  return editEntries('workouts.set', sessionId, (entries) =>
    entries.map((e) => (e.id !== entryId ? e : { ...e, sets: e.sets.map((x) => (x.id === setId ? { ...x, ...patch } : x)) })),
  );
}

/** @param {string} sessionId @param {string} entryId */
export function addSet(sessionId, entryId) {
  return editEntries('workouts.addSet', sessionId, (entries) =>
    entries.map((e) => {
      if (e.id !== entryId) return e;
      const prev = e.sets[e.sets.length - 1];
      return { ...e, sets: [...e.sets, { id: newId(), reps: prev?.reps ?? null, weightKg: prev?.weightKg ?? null, durationSec: prev?.durationSec ?? null, distanceM: prev?.distanceM ?? null, done: false }] };
    }),
  );
}

/** @param {string} sessionId @param {string} entryId @param {string} setId */
export function removeSet(sessionId, entryId, setId) {
  return editEntries('workouts.removeSet', sessionId, (entries) => entries.map((e) => (e.id !== entryId ? e : { ...e, sets: e.sets.filter((x) => x.id !== setId) })));
}

/** Adds an exercise to the session in progress, starting an empty session if needed. @param {string} exerciseId */
export function addExerciseToSession(exerciseId) {
  return appStore.mutate('workouts.addExercise', (tx) => {
    let s = tx.all('workoutSessions').find((x) => x.status === 'in_progress');
    if (!s) s = tx.insert('workoutSessions', { planId: null, date: today(), startedAt: new Date().toISOString(), finishedAt: null, status: 'in_progress', entries: [], notes: '' });
    tx.patch('workoutSessions', s.id, { entries: [...s.entries, entryFor(tx, exerciseId)] });
    return s.id;
  });
}

/** @param {string} sessionId @param {string} entryId */
export function removeEntry(sessionId, entryId) {
  return editEntries('workouts.removeEntry', sessionId, (entries) => entries.filter((e) => e.id !== entryId));
}

/** Replace with a substitution: keeps the set count, resets values. @param {string} sessionId @param {string} entryId @param {string} exerciseId */
export function replaceEntry(sessionId, entryId, exerciseId) {
  return appStore.mutate('workouts.replace', (tx) => {
    const s = tx.get('workoutSessions', sessionId);
    if (!s) return;
    tx.patch('workoutSessions', sessionId, {
      entries: s.entries.map((/** @type {any} */ e) => (e.id !== entryId ? e : { ...entryFor(tx, exerciseId, { id: '', exerciseId, sets: e.sets.length, restSec: e.restSec }), id: e.id })),
    });
  });
}

/** @param {string} sessionId @param {string} notes */
export function saveSessionNotes(sessionId, notes) {
  return appStore.mutate('workouts.notes', (tx) => tx.patch('workoutSessions', sessionId, { notes }), { quiet: true });
}

/** @param {string} sessionId */
export function finishSession(sessionId) {
  return appStore.mutate('workouts.finish', (tx) => tx.patch('workoutSessions', sessionId, { status: 'completed', finishedAt: new Date().toISOString() }));
}

/** @param {string} sessionId */
export function abandonSession(sessionId) {
  return appStore.mutate('workouts.abandon', (tx) => tx.patch('workoutSessions', sessionId, { status: 'abandoned', finishedAt: new Date().toISOString() }));
}

/** @param {string} sessionId */
export function deleteSession(sessionId) {
  return appStore.mutate('workouts.delete', (tx) => tx.remove('workoutSessions', sessionId));
}

/** @param {number} weeklyGoal */
export function setWeeklyGoal(weeklyGoal) {
  return appStore.mutate('fitness.goal', (tx) => tx.setProfile(PROFILE.fitness, { weeklyGoal: Math.min(14, Math.max(1, weeklyGoal)) }));
}

/** @param {string[]} equipment */
export function setMyEquipment(equipment) {
  return appStore.mutate('fitness.equipment', (tx) => tx.setProfile(PROFILE.fitness, { equipment: [...equipment] }));
}

/**
 * Custom exercise (seeded ones are read-only).
 * @param {{ name: string, type: string, metric: string, equipment: string[], muscles: string[], howTo: string }} form
 * @param {string|null} id
 */
export function saveExercise(form, id) {
  return appStore.mutate('workouts.exercise', (tx) => {
    const fields = { ...form, name: form.name.trim(), equipment: form.equipment.length ? form.equipment : ['none'] };
    return id ? tx.patch('exercises', id, fields) : tx.insert('exercises', { ...fields, substitutionIds: [], custom: true, hidden: false });
  });
}

/** @param {string} id @param {boolean} hidden */
export function setExerciseHidden(id, hidden) {
  return appStore.mutate('workouts.hide', (tx) => tx.patch('exercises', id, { hidden }));
}

/** @param {string} id */
export function deleteExercise(id) {
  return appStore.mutate('workouts.exerciseDelete', (tx) => tx.remove('exercises', id));
}

/**
 * Appends an exercise to a plan.
 * @param {string} planId
 * @param {string} exerciseId
 */
export function addToPlan(planId, exerciseId) {
  return appStore.mutate('workouts.addToPlan', (tx) => {
    const plan = tx.get('workoutPlans', planId);
    const ex = tx.get('exercises', exerciseId);
    if (!plan) return;
    const item = { id: newId(), exerciseId, sets: 3, reps: ex?.metric === 'reps' ? 10 : null, durationSec: ex?.metric === 'time' ? 60 : null, weightKg: null, restSec: defaultRest(/** @type {any} */ (ex)) };
    tx.patch('workoutPlans', planId, { items: [...plan.items, item] });
  });
}
