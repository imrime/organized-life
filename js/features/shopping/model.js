// @ts-check
// Shopping list logic (pure): aisle grouping, estimate, quick-add parsing, suggestions. rooms/kitchen.md K3, cross-system F-4.

import { normalizeName } from '../../core/text.js';
import { convert } from '../../core/units.js';
import { SHOP_CATEGORIES } from '../products/catalog.js';
import { isLow } from '../inventory/model.js';

/**
 * @typedef {{
 *   id: string, name: string, productId?: string|null, shopCategory: string, quantity: number, unit: string,
 *   priority: 'low'|'normal'|'high', estPriceMinor?: number|null, checked: boolean, checkedAt?: string|null,
 *   source: string, sourceId?: string|null, note?: string,
 * }} ShoppingItem
 * @typedef {{ name: string, productId?: string|null, shopCategory: string, quantity: number, unit: string, source: string, sourceId?: string|null }} ShoppingEntry
 */

/** Unchecked items grouped by aisle in store order. @param {ShoppingItem[]} items */
export function aisles(items) {
  const open = items.filter((i) => !i.checked);
  const priority = { high: 0, normal: 1, low: 2 };
  return SHOP_CATEGORIES.map((key) => ({
    key,
    items: open.filter((i) => (SHOP_CATEGORIES.includes(i.shopCategory) ? i.shopCategory : 'other') === key).sort((a, b) => priority[a.priority] - priority[b.priority] || a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length);
}

/**
 * Line estimate: explicit estimate, else last product price scaled to the quantity.
 * @param {ShoppingItem} item
 * @param {(id: string) => { lastPriceMinor?: number|null, defaultQty: number, defaultUnit: string }|undefined} productOf
 * @returns {{ minor: number|null, approx: boolean }}
 */
export function lineEstimate(item, productOf) {
  if (typeof item.estPriceMinor === 'number') return { minor: item.estPriceMinor, approx: false };
  const product = item.productId ? productOf(item.productId) : undefined;
  if (!product || typeof product.lastPriceMinor !== 'number') return { minor: null, approx: true };
  const qty = convert(item.quantity, /** @type {any} */ (item.unit), /** @type {any} */ (product.defaultUnit));
  if (qty === null || !product.defaultQty) return { minor: null, approx: true };
  return { minor: Math.round((product.lastPriceMinor * qty) / product.defaultQty), approx: true };
}

/**
 * @param {ShoppingItem[]} items unchecked items
 * @param {(id: string) => any} productOf
 */
export function estimateTotal(items, productOf) {
  let total = 0;
  let approx = false;
  let known = 0;
  for (const item of items) {
    const { minor, approx: a } = lineEstimate(item, productOf);
    if (minor !== null) {
      total += minor;
      known++;
    }
    if (a) approx = true;
  }
  return { total, approx, known };
}

const UNIT_WORDS = /** @type {Record<string, string>} */ ({
  kg: 'kg', кг: 'kg', g: 'g', gr: 'g', г: 'g', гр: 'g', l: 'l', л: 'l', ml: 'ml', мл: 'ml', pcs: 'pcs', pc: 'pcs', шт: 'pcs', pack: 'pack', уп: 'pack',
});

/**
 * "2 kg apples", "apples 2", "3 eggs", "молоко 1 л" → { quantity, unit, name }.
 * @param {string} text
 */
export function parseQuickAdd(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  let quantity = null;
  let unit = null;
  /** @param {string} w */
  const num = (w) => (/^\d+([.,]\d+)?$/.test(w) ? Number(w.replace(',', '.')) : null);
  /** @param {string} w */
  const unitOf = (w) => UNIT_WORDS[w.toLowerCase().replace(/\.$/, '')] ?? null;
  if (words.length > 1 && num(words[0]) !== null) {
    quantity = num(words.shift() ?? '');
    if (words.length > 1 && unitOf(words[0])) unit = unitOf(words.shift() ?? '');
  } else if (words.length > 1 && num(words[words.length - 1]) !== null) {
    quantity = num(words.pop() ?? '');
  } else if (words.length > 2 && unitOf(words[words.length - 1]) && num(words[words.length - 2]) !== null) {
    unit = unitOf(words.pop() ?? '');
    quantity = num(words.pop() ?? '');
  }
  return { name: words.join(' '), quantity, unit };
}

/**
 * Index of an unchecked list item matching an entry (same product or name).
 * @param {ShoppingItem[]} items
 * @param {{ name: string, productId?: string|null }} entry
 */
export function findOpenItem(items, entry) {
  const key = normalizeName(entry.name);
  return items.find((i) => !i.checked && ((entry.productId && i.productId === entry.productId) || normalizeName(i.name) === key));
}

/**
 * Suggestions (F-4): low-stock inventory, medication refills, missing creative materials — not yet on the list.
 * @param {{ inventory: import('../inventory/model.js').InventoryItem[], meds: any[], shopping: ShoppingItem[], productOf: (id: string) => any }} input
 * @returns {(ShoppingEntry & { key: string })[]}
 */
export function suggestions({ inventory, meds, shopping, productOf }) {
  /** @type {(ShoppingEntry & { key: string })[]} */
  const out = [];
  for (const item of inventory.filter(isLow)) {
    const product = item.productId ? productOf(item.productId) : undefined;
    const entry = {
      key: `low:${item.id}`,
      name: item.name,
      productId: item.productId ?? null,
      shopCategory: product?.shopCategory ?? 'other',
      quantity: product?.defaultQty ?? 1,
      unit: product?.defaultUnit ?? item.unit,
      source: 'low_stock',
      sourceId: item.id,
    };
    if (!findOpenItem(shopping, entry)) out.push(entry);
  }
  for (const med of meds) {
    if (!med.active || typeof med.stock !== 'number' || typeof med.refillAt !== 'number' || med.stock > med.refillAt) continue;
    const entry = { key: `refill:${med.id}`, name: med.name, productId: null, shopCategory: 'pharmacy', quantity: 1, unit: 'pack', source: 'refill', sourceId: med.id };
    if (!findOpenItem(shopping, entry)) out.push(entry);
  }
  return out;
}
