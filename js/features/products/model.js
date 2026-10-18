// @ts-check
// Product catalogue helpers: matching typed names to products and creating new ones (pure apart from the tx helper).

import { normalizeName, matchesQuery } from '../../core/text.js';
import { shopCategoryFor, financeCategoryFor, locationFor, shelfLifeFor } from './catalog.js';

/**
 * @typedef {{
 *   id: string, name?: string, seedKey?: string, category: string, shopCategory: string, financeCategoryId: string,
 *   defaultUnit: string, defaultQty: number, defaultLocation: string, shelfLifeDays?: number|null, lastPriceMinor?: number|null, favorite: boolean,
 * }} Product
 */

/**
 * Finds a product by its displayed name (normalised).
 * @param {Product[]} products
 * @param {string} name
 * @param {(p: Product) => string} nameOf
 */
export function findProduct(products, name, nameOf) {
  const key = normalizeName(name);
  if (!key) return undefined;
  return products.find((p) => normalizeName(nameOf(p)) === key);
}

/**
 * Products matching a query, favourites first.
 * @param {Product[]} products
 * @param {string} query
 * @param {(p: Product) => string} nameOf
 * @param {number} [limit]
 */
export function searchProducts(products, query, nameOf, limit = 30) {
  return products
    .filter((p) => matchesQuery(nameOf(p), query))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || nameOf(a).localeCompare(nameOf(b)))
    .slice(0, limit);
}

/**
 * Returns the product for a typed name, creating it inside the transaction when missing.
 * @param {import('../../core/store.js').Tx} tx
 * @param {string} name
 * @param {{ category?: string, unit?: string, quantity?: number, location?: string }} hints
 * @param {(p: any) => string} nameOf
 * @returns {Product}
 */
export function ensureProductTx(tx, name, hints, nameOf) {
  const existing = findProduct(/** @type {Product[]} */ (/** @type {unknown} */ (tx.all('products'))), name, nameOf);
  if (existing) return existing;
  const category = hints.category ?? 'other_food';
  const shopCategory = shopCategoryFor(category);
  return /** @type {Product} */ (
    /** @type {unknown} */ (
      tx.insert('products', {
        name: name.trim().slice(0, 80),
        category,
        shopCategory,
        financeCategoryId: financeCategoryFor(shopCategory),
        defaultUnit: hints.unit ?? 'pcs',
        defaultQty: hints.quantity ?? 1,
        defaultLocation: hints.location ?? locationFor(category),
        shelfLifeDays: shelfLifeFor(category),
        lastPriceMinor: null,
        favorite: false,
      })
    )
  );
}
