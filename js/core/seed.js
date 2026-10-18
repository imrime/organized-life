// @ts-check
// First-run and incremental seed data. Each step runs once; meta "seed" stores the last applied version.

import { PROFILE } from './schema.js';
import { currencyForLocales } from './money.js';
import { SEED_PRODUCTS, SEED_FINANCE_CATEGORIES, shopCategoryFor, financeCategoryFor, locationFor } from '../features/products/catalog.js';
import { SEED_EXERCISES } from '../features/workouts/catalog.js';

/** @typedef {import('./store.js').Tx} Tx */
/** @typedef {{ locales: readonly string[], version: string }} SeedContext */

const SUNDAY_FIRST_REGIONS = new Set(['US', 'CA', 'MX', 'BR', 'JP', 'IL', 'PH', 'KR', 'TW', 'HK', 'IN', 'ZA', 'AU']);
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);

/** @param {readonly string[]} locales */
function primaryLocale(locales) {
  for (const tag of locales) {
    try {
      return new Intl.Locale(tag);
    } catch {
      // ignore malformed tags
    }
  }
  return new Intl.Locale('en-GB');
}

/** @param {Intl.Locale} locale @returns {1|7} */
function weekStartFor(locale) {
  const anyLocale = /** @type {any} */ (locale);
  const info = typeof anyLocale.getWeekInfo === 'function' ? anyLocale.getWeekInfo() : anyLocale.weekInfo;
  if (info && typeof info.firstDay === 'number') return info.firstDay === 7 ? 7 : 1;
  return locale.region && SUNDAY_FIRST_REGIONS.has(locale.region) ? 7 : 1;
}

/** @param {Intl.Locale} locale @returns {'12h'|'24h'} */
function timeFormatFor(locale) {
  try {
    return new Intl.DateTimeFormat(locale.toString(), { hour: 'numeric' }).resolvedOptions().hour12 ? '12h' : '24h';
  } catch {
    return '24h';
  }
}

/**
 * Default settings derived from the device locales. Language is always English by default (owner decision).
 * @param {SeedContext} ctx
 */
export function defaultSettings({ locales, version }) {
  const locale = primaryLocale(locales);
  return {
    language: 'en',
    currency: currencyForLocales(locales),
    weekStart: weekStartFor(locale),
    timeFormat: timeFormatFor(locale),
    units: locale.region && IMPERIAL_REGIONS.has(locale.region) ? 'imperial' : 'metric',
    textSize: 'M',
    reduceMotion: 'system',
    showHints: false,
    nextTaskStrip: true,
    optionalRooms: { study: true, gym: true },
    toursSeen: [],
    visited: [],
    lastLocationId: 'bedroom',
    onboarding: { step: 0, done: false },
    notificationsEnabled: false,
    alarmVolume: 0.8,
    nightstandPrompt: true,
    kcalTarget: null,
    showBalanceOnAtm: false,
    lastSeenVersion: version,
    lastBackupAt: null,
    stripDismissed: [],
  };
}

/** @type {{ version: number, run: (tx: Tx, ctx: SeedContext) => void }[]} */
export const seedSteps = [
  {
    version: 1,
    run(tx, ctx) {
      tx.setProfile(PROFILE.settings, defaultSettings(ctx));
      tx.setProfile(PROFILE.character, {
        name: '',
        skinTone: 3,
        hairStyle: 'short',
        hairColor: 'brown',
        bodyShape: 'a',
        glasses: false,
        equipped: {},
      });
      tx.setProfile(PROFILE.sleepPlan, {
        bedtime: '23:00',
        wakeTime: '07:00',
        windDownMin: 30,
        linkAlarm: false,
        alarmDays: [1, 2, 3, 4, 5, 6, 7],
        bedtimeRoutineId: null,
        pendingBedAt: null,
      });
      tx.setProfile(PROFILE.fitness, { equipment: ['none', 'mat'], weeklyGoal: 3 });
    },
  },
  {
    // v0.3.0: care routines, bedtime routine and starter clothes (docs/spec/04-data-model.md §6).
    version: 2,
    run(tx) {
      const all = [1, 2, 3, 4, 5, 6, 7];
      /** @param {string} key @param {string[]} steps */
      const steps = (key, list) => list.map((s, i) => ({ id: `${key}-${i + 1}`, label: '', seedKey: `seed.routines.${key}.${s}` }));
      const routines = [
        { id: 'routine-bedtime', seedKey: 'seed.routines.bedtime.name', owner: 'bedroom.bed', slot: 'bedtime', steps: steps('bedtime', ['phone', 'clothes', 'read']), days: all, reminderTime: null, enabled: true, order: 0 },
        { id: 'routine-morning', seedKey: 'seed.routines.morning.name', owner: 'bathroom.mirror-sink', slot: 'morning', steps: steps('morning', ['teeth', 'face', 'skincare', 'deodorant']), days: all, reminderTime: null, enabled: true, order: 0 },
        { id: 'routine-evening', seedKey: 'seed.routines.evening.name', owner: 'bathroom.mirror-sink', slot: 'evening', steps: steps('evening', ['face', 'teeth', 'skincare']), days: all, reminderTime: null, enabled: true, order: 1 },
        { id: 'routine-shower', seedKey: 'seed.routines.shower.name', owner: 'bathroom.bath-shower', slot: 'habit', steps: [], days: all, reminderTime: null, enabled: true, order: 0 },
        { id: 'routine-hairwash', seedKey: 'seed.routines.hairwash.name', owner: 'bathroom.bath-shower', slot: 'habit', steps: [], days: [1, 4], reminderTime: null, enabled: true, order: 1 },
        { id: 'routine-facemask', seedKey: 'seed.routines.facemask.name', owner: 'bathroom.bath-shower', slot: 'habit', steps: [], days: [7], reminderTime: null, enabled: false, order: 2 },
      ];
      for (const r of routines) if (!tx.get('routines', r.id)) tx.insert('routines', { name: '', ...r });
      tx.setProfile(PROFILE.sleepPlan, { bedtimeRoutineId: 'routine-bedtime' });

      const clothes = [
        { id: 'cloth-tshirt', seedKey: 'seed.clothes.tshirt', slot: 'top', template: 'tshirt', color: 'white', laundryGroup: 'whites', care: 'normal' },
        { id: 'cloth-jeans', seedKey: 'seed.clothes.jeans', slot: 'bottom', template: 'jeans', color: 'denim', laundryGroup: 'darks', care: 'normal' },
        { id: 'cloth-sneakers', seedKey: 'seed.clothes.sneakers', slot: 'shoes', template: 'sneakers', color: 'white', laundryGroup: 'whites', care: 'no_wash' },
        { id: 'cloth-hoodie', seedKey: 'seed.clothes.hoodie', slot: 'top', template: 'hoodie', color: 'grey', laundryGroup: 'lights', care: 'normal' },
      ];
      for (const c of clothes) {
        if (!tx.get('clothingItems', c.id)) {
          tx.insert('clothingItems', { name: '', season: 'all', status: 'clean', favorite: false, isNew: false, priceMinor: null, purchasedAt: null, transactionId: null, washCount: 0, notes: '', ...c });
        }
      }
      const character = tx.get('profile', PROFILE.character);
      if (character && !Object.values(character.equipped ?? {}).some(Boolean)) {
        tx.setProfile(PROFILE.character, { equipped: { top: 'cloth-tshirt', bottom: 'cloth-jeans', shoes: 'cloth-sneakers' } });
      }
      // People upgrading from 0.2 already went through the bedroom: don't show onboarding again.
      const settings = tx.get('profile', PROFILE.settings);
      if (settings && (settings.toursSeen ?? []).length) tx.setProfile(PROFILE.settings, { onboarding: { step: 4, done: true } });
    },
  },
  {
    // v0.4.0: product catalogue, finance categories and the Wallet account (docs/spec/04-data-model.md §6).
    version: 3,
    run(tx) {
      SEED_PRODUCTS.forEach(([key, category, unit, qty, shelfLife]) => {
        const id = `prod-${key}`;
        if (tx.get('products', id)) return;
        const shopCategory = shopCategoryFor(category);
        tx.insert('products', {
          id, name: '', seedKey: `seed.products.${key}`, category, shopCategory, financeCategoryId: financeCategoryFor(shopCategory),
          defaultUnit: unit, defaultQty: qty, defaultLocation: locationFor(category), shelfLifeDays: shelfLife, lastPriceMinor: null, favorite: false,
        });
      });
      SEED_FINANCE_CATEGORIES.forEach(([id, kind, icon, color], order) => {
        if (!tx.get('financeCategories', id)) tx.insert('financeCategories', { id, name: '', seedKey: `seed.finance.${id.slice(4)}`, kind, icon, color, archived: false, order });
      });
      if (!tx.get('accounts', 'acc-wallet')) {
        tx.insert('accounts', { id: 'acc-wallet', name: '', seedKey: 'seed.accounts.wallet', type: 'cash', openingBalanceMinor: 0, openingSet: false, archived: false });
      }
    },
  },
  {
    // v0.5.0: the park as the first place for walks (docs/spec/04-data-model.md §6).
    version: 4,
    run(tx) {
      if (!tx.get('places', 'place-park')) tx.insert('places', { id: 'place-park', name: '', seedKey: 'seed.places.park', notes: '', favorite: true });
    },
  },
  {
    // v0.7.0: exercise library for the gym (docs/spec/04-data-model.md §6).
    version: 5,
    run(tx) {
      SEED_EXERCISES.forEach(([key, type, metric, equipment, muscles, subs]) => {
        const id = `ex-${key}`;
        if (tx.get('exercises', id)) return;
        tx.insert('exercises', {
          id, name: '', seedKey: `seed.exercises.${key}.name`, howToKey: `seed.exercises.${key}.how`, type, metric, equipment, muscles,
          substitutionIds: subs.map((k) => `ex-${k}`), custom: false, hidden: false,
        });
      });
    },
  },
];

export const SEED_VERSION = Math.max(...seedSteps.map((s) => s.version));

/**
 * Applies every seed step newer than `fromVersion`.
 * @param {Tx} tx
 * @param {number} fromVersion
 * @param {SeedContext} ctx
 */
export function applySeeds(tx, fromVersion, ctx) {
  for (const step of seedSteps) {
    if (step.version > fromVersion) step.run(tx, ctx);
  }
}
