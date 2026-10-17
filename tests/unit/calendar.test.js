// @ts-check
import { describe, it, expect } from '../harness.js';
import { occurrences, agenda, monthGrid, validateEvent, defaultEvent, eventReminders, eventFromForm } from '../../js/features/calendar/model.js';
import { toLocalDate } from '../../js/core/time.js';

/** @param {any} e */
const ev = (e) => ({ id: 'e', title: 'T', kind: 'event', date: '2026-10-17', allDay: false, start: '14:00', end: '15:00', recurrence: null, reminderOffsetMin: null, ...e });

describe('calendar: recurrence', () => {
  it('returns a single date for non-recurring events in range', () => {
    expect(occurrences(ev({}), '2026-10-01', '2026-10-31')).toEqual(['2026-10-17']);
    expect(occurrences(ev({}), '2026-11-01', '2026-11-30')).toEqual([]);
  });
  it('expands daily with interval and until', () => {
    const e = ev({ recurrence: { freq: 'daily', interval: 2, until: '2026-10-23' } });
    expect(occurrences(e, '2026-10-01', '2026-10-31')).toEqual(['2026-10-17', '2026-10-19', '2026-10-21', '2026-10-23']);
  });
  it('expands weekly on chosen weekdays and skips excluded dates', () => {
    const e = ev({ date: '2026-10-19', recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 3], exDates: ['2026-10-21'] } });
    expect(occurrences(e, '2026-10-19', '2026-11-01')).toEqual(['2026-10-19', '2026-10-26', '2026-10-28']);
  });
  it('weekly defaults to the start weekday', () => {
    const e = ev({ recurrence: { freq: 'weekly', interval: 1 } });
    expect(occurrences(e, '2026-10-01', '2026-11-08')).toEqual(['2026-10-17', '2026-10-24', '2026-10-31', '2026-11-07']);
  });
  it('monthly on the 31st clamps to the last day of shorter months', () => {
    const e = ev({ date: '2026-01-31', recurrence: { freq: 'monthly', interval: 1 } });
    expect(occurrences(e, '2026-02-01', '2026-04-30')).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
  });
  it('yearly keeps the date (Feb 29 → Feb 28 in common years)', () => {
    const e = ev({ date: '2028-02-29', recurrence: { freq: 'yearly', interval: 1 } });
    expect(occurrences(e, '2029-01-01', '2029-12-31')).toEqual(['2029-02-28']);
  });
});

describe('calendar: agenda and grid', () => {
  it('merges events and due tasks, all-day first then by time', () => {
    const map = agenda(
      [ev({ id: 'a', title: 'Late', start: '18:00', end: '19:00' }), ev({ id: 'b', title: 'Holiday', allDay: true, start: null, end: null })],
      [{ id: 't', title: 'Pay rent', dueDate: '2026-10-17', dueTime: '09:00', status: 'todo' }],
      '2026-10-17',
      '2026-10-17',
    );
    const day = map.get('2026-10-17') ?? [];
    expect(day.map((i) => (i.type === 'event' ? i.event.title : i.task.title))).toEqual(['Holiday', 'Pay rent', 'Late']);
  });
  it('builds a 6-week grid starting on the configured weekday', () => {
    const monday = monthGrid(2026, 10, 1);
    expect(monday.length).toBe(42);
    expect(monday[0]).toBe('2026-09-28');
    expect(monthGrid(2026, 10, 7)[0]).toBe('2026-09-27');
  });
});

describe('calendar: validation and reminders', () => {
  it('requires a title and an end after the start', () => {
    const form = { ...defaultEvent('2026-10-17', new Date(2026, 9, 17, 10)), title: '', start: '15:00', end: '14:00' };
    const errors = validateEvent(form);
    expect(errors.title).toBe('form.errors.required');
    expect(errors.end).toBe('calendar.errors.endBeforeStart');
  });
  it('turns a weekly form without days into the start weekday', () => {
    const form = { ...defaultEvent('2026-10-17', new Date(2026, 9, 17, 10)), title: 'Gym', repeat: /** @type {const} */ ('weekly') };
    expect(eventFromForm(form).recurrence?.byWeekday).toEqual([6]);
  });
  it('computes reminder instants, all-day ones from 09:00', () => {
    const timed = ev({ id: 't', reminderOffsetMin: 30 });
    const allDay = ev({ id: 'd', allDay: true, start: null, end: null, date: '2026-10-18', reminderOffsetMin: 1440 });
    const list = eventReminders([timed, allDay], new Date(2026, 9, 17, 0, 0), new Date(2026, 9, 18, 0, 0), toLocalDate);
    const byId = Object.fromEntries(list.map((r) => [r.event.id, r.at]));
    expect(byId.t.getHours()).toBe(13);
    expect(byId.t.getMinutes()).toBe(30);
    expect(byId.d.getDate()).toBe(17);
    expect(byId.d.getHours()).toBe(9);
  });
});
