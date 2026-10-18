// @ts-check
// Wardrobe, outfit and character mutations.

import { appStore } from '../../core/store.js';
import { PROFILE } from '../../core/schema.js';
import { SLOTS } from './catalog.js';

/**
 * @param {{ name: string, slot: string, template: string, color: string, laundryGroup: string, care: string, season: string, notes: string }} form
 * @param {string|null} id
 */
export function saveClothing(form, id) {
  return appStore.mutate('wardrobe.save', (tx) => {
    const fields = { name: form.name.trim(), slot: form.slot, template: form.template, color: form.color, laundryGroup: form.laundryGroup, care: form.care, season: form.season, notes: form.notes };
    if (id) {
      const previous = tx.get('clothingItems', id);
      // Renaming a seeded item replaces its translated default name.
      return tx.patch('clothingItems', id, previous?.seedKey && fields.name ? { ...fields, seedKey: undefined } : fields);
    }
    return tx.insert('clothingItems', { ...fields, status: 'clean', favorite: false, isNew: false, priceMinor: null, purchasedAt: null, transactionId: null, washCount: 0 });
  });
}

/** Deleting an equipped item un-equips it. @param {string} id */
export function deleteClothing(id) {
  return appStore.mutate('wardrobe.delete', (tx) => {
    const character = tx.get('profile', PROFILE.character);
    const equipped = { ...(character?.equipped ?? {}) };
    let changed = false;
    for (const slot of SLOTS) {
      if (equipped[slot] === id) {
        equipped[slot] = null;
        changed = true;
      }
    }
    if (changed) tx.setProfile(PROFILE.character, { equipped });
    tx.remove('clothingItems', id);
  });
}

/** @param {Record<string, string|null|undefined>} selection */
export function equip(selection) {
  return appStore.mutate('wardrobe.equip', (tx) => tx.setProfile(PROFILE.character, { equipped: { ...selection } }));
}

/** Mark as worn → goes to the laundry basket (F-7). @param {string} id */
export function markWorn(id) {
  return appStore.mutate('wardrobe.worn', (tx) => tx.patch('clothingItems', id, { status: 'dirty' }));
}

/** @param {string} id @param {boolean} favorite */
export function setFavorite(id, favorite) {
  return appStore.mutate('wardrobe.favorite', (tx) => tx.patch('clothingItems', id, { favorite }));
}

/** @param {string[]} ids */
export function clearNew(ids) {
  if (!ids.length) return Promise.resolve();
  return appStore.mutate('wardrobe.seen', (tx) => ids.forEach((id) => tx.patch('clothingItems', id, { isNew: false })), { quiet: true });
}

/**
 * @param {{ name: string, tags: string[] }} form
 * @param {Record<string, string|null|undefined>} items
 * @param {string|null} id
 */
export function saveOutfit(form, items, id) {
  return appStore.mutate('outfits.save', (tx) => {
    const fields = { name: form.name.trim(), tags: form.tags, items: { ...items } };
    return id ? tx.patch('outfits', id, fields) : tx.insert('outfits', { ...fields, favorite: false });
  });
}

/** @param {string} id */
export function deleteOutfit(id) {
  return appStore.mutate('outfits.delete', (tx) => tx.remove('outfits', id));
}

/** @param {Record<string, any>} patch */
export function saveCharacter(patch) {
  return appStore.mutate('character.save', (tx) => tx.setProfile(PROFILE.character, patch));
}
