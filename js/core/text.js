// @ts-check
// Text normalisation for matching names (products, foods, search).

/**
 * Lowercase, trim, unify "ё" with "е", drop punctuation and collapse whitespace.
 * @param {string} value
 * @returns {string}
 */
export function normalizeName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True when every word of the query occurs in the text (both normalised).
 * @param {string} text
 * @param {string} query
 */
export function matchesQuery(text, query) {
  const words = normalizeName(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const haystack = normalizeName(text);
  return words.every((word) => haystack.includes(word));
}
