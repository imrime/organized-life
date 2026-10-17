// @ts-check
import { describe, it, expect } from '../harness.js';
import { classify, effectiveTime, ALARM_LATE_MS, ALARM_RING_MS } from '../../js/core/reminders.js';

const NOW = new Date(2026, 9, 19, 7, 0, 30);
/** @param {string} key @param {Date} at @param {'alarm'|'reminder'} [kind] */
const inst = (key, at, kind = 'alarm') => ({ key, source: kind, kind, at, title: key });

describe('reminders: classification', () => {
  it('fires instances that are due, keeps future ones upcoming', () => {
    const due = inst('a', new Date(2026, 9, 19, 7, 0));
    const later = inst('b', new Date(2026, 9, 19, 8, 0));
    const { due: d, upcoming: u } = classify([due, later], () => undefined, NOW);
    expect(d.map((p) => p.inst.key)).toEqual(['a']);
    expect(u.map((p) => p.inst.key)).toEqual(['b']);
  });
  it('reports alarms older than the late window as missed', () => {
    const old = inst('old', new Date(NOW.getTime() - ALARM_LATE_MS - 1000));
    expect(classify([old], () => undefined, NOW).missed.length).toBe(1);
  });
  it('lets reminders be late for longer than alarms', () => {
    const r = inst('r', new Date(NOW.getTime() - 10 * 60_000), 'reminder');
    expect(classify([r], () => undefined, NOW).due.length).toBe(1);
  });
  it('treats fired + acknowledged instances as handled', () => {
    const a = inst('a', new Date(2026, 9, 19, 7, 0));
    const state = { id: 'a', firedAt: NOW.toISOString(), ackAt: NOW.toISOString() };
    const result = classify([a], () => state, NOW);
    expect(result.due.length + result.upcoming.length + result.missed.length).toBe(0);
  });
  it('re-fires at the end of a snooze', () => {
    const a = inst('a', new Date(2026, 9, 19, 6, 50));
    const state = { id: 'a', firedAt: new Date(2026, 9, 19, 6, 50).toISOString(), snoozedUntil: new Date(2026, 9, 19, 7, 0).toISOString() };
    expect(effectiveTime(a, state)?.getMinutes()).toBe(0);
    expect(classify([a], () => state, NOW).due.length).toBe(1);
  });
  it('a fired alarm that was never dismissed becomes missed after ringing stops', () => {
    const a = inst('a', new Date(NOW.getTime() - ALARM_RING_MS - 60_000));
    const state = { id: 'a', firedAt: a.at.toISOString() };
    expect(classify([a], () => state, NOW).missed.length).toBe(1);
  });
  it('filters by kind (Nightstand mode keeps only alarms)', () => {
    const r = inst('r', new Date(2026, 9, 19, 7, 0), 'reminder');
    expect(classify([r], () => undefined, NOW, { kinds: ['alarm'] }).due.length).toBe(0);
  });
});
