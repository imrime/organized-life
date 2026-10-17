// @ts-check
// Money in integer minor units (cents, kopecks) to avoid floating-point errors.

const EURO_REGIONS = new Set([
  'AT', 'BE', 'BG', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK',
  'AD', 'MC', 'ME', 'SM', 'VA', 'XK',
]);

/** @type {Record<string, string>} */
const REGION_CURRENCY = {
  UA: 'UAH', US: 'USD', GB: 'GBP', RU: 'RUB', BY: 'BYN', KZ: 'KZT', PL: 'PLN', CZ: 'CZK', CH: 'CHF', LI: 'CHF',
  CA: 'CAD', AU: 'AUD', NZ: 'NZD', JP: 'JPY', CN: 'CNY', IN: 'INR', TR: 'TRY', GE: 'GEL', MD: 'MDL', AM: 'AMD',
  AZ: 'AZN', UZ: 'UZS', SE: 'SEK', NO: 'NOK', DK: 'DKK', IS: 'ISK', HU: 'HUF', RO: 'RON', RS: 'RSD', IL: 'ILS',
  AE: 'AED', BR: 'BRL', MX: 'MXN', KR: 'KRW', SG: 'SGD', HK: 'HKD', ZA: 'ZAR', AR: 'ARS', CL: 'CLP', TH: 'THB',
};

/** Currencies offered in Settings (others can be added later). */
export const COMMON_CURRENCIES = [
  'EUR', 'USD', 'GBP', 'UAH', 'PLN', 'CZK', 'CHF', 'SEK', 'NOK', 'DKK', 'HUF', 'RON', 'GEL', 'MDL', 'KZT', 'TRY',
  'RUB', 'BYN', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'ILS', 'AED', 'BRL', 'MXN',
];

/**
 * Default currency from the region of the first locale that has one; no region → EUR.
 * @param {readonly string[]} locales
 */
export function currencyForLocales(locales) {
  for (const tag of locales) {
    let region;
    try {
      region = new Intl.Locale(tag).region;
    } catch {
      continue;
    }
    if (!region) continue;
    if (EURO_REGIONS.has(region)) return 'EUR';
    if (REGION_CURRENCY[region]) return REGION_CURRENCY[region];
  }
  return 'EUR';
}

/** @param {string} currency ISO 4217 */
export function fractionDigits(currency) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * Parses user input ("12,50", "1 234.5", "€ 3") into minor units. Returns null when not a number.
 * The last "," or "." followed by at most the currency's fraction digits is treated as the decimal separator.
 * @param {string} text
 * @param {string} currency
 * @returns {number|null}
 */
export function parseMoney(text, currency) {
  const digits = fractionDigits(currency);
  const cleaned = String(text ?? '').replace(/[^\d.,-]/g, '');
  if (!/\d/.test(cleaned)) return null;
  const negative = cleaned.startsWith('-');
  const body = cleaned.replace(/-/g, '');
  const lastSep = Math.max(body.lastIndexOf(','), body.lastIndexOf('.'));
  let intPart = body;
  let fracPart = '';
  if (lastSep >= 0) {
    const tail = body.slice(lastSep + 1);
    if (digits > 0 && tail.length > 0 && tail.length <= digits) {
      intPart = body.slice(0, lastSep);
      fracPart = tail;
    }
  }
  intPart = intPart.replace(/[.,]/g, '') || '0';
  fracPart = fracPart.padEnd(digits, '0');
  const minor = Number(intPart) * 10 ** digits + Number(fracPart || '0');
  if (!Number.isSafeInteger(minor)) return null;
  return negative ? -minor : minor;
}

/**
 * @param {number} minor
 * @param {string} currency
 * @param {string} locale
 */
export function formatMoney(minor, currency, locale) {
  const digits = fractionDigits(currency);
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 10 ** digits);
}

/**
 * Splits a total into parts proportional to weights; the rounding remainder goes to the largest part.
 * @param {number} totalMinor
 * @param {number[]} weights
 * @returns {number[]}
 */
export function splitProportionally(totalMinor, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!weights.length) return [];
  if (sum === 0) {
    const parts = weights.map(() => 0);
    parts[0] = totalMinor;
    return parts;
  }
  const parts = weights.map((w) => Math.floor((totalMinor * w) / sum));
  const remainder = totalMinor - parts.reduce((a, b) => a + b, 0);
  const largest = weights.indexOf(Math.max(...weights));
  parts[largest] += remainder;
  return parts;
}
