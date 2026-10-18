// @ts-check
import { describe, it, expect } from '../harness.js';
import { nextAction, assignmentSections, dueCounts, classesOn, deadlines, upcomingExams, validateClass, validateModule, folders } from '../../js/features/study/model.js';
import { focusElapsedSec, focusRemainingSec, plannedEnd, isFocusOver, stopOutcome, breakRemainingSec, focusTotals, clampDurations } from '../../js/features/focus/model.js';
import { isAvailable, filterExercises, substitutes, epley, records, newRecords, sessionStats, weeklyCounts, heatmap, displayWeight, toKg, suggestions, plansFor, lastSets, trend } from '../../js/features/workouts/model.js';

/** @param {any} x */
const task = (x) => ({ id: 't', title: 'T', context: 'study', status: 'todo', dueDate: null, moduleId: 'm', ...x });
/** @param {any} x */
const ev = (x) => ({ id: 'e', title: 'E', kind: 'class', date: '2026-09-01', allDay: false, start: '10:00', end: '11:30', recurrence: null, reminderOffsetMin: null, moduleId: 'm', ...x });

describe('study', () => {
  it('uses the override or the earliest open assignment as next action', () => {
    const tasks = [task({ id: 'a', title: 'Essay', dueDate: '2026-10-25' }), task({ id: 'b', title: 'Quiz', dueDate: '2026-10-20' }), task({ id: 'c', title: 'Old', status: 'done', dueDate: '2026-10-01' })];
    expect(nextAction(/** @type {any} */ ({ id: 'm', nextActionOverride: '' }), tasks)?.text).toBe('Quiz');
    expect(nextAction(/** @type {any} */ ({ id: 'm', nextActionOverride: 'Email tutor' }), tasks)?.text).toBe('Email tutor');
    expect(nextAction(/** @type {any} */ ({ id: 'x', nextActionOverride: '' }), tasks)).toBe(null);
  });
  it('groups assignments and counts due ones', () => {
    const tasks = [task({ id: 'o', dueDate: '2026-10-15' }), task({ id: 'w', dueDate: '2026-10-20' }), task({ id: 'l', dueDate: '2026-11-20' }), task({ id: 'n' }), task({ id: 'd', status: 'done' }), task({ id: 'p', context: 'personal', dueDate: '2026-10-19' })];
    expect(assignmentSections(tasks, '2026-10-18').map((s) => `${s.key}:${s.items.length}`)).toEqual(['overdue:1', 'week:1', 'later:1', 'nodate:1', 'done:1']);
    expect(dueCounts(tasks, '2026-10-18')).toEqual({ overdue: 1, soon: 1 });
  });
  it('places weekly classes on their weekdays until the term ends', () => {
    const cls = ev({ recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 3], until: '2026-12-18', exDates: [] } });
    expect(classesOn([cls], '2026-10-19').length).toBe(1); // Monday
    expect(classesOn([cls], '2026-10-21').length).toBe(1); // Wednesday
    expect(classesOn([cls], '2026-10-20').length).toBe(0); // Tuesday
    expect(classesOn([cls], '2026-12-21').length).toBe(0); // after term end
  });
  it('merges deadlines and lists upcoming exams', () => {
    const list = deadlines([task({ id: 'a', dueDate: '2026-10-25' })], [ev({ id: 'd', kind: 'deadline', date: '2026-10-22', recurrence: null })], '2026-10-18');
    expect(list.map((d) => d.key)).toEqual(['e:d:2026-10-22', 't:a']);
    const exams = upcomingExams([ev({ id: 'x', kind: 'exam', date: '2026-11-05' }), ev({ id: 'y', kind: 'exam', date: '2026-10-01' })], '2026-10-18');
    expect(exams.map((x) => x.event.id)).toEqual(['x']);
  });
  it('validates classes and modules, and builds folders', () => {
    expect(validateClass({ moduleId: '', days: [], start: '11:00', end: '10:00' })).toEqual({ moduleId: 'study.errors.module', days: 'study.errors.days', time: 'calendar.errors.endBeforeStart' });
    expect(validateModule({ name: 'Maths', links: [{ label: 'x', url: 'javascript:1' }] }).links).toBe('media.errors.link');
    const f = folders(/** @type {any} */ ([{ id: 'm', archived: false }, { id: 'z', archived: true }]), /** @type {any} */ ([{ moduleId: 'm', status: 'reading' }, { moduleId: null, status: 'to_read' }]), [{ context: 'study', moduleId: 'm' }, { context: 'personal', moduleId: null }]);
    expect(f.map((x) => `${x.id}:${x.resources}:${x.notes}:${x.reading}`)).toEqual(['m:1:1:1', 'null:1:0:0']);
  });
});

describe('focus', () => {
  const base = { id: 'f', plannedMin: 25, breakMin: 5, startedAt: '2026-10-18T10:00:00.000Z', pausedTotalSec: 0, status: /** @type {const} */ ('running') };
  it('counts time excluding pauses and survives reloads', () => {
    expect(focusElapsedSec(base, new Date('2026-10-18T10:10:00Z'))).toBe(600);
    expect(focusRemainingSec({ ...base, pausedTotalSec: 120 }, new Date('2026-10-18T10:10:00Z'))).toBe(25 * 60 - 480);
    expect(focusElapsedSec({ ...base, status: 'paused', pausedAt: '2026-10-18T10:05:00.000Z' }, new Date('2026-10-18T11:00:00Z'))).toBe(300);
    expect(plannedEnd({ ...base, pausedTotalSec: 60 })).toBe('2026-10-18T10:26:00.000Z');
    expect(isFocusOver(base, new Date('2026-10-18T10:25:00Z'))).toBe(true);
    expect(isFocusOver(base, new Date('2026-10-18T10:24:59Z'))).toBe(false);
  });
  it('stops as aborted under half, completed otherwise', () => {
    expect(stopOutcome(base, new Date('2026-10-18T10:10:00Z'))).toEqual({ status: 'aborted', actualMin: 10 });
    expect(stopOutcome(base, new Date('2026-10-18T10:20:00Z'))).toEqual({ status: 'completed', actualMin: 20 });
  });
  it('times breaks and totals the day and week', () => {
    expect(breakRemainingSec({ ...base, status: 'completed', breakStartedAt: '2026-10-18T10:25:00.000Z' }, new Date('2026-10-18T10:27:00Z'))).toBe(180);
    const sessions = /** @type {any[]} */ ([
      { ...base, status: 'completed', actualMin: 25, startedAt: new Date(2026, 9, 18, 9).toISOString() },
      { ...base, status: 'completed', actualMin: null, plannedMin: 50, startedAt: new Date(2026, 9, 13, 9).toISOString() },
      { ...base, status: 'aborted', actualMin: 5, startedAt: new Date(2026, 9, 18, 11).toISOString() },
    ]);
    expect(focusTotals(sessions, '2026-10-18', 1)).toEqual({ day: 25, week: 75 });
    expect(clampDurations(200, 0)).toEqual({ focus: 120, break: 1 });
  });
});

describe('workouts', () => {
  const ex = /** @type {any[]} */ ([
    { id: 'push', type: 'strength', metric: 'reps', equipment: ['none'], muscles: ['chest'], substitutionIds: ['bench'] },
    { id: 'bench', type: 'strength', metric: 'reps', equipment: ['barbell'], muscles: ['chest'], substitutionIds: [] },
    { id: 'dbp', type: 'strength', metric: 'reps', equipment: ['dumbbells'], muscles: ['chest'], substitutionIds: [] },
    { id: 'row', type: 'strength', metric: 'reps', equipment: ['dumbbells'], muscles: ['back'], substitutionIds: [] },
    { id: 'run', type: 'cardio', metric: 'distance', equipment: ['none'], muscles: ['cardio'], substitutionIds: [] },
  ]);
  /** @param {string} date @param {[string, number, number][]} sets */
  const sess = (date, sets, id = date) => ({ id, date, startedAt: `${date}T10:00:00.000Z`, finishedAt: `${date}T10:45:00.000Z`, status: 'completed', entries: sets.map(([exerciseId, reps, weightKg], i) => ({ id: `e${i}`, exerciseId, restSec: 90, sets: [{ id: `s${i}`, reps, weightKg, done: true }] })) });

  it('filters by equipment and muscles (AND across groups, OR within)', () => {
    expect(isAvailable(ex[1], ['dumbbells'])).toBe(false);
    expect(filterExercises(ex, ['dumbbells'], ['chest']).map((e) => e.id)).toEqual(['push', 'dbp']);
    expect(filterExercises(ex, ['dumbbells'], ['chest', 'back']).map((e) => e.id)).toEqual(['push', 'dbp', 'row']);
    expect(filterExercises(ex, [], []).length).toBe(5);
  });
  it('lists substitutions doable with the equipment', () => {
    expect(substitutes(ex[0], ex, ['dumbbells']).map((e) => e.id)).toEqual(['dbp']);
    expect(substitutes(ex[0], ex, ['barbell', 'dumbbells']).map((e) => e.id)).toEqual(['bench', 'dbp']);
  });
  it('derives records with Epley and flags new ones', () => {
    expect(epley(100, 5)).toBe(116.7);
    expect(epley(80, 1)).toBe(80);
    const s1 = sess('2026-10-01', [['bench', 5, 60]]);
    const s2 = sess('2026-10-08', [['bench', 8, 60]]);
    const s3 = sess('2026-10-15', [['bench', 3, 70]]);
    const r = records([s1, s2, s3]).get('bench');
    expect(r?.maxWeight).toEqual({ value: 70, date: '2026-10-15' });
    expect(r?.maxReps).toEqual({ value: 8, date: '2026-10-08' });
    expect(r?.best1RM?.value).toBe(77);
    expect(newRecords(/** @type {any} */ (s1), [s1]).length).toBe(0);
    expect(newRecords(/** @type {any} */ (s3), [s1, s2, s3]).map((x) => x.kind)).toEqual(['maxWeight', 'best1RM']);
  });
  it('computes session stats, weekly counts and the heatmap', () => {
    const s = sess('2026-10-15', [['bench', 5, 60], ['push', 20, 0]]);
    expect(sessionStats(/** @type {any} */ (s))).toEqual({ minutes: 45, sets: 2, volume: 300 });
    expect(weeklyCounts([s, sess('2026-10-05', [])], '2026-10-18', 1, 3).map((w) => w.count)).toEqual([0, 1, 1]);
    const grid = heatmap([s], [{ date: '2026-10-16', status: 'done' }], '2026-10-18', 1, 2);
    expect(grid.length).toBe(2);
    expect(grid[1].map((c) => c.level)).toEqual(['none', 'none', 'none', 'workout', 'walk', 'none', 'none']);
  });
  it('converts kg and lb', () => {
    expect(displayWeight(20, 'imperial')).toBe(44);
    expect(displayWeight(20, 'metric')).toBe(20);
    expect(toKg(44.1, 'imperial')).toBe(20);
  });
  it('suggests least trained groups, schedules plans and remembers last sets', () => {
    const s = sess('2026-10-17', [['dbp', 10, 20]]);
    const ideas = suggestions(ex, [s], ['dumbbells'], '2026-10-18', 2).map((e) => e.id);
    expect(ideas.includes('dbp')).toBe(false);
    expect(plansFor(/** @type {any} */ ([{ id: 'p', days: [7], archived: false }, { id: 'q', days: [7], archived: true }]), '2026-10-18').map((p) => p.id)).toEqual(['p']);
    expect(lastSets([s], 'dbp')[0].weightKg).toBe(20);
    expect(trend([s, sess('2026-10-10', [['dbp', 10, 18]])], 'dbp', 'top').map((p) => p.value)).toEqual([18, 20]);
  });
});
