// @ts-check
// Local calendar helpers. LocalDate = "YYYY-MM-DD", LocalTime = "HH:MM" (device wall clock).

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** @param {number} n */
const pad = (n) => String(n).padStart(2, '0');

/**
 * @param {Date} date
 * @returns {string} LocalDate
 */
export function toLocalDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** @param {Date} [now] */
export function today(now = new Date()) {
  return toLocalDate(now);
}

/**
 * @param {string} value LocalDate
 * @returns {Date} local midnight
 */
export function parseLocalDate(value) {
  const m = DATE_RE.exec(value);
  if (!m) throw new Error(`Invalid local date: ${value}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** @param {unknown} value */
export function isValidLocalDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  return toLocalDate(parseLocalDate(value)) === value;
}

/** @param {unknown} value */
export function isValidTime(value) {
  return typeof value === 'string' && TIME_RE.test(value);
}

/**
 * @param {string} date LocalDate
 * @param {number} days
 */
export function addDays(date, days) {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + days);
  return toLocalDate(d);
}

/**
 * Whole days from a to b (b − a), independent of DST.
 * @param {string} a LocalDate
 * @param {string} b LocalDate
 */
export function diffDays(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/**
 * ISO weekday: 1 = Monday … 7 = Sunday.
 * @param {string} date LocalDate
 * @returns {1|2|3|4|5|6|7}
 */
export function weekday(date) {
  const day = parseLocalDate(date).getDay();
  return /** @type {1|2|3|4|5|6|7} */ (day === 0 ? 7 : day);
}

/**
 * @param {string} date LocalDate
 * @param {1|7} [weekStart] 1 = Monday, 7 = Sunday
 */
export function startOfWeek(date, weekStart = 1) {
  const wd = weekday(date);
  const offset = weekStart === 1 ? wd - 1 : wd % 7;
  return addDays(date, -offset);
}

/**
 * @param {number} year
 * @param {number} month 1–12
 */
export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Adds months, clamping the day to the target month's length (Jan 31 + 1 month → Feb 28/29).
 * @param {string} date LocalDate
 * @param {number} months
 * @param {number} [dayOfMonth] preferred day (defaults to the date's own day)
 */
export function addMonths(date, months, dayOfMonth) {
  const [y, m, d] = date.split('-').map(Number);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const day = Math.min(dayOfMonth ?? d, daysInMonth(year, month));
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * @param {string} time LocalTime
 * @returns {number} minutes since midnight
 */
export function parseTime(time) {
  const m = TIME_RE.exec(time);
  if (!m) throw new Error(`Invalid time: ${time}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * @param {number} minutes minutes since midnight (wraps around 24 h)
 * @returns {string} LocalTime
 */
export function minutesToTime(minutes) {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** @param {Date} [now] */
export function nowTime(now = new Date()) {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/**
 * Local wall-clock date + time → Date. Non-existent DST times move forward.
 * @param {string} date LocalDate
 * @param {string} time LocalTime
 */
export function combine(date, time) {
  const d = parseLocalDate(date);
  const minutes = parseTime(time);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

/**
 * Splits a duration into hours and minutes.
 * @param {number} totalMinutes
 */
export function splitDuration(totalMinutes) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}
