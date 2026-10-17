// @ts-check
// Translations and locale-aware formatting. English is the default and source language; Russian is optional.

import en from '../i18n/en.js';
import ru from '../i18n/ru.js';
import { parseLocalDate, parseTime } from './time.js';

/** @typedef {'en'|'ru'} Language */

/** Language names shown in their own language. */
export const LANGUAGES = /** @type {const} */ ({ en: 'English', ru: 'Русский' });

/** @type {Record<Language, any>} */
const DICTIONARIES = { en, ru };

/** @type {Language} */
let current = 'en';
/** @type {'24h'|'12h'} */
let timeFormat = '24h';

/** @param {string} language */
export function setLanguage(language) {
  current = language === 'ru' ? 'ru' : 'en';
  if (typeof document !== 'undefined') document.documentElement.lang = current;
}

export function getLanguage() {
  return current;
}

/** @param {'24h'|'12h'} format */
export function setTimeFormat(format) {
  timeFormat = format === '12h' ? '12h' : '24h';
}

/**
 * @param {any} dict
 * @param {string} key dotted path
 */
function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), dict);
}

/**
 * Translates a key. Plural entries are objects with CLDR categories (one/few/many/other) and use params.count.
 * Missing keys fall back to English, then to the key itself.
 * @param {string} key
 * @param {Record<string, string|number>} [params]
 * @returns {string}
 */
export function t(key, params = {}) {
  let value = lookup(DICTIONARIES[current], key);
  if (value === undefined && current !== 'en') value = lookup(en, key);
  if (value === undefined) return key;
  if (typeof value === 'object') {
    if (!('other' in value)) return key;
    const category = new Intl.PluralRules(intlLocale()).select(Number(params.count ?? 0));
    value = value[category] ?? value.other;
  }
  return String(value).replace(/\{(\w+)\}/g, (match, name) => (params[name] !== undefined ? String(params[name]) : match));
}

/** BCP 47 locale used for Intl formatting: the device locale if it matches the UI language. */
export function intlLocale() {
  const device = typeof navigator !== 'undefined' ? navigator.language : '';
  if (device && device.toLowerCase().startsWith(current)) return device;
  return current === 'ru' ? 'ru-RU' : 'en-GB';
}

/**
 * Formats a LocalTime ("HH:MM") with the user's 12/24-hour preference.
 * @param {string} time
 */
export function formatTime(time) {
  const minutes = parseTime(time);
  const date = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return new Intl.DateTimeFormat(intlLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: timeFormat === '12h' ? 'h12' : 'h23',
  }).format(date);
}

/**
 * @param {string} localDate
 * @param {Intl.DateTimeFormatOptions} [options]
 */
export function formatDate(localDate, options = { day: 'numeric', month: 'long' }) {
  return new Intl.DateTimeFormat(intlLocale(), options).format(parseLocalDate(localDate));
}

/**
 * Weekday names indexed by ISO weekday (1 = Monday … 7 = Sunday); index 0 is empty.
 * @param {'narrow'|'short'|'long'} [width]
 * @returns {string[]}
 */
export function weekdayNames(width = 'short') {
  const fmt = new Intl.DateTimeFormat(intlLocale(), { weekday: width });
  // 2024-01-01 was a Monday.
  return ['', ...[1, 2, 3, 4, 5, 6, 7].map((d) => fmt.format(new Date(2024, 0, d)))];
}

/**
 * "in 7 h 20 min" / "in 5 min".
 * @param {{ hours: number, minutes: number }} span
 */
export function formatIn({ hours, minutes }) {
  return hours ? t('time.inHoursMinutes', { hours, minutes }) : t('time.inMinutes', { minutes });
}

/**
 * @param {number} value
 * @param {Intl.NumberFormatOptions} [options]
 */
export function formatNumber(value, options) {
  return new Intl.NumberFormat(intlLocale(), options).format(value);
}

/**
 * All leaf keys of a dictionary; plural objects count as one leaf.
 * @param {any} dict
 * @param {string} [prefix]
 * @returns {string[]}
 */
export function leafKeys(dict, prefix = '') {
  return Object.entries(dict).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !('other' in value)) return leafKeys(value, path);
    return [path];
  });
}
