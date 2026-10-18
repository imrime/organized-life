// @ts-check
// Clothing purchase (F-6): wardrobe item + Clothing expense (unless free) + optional equip, in one undoable mutation.

import { appStore } from '../../core/store.js';
import { newId } from '../../core/ids.js';
import { PROFILE } from '../../core/schema.js';
import { wearInSlot } from '../wardrobe/catalog.js';

/**
 * @typedef {{
 *   name: string, slot: string, template: string, color: string, laundryGroup: string, care: string, season: string,
 *   priceMinor: number, date: string, accountId: string, wear: boolean,
 * }} Purchase
 */

/** @param {Purchase} p */
export function buyClothing(p) {
  return appStore.mutate('shop.clothing', (tx) => {
    const item = tx.insert('clothingItems', {
      name: p.name.trim(),
      slot: p.slot,
      template: p.template,
      color: p.color,
      laundryGroup: p.laundryGroup,
      care: p.care,
      season: p.season,
      status: 'clean',
      favorite: false,
      isNew: true,
      priceMinor: p.priceMinor,
      purchasedAt: p.date,
      transactionId: null,
      washCount: 0,
      notes: '',
    });
    if (p.priceMinor > 0) {
      const t = tx.insert('transactions', {
        accountId: p.accountId,
        type: 'expense',
        amountMinor: p.priceMinor,
        categoryId: 'cat-clothing',
        date: p.date,
        note: p.name.trim(),
        source: { type: 'clothing', batchId: newId() },
      });
      tx.patch('clothingItems', item.id, { transactionId: t.id });
    }
    if (p.wear) {
      const character = tx.get('profile', PROFILE.character);
      tx.setProfile(PROFILE.character, { equipped: wearInSlot(character?.equipped ?? {}, /** @type {any} */ (p.slot), item.id) });
    }
    return item.id;
  });
}
