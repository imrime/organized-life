// @ts-check
// Workout logic (pure): equipment filters, substitutions, suggestions, plans, records (Epley), consistency (docs/spec/rooms/gym.md).

import { addDays, startOfWeek, weekday, toLocalDate } from '../../core/time.js';
import { MUSCLE_GROUPS } from './catalog.js';

/**
 * @typedef {{ id: string, name?: string, seedKey?: string, type: 'strength'|'cardio'|'mobility', metric: 'reps'|'time'|'distance',
 *   equipment: string[], muscles: string[], substitutionIds: string[], howTo?: string, howToKey?: string, custom: boolean, hidden?: boolean }} Exercise
 * @typedef {{ id: string, exerciseId: string, sets: number, reps?: number|null, durationSec?: number|null, weightKg?: number|null, restSec: number }} PlanItem
 * @typedef {{ id: string, name: string, days: number[], items: PlanItem[], notes?: string, archived: boolean }} WorkoutPlan
 * @typedef {{ id: string, reps?: number|null, weightKg?: number|null, durationSec?: number|null, distanceM?: number|null, done: boolean }} WorkoutSet
 * @typedef {{ id: string, exerciseId: string, restSec: number, sets: WorkoutSet[] }} Entry
 * @typedef {{ id: string, planId?: string|null, date: string, startedAt: string, finishedAt?: string|null, status: 'in_progress'|'completed'|'abandoned', entries: Entry[], notes?: string }} WorkoutSession
 * @typedef {{ maxWeight: { value: number, date: string }|null, best1RM: { value: number, date: string }|null, maxReps: { value: number, date: string }|null, maxDuration: { value: number, date: string }|null }} Records
 */

/** Doable with the given equipment ("none" = bodyweight, always available). @param {Exercise} ex @param {string[]} equipment */
export function isAvailable(ex, equipment) {
  return ex.equipment.some((e) => e === 'none' || equipment.includes(e));
}

/**
 * AND across groups, OR within a group; an empty group doesn't filter.
 * @param {Exercise[]} list
 * @param {string[]} equipment selected equipment chips
 * @param {string[]} groups selected muscle chips
 */
export function filterExercises(list, equipment, groups) {
  const muscles = groups.flatMap((g) => MUSCLE_GROUPS[g] ?? []);
  return list.filter((ex) => !ex.hidden && (!equipment.length || isAvailable(ex, equipment)) && (!muscles.length || ex.muscles.some((m) => muscles.includes(m))));
}

/**
 * Explicit substitutions plus computed ones (same primary muscle and type), all doable with the equipment.
 * @param {Exercise} ex
 * @param {Exercise[]} all
 * @param {string[]} equipment
 */
export function substitutes(ex, all, equipment) {
  const explicit = ex.substitutionIds.map((id) => all.find((x) => x.id === id)).filter((x) => x !== undefined);
  const computed = all.filter((x) => x.type === ex.type && x.muscles[0] === ex.muscles[0]);
  const seen = new Set([ex.id]);
  return [...explicit, ...computed].filter((x) => {
    if (!x || seen.has(x.id) || x.hidden || !isAvailable(x, equipment)) return false;
    seen.add(x.id);
    return true;
  });
}

/** Completed sessions only. @param {WorkoutSession[]} sessions */
export const completed = (sessions) => sessions.filter((s) => s.status === 'completed');

/**
 * Suggestions: exercises for the muscle groups least trained in the last 7 days (fallback: full body).
 * @param {Exercise[]} exercises
 * @param {WorkoutSession[]} sessions
 * @param {string[]} equipment
 * @param {string} today
 * @param {number} [count]
 */
export function suggestions(exercises, sessions, equipment, today, count = 3) {
  const since = addDays(today, -6);
  /** @type {Record<string, number>} */
  const trained = Object.fromEntries(Object.keys(MUSCLE_GROUPS).map((g) => [g, 0]));
  const byId = new Map(exercises.map((e) => [e.id, e]));
  for (const s of completed(sessions).filter((x) => x.date >= since)) {
    for (const entry of s.entries) {
      const ex = byId.get(entry.exerciseId);
      const done = entry.sets.filter((x) => x.done).length;
      if (!ex || !done) continue;
      for (const [g, muscles] of Object.entries(MUSCLE_GROUPS)) if (muscles.includes(/** @type {any} */ (ex.muscles[0]))) trained[g] += done;
    }
  }
  const order = Object.keys(MUSCLE_GROUPS).filter((g) => g !== 'cardio').sort((a, b) => trained[a] - trained[b]);
  const pool = exercises.filter((e) => !e.hidden && e.type === 'strength' && isAvailable(e, equipment));
  /** @type {Exercise[]} */
  const out = [];
  for (const g of order) {
    const ex = pool.find((e) => MUSCLE_GROUPS[g].includes(/** @type {any} */ (e.muscles[0])) && !out.includes(e));
    if (ex) out.push(ex);
    if (out.length >= count) break;
  }
  return out.length ? out : pool.filter((e) => e.muscles.includes('full_body')).slice(0, count);
}

/** Active plans scheduled on the date's weekday. @param {WorkoutPlan[]} plans @param {string} date */
export function plansFor(plans, date) {
  const wd = weekday(date);
  return plans.filter((p) => !p.archived && p.days.includes(wd));
}

/** The session in progress, if any. @param {WorkoutSession[]} sessions */
export const inProgress = (sessions) => sessions.find((s) => s.status === 'in_progress');

/** Sets from the latest completed session with this exercise. @param {WorkoutSession[]} sessions @param {string} exerciseId */
export function lastSets(sessions, exerciseId) {
  const s = completed(sessions)
    .filter((x) => x.entries.some((e) => e.exerciseId === exerciseId && e.sets.some((st) => st.done)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt))[0];
  return s ? /** @type {Entry} */ (s.entries.find((e) => e.exerciseId === exerciseId)).sets.filter((x) => x.done) : [];
}

/** Default rest by type: 90 s strength, 30 s cardio/mobility. @param {Exercise|undefined} ex */
export const defaultRest = (ex) => (ex?.type === 'strength' ? 90 : 30);

/** Estimated one-rep max (Epley): w × (1 + reps / 30); single reps count as the weight. @param {number} weightKg @param {number} reps */
export function epley(weightKg, reps) {
  if (!weightKg || !reps) return 0;
  return reps === 1 ? weightKg : Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

/**
 * Personal records per exercise from completed sessions.
 * @param {WorkoutSession[]} sessions
 * @returns {Map<string, Records>}
 */
export function records(sessions) {
  /** @type {Map<string, Records>} */
  const map = new Map();
  const sorted = completed(sessions).sort((a, b) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt));
  /** @param {{ value: number, date: string }|null} cur @param {number} value @param {string} date */
  const better = (cur, value, date) => (value > 0 && (!cur || value > cur.value) ? { value, date } : cur);
  for (const s of sorted) {
    for (const e of s.entries) {
      const r = map.get(e.exerciseId) ?? { maxWeight: null, best1RM: null, maxReps: null, maxDuration: null };
      for (const set of e.sets.filter((x) => x.done)) {
        r.maxWeight = better(r.maxWeight, set.weightKg ?? 0, s.date);
        r.best1RM = better(r.best1RM, epley(set.weightKg ?? 0, set.reps ?? 0), s.date);
        r.maxReps = better(r.maxReps, set.reps ?? 0, s.date);
        r.maxDuration = better(r.maxDuration, set.durationSec ?? 0, s.date);
      }
      map.set(e.exerciseId, r);
    }
  }
  return map;
}

/**
 * Records a session set compared with everything before it.
 * @param {WorkoutSession} session
 * @param {WorkoutSession[]} all
 * @returns {{ exerciseId: string, kind: 'maxWeight'|'best1RM'|'maxReps'|'maxDuration', value: number }[]}
 */
export function newRecords(session, all) {
  const before = records(all.filter((s) => s.id !== session.id && (s.date < session.date || (s.date === session.date && s.startedAt < session.startedAt))));
  const after = records([...all.filter((s) => s.id !== session.id), { ...session, status: 'completed' }]);
  /** @type {{ exerciseId: string, kind: any, value: number }[]} */
  const out = [];
  for (const e of session.entries) {
    const a = after.get(e.exerciseId);
    const b = before.get(e.exerciseId);
    if (!a) continue;
    for (const kind of /** @type {const} */ (['maxWeight', 'best1RM', 'maxReps', 'maxDuration'])) {
      // The first time an exercise is done is not a "record".
      if (a[kind] && b && a[kind]?.date === session.date && (!b[kind] || /** @type {any} */ (a[kind]).value > /** @type {any} */ (b[kind]).value)) out.push({ exerciseId: e.exerciseId, kind, value: /** @type {any} */ (a[kind]).value });
    }
  }
  return out;
}

/** Any completed session that set a record (achievement "New record"). @param {WorkoutSession[]} sessions */
export function anyRecordSet(sessions) {
  const done = completed(sessions);
  return done.some((s) => newRecords(s, done).length > 0);
}

/**
 * Duration, completed sets and volume (Σ reps × kg) of a session.
 * @param {WorkoutSession} s
 * @param {Date} [now]
 */
export function sessionStats(s, now = new Date()) {
  const end = s.finishedAt ? new Date(s.finishedAt) : now;
  const minutes = Math.max(0, Math.round((end.getTime() - new Date(s.startedAt).getTime()) / 60_000));
  let sets = 0;
  let volume = 0;
  for (const e of s.entries) {
    for (const set of e.sets.filter((x) => x.done)) {
      sets++;
      volume += (set.reps ?? 0) * (set.weightKg ?? 0);
    }
  }
  return { minutes, sets, volume: Math.round(volume) };
}

/**
 * Completed workouts per week for the last `weeks` weeks (oldest first).
 * @param {WorkoutSession[]} sessions
 * @param {string} today
 * @param {1|7} weekStart
 * @param {number} weeks
 */
export function weeklyCounts(sessions, today, weekStart, weeks) {
  const current = startOfWeek(today, weekStart);
  return Array.from({ length: weeks }, (_, i) => {
    const from = addDays(current, (i - weeks + 1) * 7);
    const to = addDays(from, 6);
    return { week: from, count: completed(sessions).filter((s) => s.date >= from && s.date <= to).length };
  });
}

/**
 * Weekly volume for the last `weeks` weeks (oldest first).
 * @param {WorkoutSession[]} sessions
 * @param {string} today
 * @param {1|7} weekStart
 * @param {number} weeks
 */
export function weeklyVolume(sessions, today, weekStart, weeks) {
  const current = startOfWeek(today, weekStart);
  return Array.from({ length: weeks }, (_, i) => {
    const from = addDays(current, (i - weeks + 1) * 7);
    const to = addDays(from, 6);
    return { week: from, volume: completed(sessions).filter((s) => s.date >= from && s.date <= to).reduce((sum, s) => sum + sessionStats(s).volume, 0) };
  });
}

/**
 * 12-week activity heatmap: rows = weekdays (from week start), columns = weeks; workout beats walk (F-13).
 * @param {WorkoutSession[]} sessions
 * @param {{ date: string, status: string }[]} walks
 * @param {string} today
 * @param {1|7} weekStart
 * @param {number} [weeks]
 * @returns {{ date: string, level: 'workout'|'walk'|'none'|'future' }[][]} columns of 7 days
 */
export function heatmap(sessions, walks, today, weekStart, weeks = 12) {
  const workoutDays = new Set(completed(sessions).map((s) => s.date));
  const walkDays = new Set(walks.filter((w) => w.status === 'done').map((w) => w.date));
  const first = addDays(startOfWeek(today, weekStart), -(weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(first, w * 7 + d);
      const level = date > today ? 'future' : workoutDays.has(date) ? 'workout' : walkDays.has(date) ? 'walk' : 'none';
      return { date, level: /** @type {const} */ (level) };
    }),
  );
}

/**
 * Trend points for an exercise: top-set weight or best estimated 1RM per session.
 * @param {WorkoutSession[]} sessions
 * @param {string} exerciseId
 * @param {'top'|'1rm'} mode
 */
export function trend(sessions, exerciseId, mode) {
  return completed(sessions)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => {
      const sets = s.entries.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets.filter((x) => x.done));
      const value = Math.max(0, ...sets.map((x) => (mode === 'top' ? x.weightKg ?? 0 : epley(x.weightKg ?? 0, x.reps ?? 0))));
      return { date: s.date, value };
    })
    .filter((p) => p.value > 0);
}

/** kg → display units (lb rounded to 0.5). @param {number} kg @param {'metric'|'imperial'} units */
export function displayWeight(kg, units) {
  return units === 'imperial' ? Math.round(kg * 2.20462 * 2) / 2 : Math.round(kg * 10) / 10;
}

/** Display units → kg. @param {number} value @param {'metric'|'imperial'} units */
export function toKg(value, units) {
  return units === 'imperial' ? Math.round((value / 2.20462) * 100) / 100 : value;
}

/** Day of an ISO timestamp (local). @param {string} iso */
export const dayOfIso = (iso) => toLocalDate(new Date(iso));
