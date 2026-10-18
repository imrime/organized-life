// @ts-check
// Checkout maths (pure): one transaction per finance category, actual total distributed proportionally (F-1).

import { splitProportionally } from '../../core/money.js';

/**
 * @typedef {{
 *   key: string, name: string, productId?: string|null, quantity: number, unit: string, priceMinor: number,
 *   destination: 'fridge'|'freezer'|'pantry'|'bathroom'|'none', expiryDate?: string|null,
 *   category: string, financeCategoryId: string, shoppingItemId?: string|null,
 * }} CheckoutLine
 */

/** @param {CheckoutLine[]} lines */
export function linesTotal(lines) {
  return lines.reduce((sum, l) => sum + (l.priceMinor || 0), 0);
}

/**
 * Amount per finance category, scaled so the parts add up exactly to the actual total.
 * @param {CheckoutLine[]} lines
 * @param {number} actualTotalMinor
 * @returns {{ financeCategoryId: string, amountMinor: number }[]}
 */
export function splitByCategory(lines, actualTotalMinor) {
  /** @type {Map<string, number>} */
  const groups = new Map();
  for (const line of lines) groups.set(line.financeCategoryId, (groups.get(line.financeCategoryId) ?? 0) + (line.priceMinor || 0));
  const ids = [...groups.keys()];
  const parts = splitProportionally(actualTotalMinor, ids.map((id) => groups.get(id) ?? 0));
  return ids.map((financeCategoryId, i) => ({ financeCategoryId, amountMinor: parts[i] })).filter((g) => g.amountMinor > 0);
}

/**
 * Validation: at least one line, positive quantities, non-negative prices/total.
 * @param {CheckoutLine[]} lines
 * @param {number|null} actualTotalMinor
 */
export function validateCheckout(lines, actualTotalMinor) {
  /** @type {Record<string, string>} */
  const errors = {};
  if (!lines.length) errors.lines = 'checkout.errors.empty';
  if (lines.some((l) => !(l.quantity > 0))) errors.lines = 'checkout.errors.quantity';
  if (lines.some((l) => !(l.priceMinor >= 0))) errors.lines = 'checkout.errors.price';
  if (actualTotalMinor === null || actualTotalMinor < 0) errors.total = 'checkout.errors.total';
  return errors;
}

/** Count of lines per destination for the result screen. @param {CheckoutLine[]} lines */
export function destinationCounts(lines) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const l of lines) counts[l.destination] = (counts[l.destination] ?? 0) + 1;
  return counts;
}
