// @ts-check
// Checkout (F-1): transactions + inventory + product prices + shopping list in one atomic mutation with a single Undo.

import { appStore } from '../../core/store.js';
import { newId } from '../../core/ids.js';
import { nameOf } from '../../core/i18n.js';
import { normalizeName } from '../../core/text.js';
import { convert } from '../../core/units.js';
import { ensureProductTx } from '../products/model.js';
import { upsertInventoryTx } from '../inventory/actions.js';
import { splitByCategory } from './model.js';

/** @typedef {import('./model.js').CheckoutLine} CheckoutLine */

/**
 * @param {{ lines: CheckoutLine[], actualTotalMinor: number, accountId: string, date: string }} input
 */
export function checkout({ lines, actualTotalMinor, accountId, date }) {
  return appStore.mutate('checkout', (tx) => {
    const batchId = newId();
    for (const line of lines) {
      const product = line.productId ? tx.get('products', line.productId) : ensureProductTx(tx, line.name, { category: line.category, unit: line.unit, quantity: line.quantity }, nameOf);
      if (product && line.quantity > 0 && line.priceMinor > 0) {
        const qty = convert(line.quantity, /** @type {any} */ (line.unit), product.defaultUnit);
        if (qty) tx.patch('products', product.id, { lastPriceMinor: Math.round((line.priceMinor * product.defaultQty) / qty) });
      }
      if (line.destination !== 'none') {
        upsertInventoryTx(tx, {
          name: line.name,
          productId: product?.id ?? null,
          location: line.destination,
          category: line.category,
          quantity: line.quantity,
          unit: line.unit,
          expiryDate: line.expiryDate || null,
          openedAt: null,
          useWithinMonths: null,
          lowStockAt: null,
          spot: '',
          notes: '',
        });
      }
      // Bought items leave the shopping list (partially bought ones keep the remainder).
      const listed = tx
        .all('shoppingItems')
        .find((s) => (line.shoppingItemId ? s.id === line.shoppingItemId : (product && s.productId === product.id) || normalizeName(s.name) === normalizeName(line.name)));
      if (listed) {
        const bought = convert(line.quantity, /** @type {any} */ (line.unit), listed.unit);
        if (bought !== null && bought < listed.quantity && !listed.checked) tx.patch('shoppingItems', listed.id, { quantity: Math.round((listed.quantity - bought) * 1000) / 1000 });
        else tx.remove('shoppingItems', listed.id);
      }
    }
    for (const group of splitByCategory(lines, actualTotalMinor)) {
      tx.insert('transactions', { accountId, type: 'expense', amountMinor: group.amountMinor, categoryId: group.financeCategoryId, date, note: '', source: { type: 'grocery', batchId } });
    }
    return batchId;
  });
}
