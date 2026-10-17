// @ts-check
import { describe, it, expect } from '../harness.js';
import { nextOccurrence, nextAlarm, effectiveNext, alarmInstances, repeatSummary, validateAlarm, instanceKey } from '../../js/features/alarms/model.js';

/** @param {Partial<import('../../js/features/alarms/model.js').Alarm> & {updatedAt?: string}} a */
const alarm = (a) => /** @type {any} */ ({ id: 'a', time: '07:00', repeatDays: [], label: '', sound: 'chime', vibrate: true, snoozeMin: 10, enabled: true, primary: false, order: 0, ...a });

// Saturday 17 Oct 2026, 22:00 local
const SAT_EVENING = new Date(2026, 9, 17, 22, 0);

describe('alarms: next occurrence', () => {
  it('one-shot alarm rings tomorrow when today’s time has passed', () => {
    const at = nextOccurrence(alarm({ time: '07:00' }), SAT_EVENING);
    expect(at?.getDate()).toBe(18);
    expect(at?.getHours()).toBe(7);
  });
  it('one-shot alarm rings today when still ahead', () => {
    expect(nextOccurrence(alarm({ time: '23:30' }), SAT_EVENING)?.getDate()).toBe(17);
  });
  it('repeating alarm skips to the next selected weekday', () => {
    const at = nextOccurrence(alarm({ time: '06:45', repeatDays: [1, 3, 5] }), SAT_EVENING);
    expect(at?.getDate()).toBe(19); // Monday
    expect(at?.getMinutes()).toBe(45);
  });
  it('disabled alarms never ring', () => {
    expect(nextOccurrence(alarm({ enabled: false }), SAT_EVENING)).toBe(null);
  });
  it('picks the earliest alarm across the list', () => {
    const next = nextAlarm([alarm({ id: 'x', time: '08:00', repeatDays: [7] }), alarm({ id: 'y', time: '23:15', repeatDays: [6] })], SAT_EVENING);
    expect(next?.alarm.id).toBe('y');
  });
  it('a one-shot alarm whose moment has passed is no longer upcoming', () => {
    const saved = alarm({ time: '21:00', updatedAt: new Date(2026, 9, 17, 20, 0).toISOString() });
    expect(effectiveNext(saved, SAT_EVENING)).toBe(null);
  });
});

describe('alarms: instances for the reminder engine', () => {
  it('produces one instance per selected day in range with stable keys', () => {
    const a = alarm({ id: 'r', time: '07:00', repeatDays: [1, 2, 3, 4, 5] });
    const list = alarmInstances([a], new Date(2026, 9, 17, 0, 0), new Date(2026, 9, 21, 23, 59));
    expect(list.map((i) => i.date)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21']);
    expect(instanceKey(a, list[0].date)).toBe('alarm:r:2026-10-19T07:00');
  });
  it('one-shot alarm yields its single occurrence after it was saved', () => {
    const a = alarm({ id: 'o', time: '06:30', updatedAt: new Date(2026, 9, 17, 22, 0).toISOString() });
    const list = alarmInstances([a], new Date(2026, 9, 17, 0, 0), new Date(2026, 9, 19, 0, 0));
    expect(list.length).toBe(1);
    expect(list[0].date).toBe('2026-10-18');
  });
});

describe('alarms: summaries and validation', () => {
  it('summarises repeat days', () => {
    expect(repeatSummary([]).key).toBe('alarms.repeat.once');
    expect(repeatSummary([1, 2, 3, 4, 5]).key).toBe('alarms.repeat.weekdays');
    expect(repeatSummary([6, 7]).key).toBe('alarms.repeat.weekends');
    expect(repeatSummary([7, 6, 5, 4, 3, 2, 1]).key).toBe('alarms.repeat.everyDay');
    expect(repeatSummary([3, 1]).days).toEqual([1, 3]);
  });
  it('validates time and label', () => {
    expect(validateAlarm({ time: '7:00' }).time).toBe('form.errors.time');
    expect(validateAlarm({ time: '07:00', label: 'x'.repeat(41) }).label).toBe('form.errors.tooLong');
    expect(validateAlarm({ time: '07:00', label: 'Wake up' })).toEqual({});
  });
});
