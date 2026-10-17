// @ts-check
import { describe, it, expect } from '../harness.js';
import {
  addDays, addMonths, combine, diffDays, isValidLocalDate, isValidTime, minutesToTime, parseTime, startOfWeek, weekday, toLocalDate,
} from '../../js/core/time.js';

describe('time: local dates', () => {
  it('validates local dates strictly', () => {
    expect(isValidLocalDate('2026-02-28')).toBe(true);
    expect(isValidLocalDate('2026-02-30')).toBe(false);
    expect(isValidLocalDate('2026-2-3')).toBe(false);
  });
  it('adds days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('counts days independent of DST', () => {
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
    expect(diffDays('2026-10-30', '2026-10-24')).toBe(-6);
  });
  it('returns ISO weekdays', () => {
    expect(weekday('2026-10-19')).toBe(1); // Monday
    expect(weekday('2026-10-18')).toBe(7); // Sunday
  });
  it('finds the start of the week for Monday and Sunday starts', () => {
    expect(startOfWeek('2026-10-21', 1)).toBe('2026-10-19');
    expect(startOfWeek('2026-10-21', 7)).toBe('2026-10-18');
    expect(startOfWeek('2026-10-18', 7)).toBe('2026-10-18');
  });
  it('clamps month arithmetic to the month length', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });
  it('round-trips Date ↔ LocalDate', () => {
    expect(toLocalDate(new Date(2026, 9, 17, 23, 59))).toBe('2026-10-17');
  });
});

describe('time: wall-clock times', () => {
  it('parses and formats times', () => {
    expect(parseTime('07:30')).toBe(450);
    expect(minutesToTime(450)).toBe('07:30');
    expect(minutesToTime(-30)).toBe('23:30');
    expect(minutesToTime(1440 + 5)).toBe('00:05');
  });
  it('validates times', () => {
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('7:00')).toBe(false);
  });
  it('combines date and time in local time', () => {
    const d = combine('2026-10-17', '06:45');
    expect(d.getHours()).toBe(6);
    expect(d.getMinutes()).toBe(45);
    expect(d.getDate()).toBe(17);
  });
});
