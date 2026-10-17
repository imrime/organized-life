// @ts-check
// Alarm logic (pure). docs/spec/rooms/bedroom.md B1.

import { combine, isValidTime, toLocalDate, weekday, addDays, parseTime, minutesToTime } from '../../core/time.js';

/**
 * @typedef {{
 *   id: string, time: string, repeatDays: number[], label: string, sound: 'chime'|'birds'|'beep'|'rising',
 *   vibrate: boolean, snoozeMin: 5|10|15, enabled: boolean, primary: boolean, order: number,
 *   deletedAt?: string|null,
 * }} Alarm
 */

/** @param {Partial<Alarm>[]} existing */
export function defaultAlarm(existing = []) {
  const last = [...existing].sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))[0];
  return {
    time: last?.time ?? '07:00',
    repeatDays: /** @type {number[]} */ ([]),
    label: '',
    sound: /** @type {Alarm['sound']} */ ('chime'),
    vibrate: true,
    snoozeMin: /** @type {Alarm['snoozeMin']} */ (10),
    enabled: true,
    primary: false,
  };
}

/**
 * @param {Partial<Alarm>} draft
 * @returns {Record<string, string>} field → i18n error key
 */
export function validateAlarm(draft) {
  /** @type {Record<string, string>} */
  const errors = {};
  if (!isValidTime(draft.time)) errors.time = 'form.errors.time';
  if ((draft.label ?? '').length > 40) errors.label = 'form.errors.tooLong';
  return errors;
}

/**
 * Next ring time of one alarm strictly after `now` (null when disabled).
 * @param {Pick<Alarm, 'time'|'repeatDays'|'enabled'>} alarm
 * @param {Date} now
 * @returns {Date|null}
 */
export function nextOccurrence(alarm, now) {
  if (!alarm.enabled || !isValidTime(alarm.time)) return null;
  const today = toLocalDate(now);
  for (let i = 0; i <= 7; i++) {
    const date = addDays(today, i);
    if (alarm.repeatDays.length && !alarm.repeatDays.includes(weekday(date))) continue;
    const at = combine(date, alarm.time);
    if (at.getTime() > now.getTime()) return at;
  }
  return null;
}

/**
 * Upcoming ring time as the engine sees it: one-shot alarms ring once, at their first occurrence after being saved.
 * @param {Alarm} alarm
 * @param {Date} now
 * @returns {Date|null}
 */
export function effectiveNext(alarm, now) {
  if (alarm.repeatDays.length) return nextOccurrence(alarm, now);
  const at = nextOccurrence(alarm, new Date(/** @type {any} */ (alarm).updatedAt ?? now));
  return at && at > now ? at : null;
}

/**
 * Earliest upcoming alarm across a list.
 * @param {Alarm[]} alarms
 * @param {Date} now
 * @returns {{ alarm: Alarm, at: Date }|null}
 */
export function nextAlarm(alarms, now) {
  /** @type {{ alarm: Alarm, at: Date }|null} */
  let best = null;
  for (const alarm of alarms) {
    const at = effectiveNext(alarm, now);
    if (at && (!best || at < best.at)) best = { alarm, at };
  }
  return best;
}

/**
 * Ring instances of all enabled alarms within [from, to] (for the reminder engine).
 * One-shot alarms ring once: at their next occurrence after they were last saved.
 * @param {Alarm[]} alarms
 * @param {Date} from
 * @param {Date} to
 */
export function alarmInstances(alarms, from, to) {
  /** @type {{ alarm: Alarm, at: Date, date: string }[]} */
  const out = [];
  for (const alarm of alarms) {
    if (!alarm.enabled || !isValidTime(alarm.time)) continue;
    if (!alarm.repeatDays.length) {
      const savedAt = new Date(/** @type {any} */ (alarm).updatedAt ?? 0);
      const at = nextOccurrence(alarm, savedAt);
      if (at && at >= from && at <= to) out.push({ alarm, at, date: toLocalDate(at) });
      continue;
    }
    for (let date = toLocalDate(from); date <= toLocalDate(to); date = addDays(date, 1)) {
      if (!alarm.repeatDays.includes(weekday(date))) continue;
      const at = combine(date, alarm.time);
      if (at >= from && at <= to) out.push({ alarm, at, date });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** @param {{ id: string, time: string }} alarm @param {string} date */
export function instanceKey(alarm, date) {
  return `alarm:${alarm.id}:${date}T${alarm.time}`;
}

/**
 * Human summary of repeat days.
 * @param {number[]} days
 * @returns {{ key: string, days?: number[] }} i18n key, or a list of days to print
 */
export function repeatSummary(days) {
  const set = [...new Set(days)].sort((a, b) => a - b);
  if (!set.length) return { key: 'alarms.repeat.once' };
  if (set.length === 7) return { key: 'alarms.repeat.everyDay' };
  if (set.join() === '1,2,3,4,5') return { key: 'alarms.repeat.weekdays' };
  if (set.join() === '6,7') return { key: 'alarms.repeat.weekends' };
  return { key: 'alarms.repeat.days', days: set };
}

/** Repeat presets offered next to the day toggles. */
export const REPEAT_PRESETS = /** @type {const} */ ({
  once: [],
  everyDay: [1, 2, 3, 4, 5, 6, 7],
  weekdays: [1, 2, 3, 4, 5],
  weekends: [6, 7],
});

/**
 * Splits a positive duration into hours/minutes for "in 7 h 20 min".
 * @param {Date} at
 * @param {Date} now
 */
export function timeUntil(at, now) {
  const minutes = Math.max(0, Math.ceil((at.getTime() - now.getTime()) / 60_000));
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

/**
 * Snooze target time.
 * @param {Date} now
 * @param {number} minutes
 */
export function snoozeUntil(now, minutes) {
  return new Date(now.getTime() + minutes * 60_000);
}

/** @param {string} time @param {number} minutes */
export function shiftTime(time, minutes) {
  return minutesToTime(parseTime(time) + minutes);
}
