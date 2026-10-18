// @ts-check
// Sleep logic (pure). docs/spec/rooms/bedroom.md B3.

import { addDays, combine, isValidLocalDate, isValidTime, parseTime, toLocalDate, nowTime, minutesToTime } from '../../core/time.js';

/**
 * @typedef {{ bedtime: string, wakeTime: string, windDownMin: number, linkAlarm: boolean, alarmDays: number[], bedtimeRoutineId: string|null, pendingBedAt?: string|null }} SleepPlan
 * @typedef {{ id: string, date: string, bedAt: string, wakeAt: string, quality?: number|null, notes?: string }} SleepLog
 */

/** Minutes between bedtime and wake time (wraps past midnight). @param {string} bedtime @param {string} wakeTime */
export function goalMinutes(bedtime, wakeTime) {
  return (((parseTime(wakeTime) - parseTime(bedtime)) % 1440) + 1440) % 1440;
}

/** "YYYY-MM-DDTHH:MM" → Date (local). @param {string} value */
export function parseLocalDateTime(value) {
  const [date, time] = String(value ?? '').split('T');
  if (!isValidLocalDate(date) || !isValidTime(time)) return null;
  return combine(date, time);
}

/** @param {Date} d */
export function toLocalDateTime(d) {
  return `${toLocalDate(d)}T${nowTime(d)}`;
}

/** @param {string} bedAt @param {string} wakeAt */
export function durationMinutes(bedAt, wakeAt) {
  const a = parseLocalDateTime(bedAt);
  const b = parseLocalDateTime(wakeAt);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}

/**
 * @param {{ bedAt: string, wakeAt: string }} log
 * @returns {Record<string, string>}
 */
export function validateLog(log) {
  /** @type {Record<string, string>} */
  const errors = {};
  if (!parseLocalDateTime(log.bedAt)) errors.bedAt = 'form.errors.date';
  if (!parseLocalDateTime(log.wakeAt)) errors.wakeAt = 'form.errors.date';
  if (Object.keys(errors).length) return errors;
  const minutes = /** @type {number} */ (durationMinutes(log.bedAt, log.wakeAt));
  if (minutes <= 0) errors.wakeAt = 'sleep.errors.wakeBeforeBed';
  else if (minutes > 16 * 60) errors.wakeAt = 'sleep.errors.tooLong';
  return errors;
}

/** Default "last night" for the log form. @param {SleepPlan} plan @param {string} day today */
export function defaultLog(plan, day) {
  const bedDay = parseTime(plan.bedtime) >= 12 * 60 ? addDays(day, -1) : day;
  return { bedAt: `${bedDay}T${plan.bedtime}`, wakeAt: `${day}T${plan.wakeTime}`, quality: /** @type {number|null} */ (null), notes: '' };
}

/** Morning date of a night = date part of wake time. @param {string} wakeAt */
export const morningOf = (wakeAt) => wakeAt.slice(0, 10);

/**
 * Average duration over the last `days` mornings (null when no logs).
 * @param {SleepLog[]} logs
 * @param {string} day
 * @param {number} [days]
 */
export function averageMinutes(logs, day, days = 7) {
  const from = addDays(day, -days + 1);
  const values = logs.filter((l) => l.date >= from && l.date <= day).map((l) => durationMinutes(l.bedAt, l.wakeAt) ?? 0);
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

/**
 * True between wind-down start and wake time (wraps past midnight).
 * @param {Date} now
 * @param {SleepPlan} plan
 */
export function inNightWindow(now, plan) {
  const start = (parseTime(plan.bedtime) - (plan.windDownMin || 0) + 1440) % 1440;
  const end = parseTime(plan.wakeTime);
  const m = now.getHours() * 60 + now.getMinutes();
  return start <= end ? m >= start && m < end : m >= start || m < end;
}

/**
 * Bed art state: turned down in the night window, ✓ for the morning after a log, made otherwise.
 * @param {Date} now
 * @param {SleepPlan} plan
 * @param {SleepLog[]} logs
 */
export function bedState(now, plan, logs) {
  if (inNightWindow(now, plan)) return 'turned-down';
  if (now.getHours() < 12 && logs.some((l) => l.date === toLocalDate(now))) return 'slept';
  return 'made';
}

/** Wind-down reminder time. @param {SleepPlan} plan */
export function windDownTime(plan) {
  return minutesToTime(parseTime(plan.bedtime) - (plan.windDownMin || 0));
}

/**
 * Whether the morning "Good morning" prompt should show for a pending night.
 * @param {SleepPlan} plan
 * @param {Date} now
 */
export function morningDue(plan, now) {
  const bed = plan.pendingBedAt ? parseLocalDateTime(plan.pendingBedAt) : null;
  if (!bed) return false;
  const hours = (now.getTime() - bed.getTime()) / 3_600_000;
  if (hours < 3) return false;
  return hours > 10 || now.getHours() * 60 + now.getMinutes() >= parseTime(plan.wakeTime) - 60;
}
