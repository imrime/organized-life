// @ts-check
import { describe, it, expect } from '../harness.js';
import { defaultLoadType, cycleFor, loadStatus, minutesLeft, loadProgress, finishTime, activeLoad, mixWarnings, basketLevel, laundrySummary, basketSections, CYCLES } from '../../js/features/laundry/model.js';
import { elapsedMin, weekTotals, placeStats, lastPlaceId, validateWalk, runningWalk } from '../../js/features/walks/model.js';

/** @param {any} l */
const load = (l) => ({ id: 'l', itemIds: [], extraIds: [], loadType: 'mixed', cycle: 'cotton', temperatureC: 40, durationMin: 150, status: 'queued', ...l });
/** @param {any} w */
const walk = (w) => ({ id: 'w', date: '2026-10-18', durationMin: 30, status: 'done', placeId: null, ...w });

describe('laundry', () => {
  it('suggests a load type from the items', () => {
    expect(defaultLoadType([{ laundryGroup: 'whites' }, { laundryGroup: 'whites' }, { laundryGroup: 'darks' }])).toBe('whites');
    expect(defaultLoadType([{ laundryGroup: 'whites' }, { laundryGroup: 'darks' }])).toBe('mixed');
    expect(defaultLoadType([{ laundryGroup: 'lights' }, { laundryGroup: 'colours' }])).toBe('colours');
    expect(defaultLoadType([{ laundryGroup: 'colours', care: 'wool' }, { laundryGroup: 'darks', care: 'delicate' }])).toBe('delicates');
    expect(defaultLoadType([{ laundryGroup: 'whites', kind: 'towels' }])).toBe('towels');
    expect(defaultLoadType([])).toBe('mixed');
    expect(cycleFor('delicates')).toBe('delicates');
    expect(cycleFor('towels')).toBe('cotton');
    expect(CYCLES.quick).toEqual({ durationMin: 30, temperatureC: 30 });
  });
  it('treats a running load past its finish time as done', () => {
    const startedAt = '2026-10-18T10:00:00.000Z';
    const running = load({ status: 'running', startedAt, finishesAt: finishTime(startedAt, 60) });
    expect(running.finishesAt).toBe('2026-10-18T11:00:00.000Z');
    expect(loadStatus(running, new Date('2026-10-18T10:30:00Z'))).toBe('running');
    expect(minutesLeft(running, new Date('2026-10-18T10:30:30Z'))).toBe(30);
    expect(loadProgress(running, new Date('2026-10-18T10:30:00Z'))).toBe(0.5);
    expect(loadStatus(running, new Date('2026-10-18T11:00:00Z'))).toBe('done');
    expect(minutesLeft(running, new Date('2026-10-18T12:00:00Z'))).toBe(0);
  });
  it('finds the load in the machine', () => {
    expect(activeLoad([load({ id: 'a' }), load({ id: 'b', status: 'done' })])?.id).toBe('b');
    expect(activeLoad([load({ status: 'unloaded' })])).toBe(undefined);
  });
  it('warns about stains and care mismatches', () => {
    expect(mixWarnings([{ laundryGroup: 'whites' }, { laundryGroup: 'darks' }])).toEqual(['stain']);
    expect(mixWarnings([{ laundryGroup: 'whites' }, { laundryGroup: 'lights' }])).toEqual([]);
    expect(mixWarnings([{ laundryGroup: 'darks', care: 'wool' }, { laundryGroup: 'darks', care: 'normal' }])).toEqual(['care']);
  });
  it('reports basket level and summary counts', () => {
    expect(basketLevel(0)).toBe('empty');
    expect(basketLevel(6)).toBe('some');
    expect(basketLevel(7)).toBe('full');
    const clothes = /** @type {any[]} */ ([{ status: 'dirty' }, { status: 'in_load' }, { status: 'clean', care: 'normal' }, { status: 'clean', care: 'no_wash' }]);
    expect(laundrySummary(clothes, /** @type {any} */ ([{ status: 'dirty' }]))).toEqual({ dirty: 2, washing: 1, clean: 1 });
  });
  it('groups basket entries by colour or type', () => {
    const entries = [{ laundryGroup: /** @type {const} */ ('darks'), slot: 'bottom' }, { laundryGroup: /** @type {const} */ ('whites'), slot: 'top' }, { laundryGroup: /** @type {const} */ ('whites') }];
    expect(basketSections(entries, 'colour', ['top', 'bottom']).map((s) => `${s.key}:${s.items.length}`)).toEqual(['whites:2', 'darks:1']);
    expect(basketSections(entries, 'type', ['top', 'bottom']).map((s) => `${s.key}:${s.items.length}`)).toEqual(['top:1', 'bottom:1', 'other:1']);
  });
});

describe('walks', () => {
  it('measures a running walk', () => {
    const w = walk({ status: 'running', startedAt: '2026-10-18T10:00:00.000Z' });
    expect(runningWalk([walk({}), w])?.status).toBe('running');
    expect(elapsedMin(w, new Date('2026-10-18T10:25:59Z'))).toBe(25);
  });
  it('totals the current week only', () => {
    const walks = [
      walk({ date: '2026-10-12', durationMin: 40, steps: 4000 }), // Monday
      walk({ date: '2026-10-18', durationMin: 30, steps: 3000, distanceKm: 2.25 }), // Sunday
      walk({ date: '2026-10-11', durationMin: 60 }), // previous week
      walk({ date: '2026-10-14', status: 'running' }),
    ];
    expect(weekTotals(/** @type {any} */ (walks), '2026-10-18', 1)).toEqual({ count: 2, minutes: 70, steps: 7000, km: 2.3 });
    expect(weekTotals(/** @type {any} */ (walks), '2026-10-18', 7).count).toBe(1);
  });
  it('counts visits per place and remembers the last place', () => {
    const walks = [walk({ placeId: 'p', date: '2026-10-10' }), walk({ placeId: 'p', date: '2026-10-15' }), walk({ placeId: 'q', date: '2026-10-12' })];
    const stats = placeStats(/** @type {any} */ (walks));
    expect(stats.get('p')).toEqual({ visits: 2, last: '2026-10-15' });
    expect(lastPlaceId(/** @type {any} */ (walks))).toBe('p');
  });
  it('validates the walk form', () => {
    expect(validateWalk({ durationMin: '0', date: '2026-10-18' }).duration).toBe('walks.errors.duration');
    expect(validateWalk({ durationMin: '30', steps: '-1', date: '2026-10-18' }).steps).toBe('walks.errors.number');
    expect(validateWalk({ durationMin: '30', steps: '', distanceKm: '1.5', date: '2026-10-18' })).toEqual({});
  });
});
