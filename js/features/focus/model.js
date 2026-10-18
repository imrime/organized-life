// @ts-check
// Focus sessions (pure): timestamp-based timer that survives reloads, breaks, totals (docs/spec/rooms/study.md S4).

import { startOfWeek, addDays, toLocalDate } from '../../core/time.js';

/**
 * @typedef {{
 *   id: string, taskId?: string|null, moduleId?: string|null, plannedMin: number, breakMin: number, startedAt: string,
 *   pausedAt?: string|null, pausedTotalSec: number, endedAt?: string|null, status: 'running'|'paused'|'completed'|'aborted',
 *   actualMin?: number|null, breakStartedAt?: string|null, breakEndedAt?: string|null, note?: string,
 * }} FocusSession
 */

export const PRESETS = [
  { key: '25', focus: 25, break: 5 },
  { key: '50', focus: 50, break: 10 },
];

const ms = (/** @type {string} */ iso) => new Date(iso).getTime();

/** Seconds of focus done so far (pauses excluded). @param {FocusSession} s @param {Date} now */
export function focusElapsedSec(s, now) {
  const until = s.status === 'paused' && s.pausedAt ? ms(s.pausedAt) : s.endedAt ? ms(s.endedAt) : now.getTime();
  return Math.max(0, Math.floor((until - ms(s.startedAt)) / 1000) - (s.pausedTotalSec || 0));
}

/** @param {FocusSession} s @param {Date} now */
export function focusRemainingSec(s, now) {
  return Math.max(0, s.plannedMin * 60 - focusElapsedSec(s, now));
}

/** When a running session will end (ISO). @param {FocusSession} s */
export function plannedEnd(s) {
  return new Date(ms(s.startedAt) + (s.plannedMin * 60 + (s.pausedTotalSec || 0)) * 1000).toISOString();
}

/** A running session whose planned time has passed. @param {FocusSession} s @param {Date} now */
export function isFocusOver(s, now) {
  return s.status === 'running' && focusRemainingSec(s, now) === 0;
}

/** @param {FocusSession} s @param {Date} now */
export function breakRemainingSec(s, now) {
  if (!s.breakStartedAt || s.breakEndedAt) return 0;
  return Math.max(0, s.breakMin * 60 - Math.floor((now.getTime() - ms(s.breakStartedAt)) / 1000));
}

/**
 * Stopping early: aborted below 50 % of the plan, otherwise completed with the minutes actually done.
 * @param {FocusSession} s
 * @param {Date} now
 */
export function stopOutcome(s, now) {
  const done = focusElapsedSec(s, now);
  return done < (s.plannedMin * 60) / 2 ? { status: /** @type {const} */ ('aborted'), actualMin: Math.round(done / 60) } : { status: /** @type {const} */ ('completed'), actualMin: Math.max(1, Math.round(done / 60)) };
}

/** The session currently in use (running or paused). @param {FocusSession[]} sessions */
export function activeFocus(sessions) {
  return sessions.find((s) => s.status === 'running' || s.status === 'paused');
}

/** A completed session whose break is running or still to be decided. @param {FocusSession[]} sessions */
export function sessionOnBreak(sessions) {
  return sessions.find((s) => s.status === 'completed' && s.breakStartedAt && !s.breakEndedAt);
}

/** Minutes a completed session counts for. @param {FocusSession} s */
export const minutesOf = (s) => (s.status === 'completed' ? s.actualMin ?? s.plannedMin : 0);

/** Day of a session (local). @param {FocusSession} s */
export const dayOf = (s) => toLocalDate(new Date(s.startedAt));

/**
 * @param {FocusSession[]} sessions
 * @param {string} today
 * @param {1|7} weekStart
 */
export function focusTotals(sessions, today, weekStart) {
  const from = startOfWeek(today, weekStart);
  const to = addDays(from, 6);
  let day = 0;
  let week = 0;
  for (const s of sessions) {
    const d = dayOf(s);
    if (d === today) day += minutesOf(s);
    if (d >= from && d <= to) week += minutesOf(s);
  }
  return { day, week };
}

/** Clamp custom durations to the spec's limits. @param {number} focus @param {number} brk */
export function clampDurations(focus, brk) {
  return { focus: Math.min(120, Math.max(5, Math.round(focus))), break: Math.min(30, Math.max(1, Math.round(brk))) };
}
