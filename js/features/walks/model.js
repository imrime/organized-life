// @ts-check
// Walks and places (pure): elapsed time, weekly totals, place stats (docs/spec/rooms/town.md T4).

import { startOfWeek, addDays } from '../../core/time.js';

/**
 * @typedef {{ id: string, date: string, startedAt?: string|null, endedAt?: string|null, durationMin: number, steps?: number|null,
 *   distanceKm?: number|null, placeId?: string|null, notes?: string, status: 'running'|'done' }} Walk
 * @typedef {{ id: string, name: string, seedKey?: string, notes?: string, favorite: boolean }} Place
 */

/** @param {Walk[]} walks */
export function runningWalk(walks) {
  return walks.find((w) => w.status === 'running');
}

/** Whole minutes since the walk started. @param {Walk} walk @param {Date} now */
export function elapsedMin(walk, now) {
  if (!walk.startedAt) return 0;
  return Math.max(0, Math.floor((now.getTime() - new Date(walk.startedAt).getTime()) / 60_000));
}

/**
 * Totals for the week containing `day`.
 * @param {Walk[]} walks
 * @param {string} day
 * @param {1|7} weekStart
 */
export function weekTotals(walks, day, weekStart) {
  const from = startOfWeek(day, weekStart);
  const to = addDays(from, 6);
  const done = walks.filter((w) => w.status === 'done' && w.date >= from && w.date <= to);
  return {
    count: done.length,
    minutes: done.reduce((s, w) => s + (w.durationMin || 0), 0),
    steps: done.reduce((s, w) => s + (w.steps || 0), 0),
    km: Math.round(done.reduce((s, w) => s + (w.distanceKm || 0), 0) * 10) / 10,
  };
}

/**
 * Visit count and last visit per place.
 * @param {Walk[]} walks
 * @returns {Map<string, { visits: number, last: string|null }>}
 */
export function placeStats(walks) {
  const map = new Map();
  for (const w of walks) {
    if (w.status !== 'done' || !w.placeId) continue;
    const s = map.get(w.placeId) ?? { visits: 0, last: null };
    s.visits++;
    if (!s.last || w.date > s.last) s.last = w.date;
    map.set(w.placeId, s);
  }
  return map;
}

/** Place of the most recent walk (default for a new walk). @param {Walk[]} walks */
export function lastPlaceId(walks) {
  return [...walks].filter((w) => w.placeId).sort((a, b) => `${b.date}${b.startedAt ?? ''}`.localeCompare(`${a.date}${a.startedAt ?? ''}`))[0]?.placeId ?? null;
}

/**
 * @param {{ durationMin: number|string, steps?: number|string|null, distanceKm?: number|string|null, date: string }} form
 * @returns {Record<string, string>}
 */
export function validateWalk(form) {
  /** @type {Record<string, string>} */
  const errors = {};
  const d = Number(form.durationMin);
  if (!(d > 0 && d <= 24 * 60)) errors.duration = 'walks.errors.duration';
  if (form.steps !== null && form.steps !== undefined && form.steps !== '' && !(Number(form.steps) >= 0)) errors.steps = 'walks.errors.number';
  if (form.distanceKm !== null && form.distanceKm !== undefined && form.distanceKm !== '' && !(Number(form.distanceKm) >= 0)) errors.distance = 'walks.errors.number';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) errors.date = 'form.errors.date';
  return errors;
}
