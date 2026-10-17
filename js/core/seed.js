// @ts-check
// First-run and incremental seed data. Each step runs once; meta "seed" stores the last applied version.

import { PROFILE } from './schema.js';
import { currencyForLocales } from './money.js';

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
