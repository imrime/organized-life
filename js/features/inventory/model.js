// @ts-check
// Inventory logic (pure): expiry, stock levels, merging batches. docs/spec/04-data-model.md §3.8, rooms/kitchen.md K1/K5.

import { addDays, addMonths, diffDays } from '../../core/time.js';
import { normalizeName } from '../../core/text.js';

/**
 * @typedef {{
 *   id: string, name: string, productId?: string|null, location: 'fridge'|'freezer'|'pantry'|'bathroom', category: string,
 *   quantity: number, unit: string, expiryDate?: string|null, openedAt?: string|null, useWithinMonths?: number|null,
 *   lowStockAt?: number|null, spot?: string, notes?: string,
 * }} InventoryItem
 */

/** Earliest of the printed expiry and "use within N months after opening". @param {InventoryItem} item */
export function effectiveExpiry(item) {
  const pao = item.openedAt && item.useWithinMonths ? addMonths(item.openedAt, item.useWithinMonths) : null;
  if (item.expiryDate && pao) return item.expiryDate < pao ? item.expiryDate : pao;
  return item.expiryDate || pao || null;
}

/**
 * @param {InventoryItem} item
 * @param {string} today
 * @returns {'none'|'expired'|'today'|'tomorrow'|'soon'|'later'}
 */
export function expiryState(item, today) {
  const date = effectiveExpiry(item);
  if (!date) return 'none';
  const days = diffDays(today, date);
  if (days < 0) return 'expired';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 2) return 'soon';
  return 'later';
}

/** Days until expiry (negative = expired), or null. @param {InventoryItem} item @param {string} today */
export function daysToExpiry(item, today) {
  const date = effectiveExpiry(item);
  return date ? diffDays(today, date) : null;
}

/**
 * Stock level relative to the threshold; null when no threshold is set.
 * @param {InventoryItem} item
 * @returns {'out'|'low'|'ok'|'full'|null}
 */
export function stockLevel(item) {
  if (item.lowStockAt === null || item.lowStockAt === undefined) return null;
  if (item.quantity <= 0) return 'out';
  if (item.quantity <= item.lowStockAt) return 'low';
  if (item.quantity <= item.lowStockAt * 2) return 'ok';
  return 'full';
}

/** @param {InventoryItem} item */
export const isLow = (item) => {
  const level = stockLevel(item);
  return level === 'low' || level === 'out';
};

/**
 * @param {InventoryItem[]} items
 * @param {'expiry'|'name'|'category'} sort
 * @param {string} today
 */
export function sortItems(items, sort, today) {
  const far = '9999-12-31';
  return [...items].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'category') return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
    return (effectiveExpiry(a) ?? far).localeCompare(effectiveExpiry(b) ?? far) || a.name.localeCompare(b.name);
  });
}

/**
 * An existing batch the new item should be added to: same product/name, place, unit and expiry.
 * @param {InventoryItem[]} items
 * @param {{ name: string, productId?: string|null, location: string, unit: string, expiryDate?: string|null }} draft
 */
export function mergeTarget(items, draft) {
  const key = normalizeName(draft.name);
  return items.find(
    (i) =>
      i.location === draft.location &&
      i.unit === draft.unit &&
      (i.expiryDate || null) === (draft.expiryDate || null) &&
      ((draft.productId && i.productId === draft.productId) || normalizeName(i.name) === key),
  );
}

/** Suggested expiry for a purchase. @param {string} today @param {number|null|undefined} shelfLifeDays */
export function suggestedExpiry(today, shelfLifeDays) {
  return shelfLifeDays ? addDays(today, shelfLifeDays) : null;
}

/** Quantity step for steppers. @param {string} unit */
export function stepFor(unit) {
  if (unit === 'g' || unit === 'ml') return 100;
  if (unit === 'kg' || unit === 'l') return 0.1;
  return 1;
}

/** Rounds away floating-point noise from steppers. @param {number} n */
export const roundQty = (n) => Math.round(n * 1000) / 1000;

/**
 * Items expiring today/tomorrow or already expired.
 * @param {InventoryItem[]} items
 * @param {string} today
 */
export function expiringItems(items, today) {
  return items.filter((i) => ['expired', 'today', 'tomorrow'].includes(expiryState(i, today)));
}
