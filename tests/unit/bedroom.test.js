// @ts-check
import { describe, it, expect } from '../harness.js';
import { streak, history, isComplete, toggledRun, careSlotAt } from '../../js/features/routines/model.js';
import { goalMinutes, durationMinutes, validateLog, defaultLog, inNightWindow, bedState, morningDue, averageMinutes, windDownTime } from '../../js/features/sleep/model.js';
import { taskSections, attentionCount, validateTask, projectProgress, taskReminders, noteTitle } from '../../js/features/tasks/model.js';
import { dosesOn, doseState, adherence, needsRefill, validateMedication, doseId } from '../../js/features/meds/model.js';
import { laundryGroupFor, slotOf, wearInSlot } from '../../js/features/wardrobe/catalog.js';
import { buildBackup, parseBackup, mergeBackup } from '../../js/core/backup.js';

/** @param {any} r */
const routine = (r) => ({ id: 'r', name: '', owner: 'x', slot: 'bedtime', steps: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], days: [1, 2, 3, 4, 5, 6, 7], enabled: true, order: 0, ...r });
/** @param {Record<string, string[]>} done */
const runsFrom = (done) => (/** @type {string} */ date) => (done[date] ? { id: date, routineId: 'r', date, doneStepIds: done[date] } : undefined);

describe('routines', () => {
  it('counts a streak back from yesterday and includes today when done', () => {
    const r = routine({});
    const runs = runsFrom({ '2026-10-15': ['a', 'b'], '2026-10-16': ['a', 'b'], '2026-10-17': ['a', 'b'], '2026-10-18': ['a', 'b'] });
    expect(streak(r, runs, '2026-10-18')).toBe(4);
    expect(streak(r, runsFrom({ '2026-10-17': ['a', 'b'] }), '2026-10-18')).toBe(1);
  });
  it('skips inactive days and breaks on a missed active day', () => {
    const r = routine({ days: [1, 3, 5] }); // Mon, Wed, Fri
    const runs = runsFrom({ '2026-10-12': ['a', 'b'], '2026-10-14': ['a', 'b'], '2026-10-16': ['a', 'b'] });
    expect(streak(r, runs, '2026-10-18')).toBe(3); // Sun; Sat inactive
    expect(streak(r, runsFrom({ '2026-10-16': ['a', 'b'] }), '2026-10-18')).toBe(1);
  });
  it('builds a history with partial and inactive states', () => {
    const r = routine({ days: [1, 2, 3, 4, 5] });
    const h = history(r, runsFrom({ '2026-10-16': ['a'] }), '2026-10-18', 3);
    expect(h.map((d) => d.state)).toEqual(['partial', 'inactive', 'inactive']);
  });
  it('toggles steps and completion', () => {
    const r = routine({});
    const one = toggledRun(r, undefined, 'a', 'T');
    expect(one).toEqual({ doneStepIds: ['a'], completedAt: null });
    const both = toggledRun(r, /** @type {any} */ ({ ...one }), 'b', 'T');
    expect(both.completedAt).toBe('T');
    expect(isComplete(r, /** @type {any} */ ({ doneStepIds: both.doneStepIds }))).toBe(true);
  });
  it('picks the care slot by time of day', () => {
    expect(careSlotAt(new Date(2026, 9, 18, 7))).toBe('morning');
    expect(careSlotAt(new Date(2026, 9, 18, 21))).toBe('evening');
  });
});

describe('sleep', () => {
  const plan = { bedtime: '23:00', wakeTime: '07:00', windDownMin: 30, linkAlarm: false, alarmDays: [], bedtimeRoutineId: null };
  it('computes goal and duration across midnight', () => {
    expect(goalMinutes('23:00', '07:00')).toBe(480);
    expect(durationMinutes('2026-10-17T23:40', '2026-10-18T07:00')).toBe(440);
  });
  it('validates nights', () => {
    expect(validateLog({ bedAt: '2026-10-18T07:00', wakeAt: '2026-10-18T06:00' }).wakeAt).toBe('sleep.errors.wakeBeforeBed');
    expect(validateLog({ bedAt: '2026-10-16T07:00', wakeAt: '2026-10-18T06:00' }).wakeAt).toBe('sleep.errors.tooLong');
    expect(validateLog({ bedAt: '2026-10-17T23:00', wakeAt: '2026-10-18T07:00' })).toEqual({});
  });
  it('defaults last night from the plan', () => {
    expect(defaultLog(plan, '2026-10-18')).toEqual({ bedAt: '2026-10-17T23:00', wakeAt: '2026-10-18T07:00', quality: null, notes: '' });
  });
  it('knows the night window and bed state', () => {
    expect(inNightWindow(new Date(2026, 9, 17, 22, 40), plan)).toBe(true);
    expect(inNightWindow(new Date(2026, 9, 18, 6, 0), plan)).toBe(true);
    expect(inNightWindow(new Date(2026, 9, 18, 12, 0), plan)).toBe(false);
    const logs = [{ id: 'l', date: '2026-10-18', bedAt: '2026-10-17T23:00', wakeAt: '2026-10-18T07:00' }];
    expect(bedState(new Date(2026, 9, 18, 9), plan, logs)).toBe('slept');
    expect(bedState(new Date(2026, 9, 18, 15), plan, logs)).toBe('made');
    expect(windDownTime(plan)).toBe('22:30');
  });
  it('shows the morning prompt only after a real night', () => {
    expect(morningDue({ ...plan, pendingBedAt: '2026-10-17T23:00' }, new Date(2026, 9, 18, 7, 5))).toBe(true);
    expect(morningDue({ ...plan, pendingBedAt: '2026-10-17T23:00' }, new Date(2026, 9, 18, 0, 30))).toBe(false);
    expect(morningDue(plan, new Date(2026, 9, 18, 8))).toBe(false);
  });
  it('averages the last nights', () => {
    const logs = [
      { id: 'a', date: '2026-10-17', bedAt: '2026-10-16T23:00', wakeAt: '2026-10-17T07:00' },
      { id: 'b', date: '2026-10-18', bedAt: '2026-10-17T23:00', wakeAt: '2026-10-18T06:00' },
    ];
    expect(averageMinutes(logs, '2026-10-18')).toBe(450);
  });
});

describe('tasks', () => {
  /** @param {any} x */
  const task = (x) => ({ id: x.title, notes: '', context: 'personal', status: 'todo', reminderOffsetMin: null, priority: 'normal', checklist: [], order: 0, ...x });
  const list = [
    task({ title: 'late', dueDate: '2026-10-16' }),
    task({ title: 'now', dueDate: '2026-10-18' }),
    task({ title: 'tmr', dueDate: '2026-10-19' }),
    task({ title: 'none' }),
    task({ title: 'hw', context: 'homework', dueDate: '2026-10-30' }),
    task({ title: 'done', status: 'done', dueDate: '2026-10-18', completedAt: 'x' }),
  ];
  it('groups open tasks by due state and filters', () => {
    expect(taskSections(list, '2026-10-18', 'all', null).map((s) => s.key)).toEqual(['overdue', 'today', 'tomorrow', 'later', 'none']);
    expect(taskSections(list, '2026-10-18', 'today', null).map((s) => s.items.map((x) => x.title))).toEqual([['late'], ['now']]);
    expect(taskSections(list, '2026-10-18', 'all', 'homework')[0].items[0].title).toBe('hw');
    expect(taskSections(list, '2026-10-18', 'done', null)[0].items[0].title).toBe('done');
  });
  it('counts what needs attention', () => {
    expect(attentionCount(list, '2026-10-18')).toEqual({ overdue: 1, dueToday: 1 });
  });
  it('validates', () => {
    expect(validateTask({ title: ' ', dueDate: '', dueTime: '', context: 'personal' }).title).toBe('form.errors.required');
    expect(validateTask({ title: 'x', dueDate: '', dueTime: '10:00', context: 'personal' }).dueTime).toBe('tasks.errors.timeNeedsDate');
  });
  it('tracks project progress', () => {
    const tasks = [task({ title: 'a', projectId: 'p', status: 'done' }), task({ title: 'b', projectId: 'p', dueDate: '2026-10-20' })];
    const p = projectProgress(/** @type {any} */ ({ id: 'p' }), tasks);
    expect([p.done, p.total, p.next?.title]).toEqual([1, 2, 'b']);
  });
  it('computes reminders (no time → 09:00)', () => {
    const r = taskReminders([task({ title: 'r', dueDate: '2026-10-18', reminderOffsetMin: 60 })], new Date(2026, 9, 18, 0), new Date(2026, 9, 18, 23));
    expect(r[0].at.getHours()).toBe(8);
  });
  it('titles notes by their first line', () => {
    expect(noteTitle(/** @type {any} */ ({ title: '', body: 'Shopping\nmilk' }))).toBe('Shopping');
  });
});

describe('medications', () => {
  /** @param {any} s */
  const med = (s, extra = {}) => ({ id: 'm', name: 'D', form: 'pill', dose: '1', color: 'blue', active: true, schedule: { times: ['08:00', '20:00'], startDate: '2026-10-01', ...s }, ...extra });
  it('schedules daily, weekday and interval doses', () => {
    expect(dosesOn([/** @type {any} */ (med({ type: 'daily' }))], '2026-10-18').map((d) => d.time)).toEqual(['08:00', '20:00']);
    expect(dosesOn([/** @type {any} */ (med({ type: 'weekdays', days: [1] }))], '2026-10-18')).toEqual([]);
    expect(dosesOn([/** @type {any} */ (med({ type: 'interval', everyNDays: 2 }))], '2026-10-03').length).toBe(2);
    expect(dosesOn([/** @type {any} */ (med({ type: 'interval', everyNDays: 2 }))], '2026-10-04').length).toBe(0);
    expect(dosesOn([/** @type {any} */ (med({ type: 'daily', endDate: '2026-10-10' }))], '2026-10-18')).toEqual([]);
  });
  it('derives dose states', () => {
    const m = /** @type {any} */ (med({ type: 'daily' }));
    const none = () => undefined;
    expect(doseState(m, '2026-10-18', '08:00', none, new Date(2026, 9, 18, 6, 30))).toBe('upcoming');
    expect(doseState(m, '2026-10-18', '08:00', none, new Date(2026, 9, 18, 8, 30))).toBe('due');
    expect(doseState(m, '2026-10-18', '08:00', none, new Date(2026, 9, 18, 11, 0))).toBe('overdue');
    expect(doseState(m, '2026-10-17', '08:00', none, new Date(2026, 9, 18, 1, 0))).toBe('missed');
    const taken = (/** @type {string} */ id) => (id === doseId('m', '2026-10-18', '08:00') ? /** @type {any} */ ({ status: 'taken' }) : undefined);
    expect(doseState(m, '2026-10-18', '08:00', taken, new Date(2026, 9, 18, 11, 0))).toBe('taken');
  });
  it('computes adherence and refill', () => {
    const m = /** @type {any} */ (med({ type: 'daily', times: ['08:00'] }));
    const logs = (/** @type {string} */ id) => (id.endsWith('2026-10-17:08:00') ? /** @type {any} */ ({ status: 'taken' }) : undefined);
    expect(adherence([m], '2026-10-16', '2026-10-17', logs)).toEqual({ scheduled: 2, taken: 1 });
    expect(needsRefill(/** @type {any} */ ({ ...m, stock: 3, refillAt: 5 }))).toBe(true);
  });
  it('validates the form', () => {
    const errors = validateMedication({ name: '', dose: '', type: 'weekdays', times: ['08:00', '08:00'], days: [], everyNDays: 2, startDate: '2026-10-01', endDate: '2026-09-01', stock: '-1', dosePerIntake: 1, refillAt: '' });
    expect(Object.keys(errors).sort()).toEqual(['days', 'dose', 'endDate', 'name', 'stock', 'times']);
  });
});

describe('wardrobe catalog', () => {
  it('maps colours to laundry groups and templates to slots', () => {
    expect(laundryGroupFor('white')).toBe('whites');
    expect(laundryGroupFor('navy')).toBe('darks');
    expect(laundryGroupFor('green')).toBe('colours');
    expect(slotOf('boots')).toBe('shoes');
  });
  it('a dress replaces top and bottom, and back', () => {
    expect(wearInSlot({ top: 't', bottom: 'b' }, 'dress', 'd')).toEqual({ top: null, bottom: null, dress: 'd' });
    expect(wearInSlot({ dress: 'd' }, 'top', 't')).toEqual({ dress: null, top: 't' });
  });
});

describe('backup', () => {
  const rec = (/** @type {string} */ id, /** @type {string} */ updatedAt) => ({ id, createdAt: 'a', updatedAt });
  it('round-trips and rejects foreign or newer files', () => {
    const backup = buildBackup({ alarms: [rec('a', '1')], reminderState: [rec('x', '1')] }, { schemaVersion: 1, appVersion: 't' });
    expect('reminderState' in backup.data).toBe(false);
    const parsed = parseBackup(JSON.stringify(backup), 1);
    expect(parsed.ok && parsed.counts.alarms).toBe(1);
    expect(parseBackup('{', 1).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...backup, schemaVersion: 9 }), 1).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'other', data: {} }), 1).ok).toBe(false);
  });
  it('skips invalid records', () => {
    const parsed = parseBackup(JSON.stringify({ app: 'organized-life', schemaVersion: 1, data: { tasks: [{ id: 1 }, rec('t', '1')] } }), 1);
    expect(parsed.ok && parsed.skipped).toBe(1);
  });
  it('merges by newest updatedAt', () => {
    const merged = mergeBackup({ tasks: [rec('a', '2026-01-02'), rec('b', '2026-01-01')] }, { tasks: [rec('a', '2026-01-01'), rec('b', '2026-01-03'), rec('c', '2026-01-01')] });
    expect(merged.tasks.map((r) => `${r.id}:${r.updatedAt}`).sort()).toEqual(['a:2026-01-02', 'b:2026-01-03', 'c:2026-01-01']);
  });
});
