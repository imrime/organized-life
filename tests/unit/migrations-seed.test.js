// @ts-check
import { describe, it, expect } from '../harness.js';
import { migrate } from '../../js/core/migrations.js';
import { defaultSettings, applySeeds, SEED_VERSION } from '../../js/core/seed.js';
import { createStore } from '../../js/core/store.js';

describe('migrations', () => {
  it('applies migrations in order and only within the range', () => {
    const list = [
      { to: 3, up: (/** @type {any} */ d) => ({ ...d, log: [...d.log, 3] }) },
      { to: 2, up: (/** @type {any} */ d) => ({ ...d, log: [...d.log, 2] }) },
      { to: 4, up: (/** @type {any} */ d) => ({ ...d, log: [...d.log, 4] }) },
    ];
    expect(migrate({ log: [] }, 1, 3, list)).toEqual({ log: [2, 3] });
    expect(migrate({ log: [] }, 3, 3, list)).toEqual({ log: [] });
  });
});

describe('seed', () => {
  it('defaults to English with the currency of the device region', () => {
    const s = defaultSettings({ locales: ['uk-UA'], version: '0.1.0' });
    expect(s.language).toBe('en');
    expect(s.currency).toBe('UAH');
    expect(s.weekStart).toBe(1);
    expect(s.timeFormat).toBe('24h');
    expect(s.optionalRooms).toEqual({ study: true, gym: true });
  });
  it('uses US conventions for en-US', () => {
    const s = defaultSettings({ locales: ['en-US'], version: '0.1.0' });
    expect(s.currency).toBe('USD');
    expect(s.weekStart).toBe(7);
    expect(s.timeFormat).toBe('12h');
    expect(s.units).toBe('imperial');
  });
  it('creates the profile singletons once', async () => {
    const store = createStore({ persist: async () => {} });
    await store.mutate('seed', (tx) => applySeeds(tx, 0, { locales: ['de-DE'], version: '0.1.0' }));
    expect(store.profile('settings')?.currency).toBe('EUR');
    expect(store.profile('sleepPlan')?.wakeTime).toBe('07:00');
    const { token } = await store.mutate('seed', (tx) => applySeeds(tx, SEED_VERSION, { locales: ['de-DE'], version: '0.1.0' }));
    expect(token).toBe(null);
  });
});
