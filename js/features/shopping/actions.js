// @ts-check
// Shopping list mutations. addShoppingTx is shared by recipes, inventory and suggestions (F-2, F-4).

import { appStore } from '../../core/store.js';
import { nameOf } from '../../core/i18n.js';
import { convert } from '../../core/units.js';
import { ensureProductTx } from '../products/model.js';
import { findOpenItem, parseQuickAdd } from './model.js';

/** @typedef {import('./model.js').ShoppingEntry} ShoppingEntry */

/**
 * Adds an entry, merging into an unchecked item of the same product/name when units are compatible.
 * @param {import('../../core/store.js').Tx} tx
 * @param {ShoppingEntry} entry
 */
export function addShoppingTx(tx, entry) {
  const items = /** @type {any[]} */ (tx.all('shoppingItems'));
  const existing = findOpenItem(items, entry);
  if (existing) {
    const extra = convert(entry.quantity, /** @type {any} */ (entry.unit), existing.unit);
    if (extra !== null) return tx.patch('shoppingItems', existing.id, { quantity: Math.round((existing.quantity + extra) * 1000) / 1000 });
  }
  return tx.insert('shoppingItems', {
    name: entry.name,
    productId: entry.productId ?? null,
    shopCategory: entry.shopCategory,
    quantity: entry.quantity,
    unit: entry.unit,
    priority: 'normal',
    estPriceMinor: null,
    checked: false,
    checkedAt: null,
    source: entry.source,
    sourceId: entry.sourceId ?? null,
    note: '',
  });
}

/** "2 kg apples" → list item linked to the product (created if new). @param {string} text */
export function quickAddShopping(text) {
  const parsed = parseQuickAdd(text);
  if (!parsed.name) return Promise.resolve({ token: null, result: null });
  return appStore.mutate('shopping.add', (tx) => {
    const product = ensureProductTx(tx, parsed.name, { unit: parsed.unit ?? undefined }, nameOf);
    return addShoppingTx(tx, {
      name: nameOf(product) || parsed.name,
      productId: product.id,
      shopCategory: product.shopCategory,
      quantity: parsed.quantity ?? product.defaultQty ?? 1,
      unit: parsed.unit ?? product.defaultUnit ?? 'pcs',
      source: 'manual',
    });
  });
}

/** @param {ShoppingEntry[]} entries */
export function addShoppingEntries(entries) {
  return appStore.mutate('shopping.addMany', (tx) => entries.map((e) => addShoppingTx(tx, e)));
}

/** @param {string} id @param {boolean} checked */
export function setChecked(id, checked) {
  return appStore.mutate('shopping.check', (tx) => tx.patch('shoppingItems', id, { checked, checkedAt: checked ? new Date().toISOString() : null }));
}

/**
 * @param {Record<string, any>} form
 * @param {string|null} id
 */
export function saveShoppingItem(form, id) {
  return appStore.mutate('shopping.save', (tx) => {
    const product = ensureProductTx(tx, form.name, { unit: form.unit }, nameOf);
    const fields = {
      name: form.name.trim(),
      productId: product.id,
      shopCategory: form.shopCategory,
      quantity: Number(form.quantity) || 1,
      unit: form.unit,
      priority: form.priority,
      estPriceMinor: form.estPriceMinor,
      note: form.note,
    };
    return id ? tx.patch('shoppingItems', id, fields) : tx.insert('shoppingItems', { ...fields, checked: false, checkedAt: null, source: 'manual', sourceId: null });
  });
}

/** @param {string} id */
export function deleteShoppingItem(id) {
  return appStore.mutate('shopping.delete', (tx) => tx.remove('shoppingItems', id));
}

export function clearChecked() {
  return appStore.mutate('shopping.clear', (tx) => tx.all('shoppingItems').filter((i) => i.checked).forEach((i) => tx.remove('shoppingItems', i.id)));
}

export function uncheckAll() {
  return appStore.mutate('shopping.uncheck', (tx) => tx.all('shoppingItems').filter((i) => i.checked).forEach((i) => tx.patch('shoppingItems', i.id, { checked: false, checkedAt: null })));
}
