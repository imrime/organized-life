// @ts-check
import { describe, it, expect } from '../harness.js';
import { normalizeName, matchesQuery } from '../../js/core/text.js';
import { convert, comparable, kgToLb } from '../../js/core/units.js';

describe('text', () => {
  it('normalises names for matching', () => {
    expect(normalizeName('  Milk, 3.2%!  ')).toBe('milk 3 2');
    expect(normalizeName('Ёжик')).toBe('ежик');
  });
  it('matches multi-word queries', () => {
    expect(matchesQuery('Alarm clock', 'clock')).toBe(true);
    expect(matchesQuery('Wall calendar', 'cal wall')).toBe(true);
    expect(matchesQuery('Bed', 'fridge')).toBe(false);
  });
});

describe('units', () => {
  it('converts compatible units', () => {
    expect(convert(1.5, 'kg', 'g')).toBe(1500);
    expect(convert(250, 'ml', 'l')).toBe(0.25);
    expect(convert(2, 'pcs', 'g')).toBe(null);
    expect(comparable('l', 'ml')).toBe(true);
  });
  it('converts kilograms to rounded pounds', () => {
    expect(kgToLb(20)).toBe(44);
  });
});
