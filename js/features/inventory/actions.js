// @ts-check
// Inventory mutations (fridge, freezer, pantry, bathroom cabinet).

import { appStore } from '../../core/store.js';
import { nameOf } from '../../core/i18n.js';
import { ensureProductTx } from '../products/model.js';
import { mergeTarget, roundQty } from './model.js';
import { addShoppingTx } from '../shopping/actions.js';

/** @typedef {import('./model.js').InventoryItem} InventoryItem */

/**
 * Upserts a batch inside a transaction: merges into an identical batch, else inserts.
 * @param {import('../../core/store.js').Tx} tx
 * @param {Omit<InventoryItem, 'id'>} item
 * @returns {{ id: string, merged: boolean, quantity: number }}
 */
export function upsertInventoryTx(tx, item) {
  const target = mergeTarget(/** @type {any[]} */ (tx.all('inventoryItems')), item);
  if (target) {
    const quantity = roundQty(target.quantity + item.quantity);
    tx.patch('inventoryItems', target.id, { quantity });
    return { id: target.id, merged: true, quantity };
  }
  const created = tx.insert('inventoryItems', item);
  return { id: created.id, merged: false, quantity: item.quantity };
}

/**
 * @param {Record<string, any>} form
 * @param {string|null} id
 */
export function saveInventoryItem(form, id) {
  return appStore.mutate('inventory.save', (tx) => {
    const product = ensureProductTx(tx, form.name, { category: form.category, unit: form.unit, location: form.location }, nameOf);
    const fields = {
      name: form.name.trim(),
      productId: product.id,
      location: form.location,
      category: form.category,
      quantity: roundQty(Number(form.quantity) || 0),
      unit: form.unit,
      expiryDate: form.expiryDate || null,
      openedAt: form.openedAt || null,
      useWithinMonths: form.useWithinMonths ? Number(form.useWithinMonths) : null,
      lowStockAt: form.lowStockAt === '' || form.lowStockAt === null || form.lowStockAt === undefined ? null : Number(form.lowStockAt),
      spot: (form.spot ?? '').trim(),
      notes: form.notes ?? '',
    };
    if (id) {
      tx.patch('inventoryItems', id, fields);
      return { id, merged: false, quantity: fields.quantity };
    }
    return upsertInventoryTx(tx, fields);
  });
}

/**
 * Sets the quantity; at zero the item is removed unless it tracks a low-stock threshold (then it shows "Out").
 * @param {string} id
 * @param {number} quantity
 */
export function setQuantity(id, quantity) {
  return appStore.mutate('inventory.qty', (tx) => {
    const item = tx.get('inventoryItems', id);
    if (!item) return;
    const q = Math.max(0, roundQty(quantity));
    if (q === 0 && (item.lowStockAt === null || item.lowStockAt === undefined)) tx.remove('inventoryItems', id);
    else tx.patch('inventoryItems', id, { quantity: q });
  });
}

/** @param {string} id @param {string} location */
export function moveItem(id, location) {
  return appStore.mutate('inventory.move', (tx) => tx.patch('inventoryItems', id, { location }));
}

/** @param {string} id */
export function deleteInventoryItem(id) {
  return appStore.mutate('inventory.delete', (tx) => tx.remove('inventoryItems', id));
}

/**
 * Adds every low/out item of a scope to the shopping list (F-4 banner).
 * @param {InventoryItem[]} items
 */
export function addLowToShopping(items) {
  return appStore.mutate('inventory.lowToList', (tx) =>
    items.map((item) => {
      const product = item.productId ? tx.get('products', item.productId) : undefined;
      return addShoppingTx(tx, {
        name: item.name,
        productId: item.productId ?? null,
        shopCategory: product?.shopCategory ?? 'other',
        quantity: product?.defaultQty ?? 1,
        unit: product?.defaultUnit ?? item.unit,
        source: 'low_stock',
        sourceId: item.id,
      });
    }),
  );
}
