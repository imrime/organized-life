// @ts-check
// Medication schedule logic (pure). docs/spec/rooms/bedroom.md B6, docs/spec/04-data-model.md §3.7.

import { addDays, combine, diffDays, isValidLocalDate, isValidTime, weekday } from '../../core/time.js';

/**
 * @typedef {{
 *   id: string, name: string, form: string, dose: string,
 *   schedule: { type: 'daily'|'weekdays'|'interval'|'as_needed', times: string[], days?: number[], everyNDays?: number, startDate: string, endDate?: string|null },
 *   instructions?: string, stock?: number|null, dosePerIntake?: number, refillAt?: number|null, color: string, active: boolean,
 * }} Medication
 * @typedef {{ id: string, medicationId: string, date: string, scheduledTime?: string|null, status: 'taken'|'skipped', at: string, note?: string }} DoseLog
 * @typedef {'upcoming'|'due'|'overdue'|'missed'|'taken'|'skipped'} DoseState
 */

/** Deterministic id of a scheduled dose log. */
export const doseId = (/** @type {string} */ medId, /** @type {string} */ date, /** @type {string} */ time) => `${medId}:${date}:${time}`;

/** @param {Medication} med @param {string} date */
export function scheduledOn(med, date) {
  const s = med.schedule;
  if (!med.active || s.type === 'as_needed') return false;
  if (date < s.startDate || (s.endDate && date > s.endDate)) return false;
  if (s.type === 'weekdays') return (s.days ?? []).includes(weekday(date));
  if (s.type === 'interval') return diffDays(s.startDate, date) % Math.max(2, s.everyNDays ?? 2) === 0;
  return true;
}

/**
 * Scheduled doses of a date, sorted by time.
 * @param {Medication[]} meds
 * @param {string} date
 * @returns {{ med: Medication, time: string }[]}
 */
export function dosesOn(meds, date) {
  return meds
    .filter((med) => scheduledOn(med, date))
    .flatMap((med) => [...new Set(med.schedule.times)].map((time) => ({ med, time })))
    .sort((a, b) => a.time.localeCompare(b.time) || a.med.name.localeCompare(b.med.name));
}

/**
 * @param {Medication} med
 * @param {string} date
 * @param {string} time
 * @param {(id: string) => DoseLog|undefined} logOf
 * @param {Date} now
 * @returns {DoseState}
 */
export function doseState(med, date, time, logOf, now) {
  const log = logOf(doseId(med.id, date, time));
  if (log) return log.status;
  const diff = now.getTime() - combine(date, time).getTime();
  const sameDayEnd = combine(addDays(date, 1), '00:00').getTime();
  if (now.getTime() >= sameDayEnd) return 'missed';
  if (diff < -60 * 60_000) return 'upcoming';
  if (diff <= 60 * 60_000) return 'due';
  return 'overdue';
}

/**
 * Counts for the tray badge and art.
 * @param {Medication[]} meds
 * @param {string} date
 * @param {(id: string) => DoseLog|undefined} logOf
 * @param {Date} now
 */
export function todaySummary(meds, date, logOf, now) {
  const doses = dosesOn(meds, date);
  const states = doses.map((d) => doseState(d.med, date, d.time, logOf, now));
  return {
    total: doses.length,
    handled: states.filter((s) => s === 'taken' || s === 'skipped').length,
    due: states.filter((s) => s === 'due').length,
    overdue: states.filter((s) => s === 'overdue').length,
  };
}

/**
 * Taken on schedule over a period ending yesterday or today.
 * @param {Medication[]} meds
 * @param {string} from
 * @param {string} to
 * @param {(id: string) => DoseLog|undefined} logOf
 */
export function adherence(meds, from, to, logOf) {
  let scheduled = 0;
  let taken = 0;
  for (let date = from; date <= to; date = addDays(date, 1)) {
    for (const { med, time } of dosesOn(meds, date)) {
      scheduled++;
      if (logOf(doseId(med.id, date, time))?.status === 'taken') taken++;
    }
  }
  return { scheduled, taken };
}

/** Whether stock has reached the refill threshold. @param {Medication} med */
export function needsRefill(med) {
  return med.active && typeof med.stock === 'number' && typeof med.refillAt === 'number' && med.stock <= med.refillAt;
}

/**
 * @param {Record<string, any>} form
 * @returns {Record<string, string>}
 */
export function validateMedication(form) {
  /** @type {Record<string, string>} */
  const errors = {};
  if (!form.name.trim()) errors.name = 'form.errors.required';
  if (!form.dose.trim()) errors.dose = 'form.errors.required';
  if (form.type !== 'as_needed') {
    const times = form.times.filter(Boolean);
    if (!times.length || times.some((/** @type {string} */ x) => !isValidTime(x))) errors.times = 'meds.errors.times';
    else if (new Set(times).size !== times.length) errors.times = 'meds.errors.duplicateTimes';
  }
  if (form.type === 'weekdays' && !form.days.length) errors.days = 'meds.errors.days';
  if (form.type === 'interval' && !(form.everyNDays >= 2 && form.everyNDays <= 30)) errors.everyNDays = 'meds.errors.interval';
  if (!isValidLocalDate(form.startDate)) errors.startDate = 'form.errors.date';
  if (form.endDate && (!isValidLocalDate(form.endDate) || form.endDate < form.startDate)) errors.endDate = 'meds.errors.endDate';
  for (const key of ['stock', 'dosePerIntake', 'refillAt']) {
    if (form[key] !== '' && form[key] !== null && !(Number(form[key]) >= 0)) errors[key] = 'meds.errors.number';
  }
  return errors;
}

/**
 * Dose reminders within [from, to].
 * @param {Medication[]} meds
 * @param {Date} from
 * @param {Date} to
 * @param {(d: Date) => string} toLocal
 */
export function doseReminders(meds, from, to, toLocal) {
  /** @type {{ med: Medication, date: string, time: string, at: Date }[]} */
  const out = [];
  for (let date = toLocal(from); date <= toLocal(to); date = addDays(date, 1)) {
    for (const { med, time } of dosesOn(meds, date)) {
      const at = combine(date, time);
      if (at >= from && at <= to) out.push({ med, date, time, at });
    }
  }
  return out;
}
