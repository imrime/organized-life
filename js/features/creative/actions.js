// @ts-check
// Creative project mutations; missing materials go to the shopping list (hobby aisle, no duplicates).

import { appStore } from '../../core/store.js';
import { today } from '../../core/time.js';
import { addShoppingTx } from '../shopping/actions.js';
import { setMembershipTx } from '../media/actions.js';
import { projectStatusPatch, creativeSuggestions } from './model.js';

/** @typedef {import('./model.js').CreativeProject} CreativeProject */

/**
 * @param {Omit<CreativeProject, 'id'|'order'>} form
 * @param {string|null} id
 * @param {string[]} [collectionIds]
 */
export function saveProject(form, id, collectionIds) {
  return appStore.mutate('creative.save', (tx) => {
    const existing = id ? tx.get('creativeProjects', id) : undefined;
    const fields = { ...form, title: form.title.trim(), ...(existing?.status === form.status ? {} : projectStatusPatch(existing ?? form, form.status, today())) };
    const saved = id ? tx.patch('creativeProjects', id, fields) : tx.insert('creativeProjects', { ...fields, order: tx.all('creativeProjects').length });
    if (collectionIds) setMembershipTx(tx, saved.id, collectionIds);
    return saved;
  });
}

/** @param {string} id @param {CreativeProject['status']} status */
export function setProjectStatus(id, status) {
  return appStore.mutate('creative.status', (tx) => {
    const p = tx.get('creativeProjects', id);
    if (p) tx.patch('creativeProjects', id, projectStatusPatch(p, status, today()));
  });
}

/** @param {string} id */
export function deleteProject(id) {
  return appStore.mutate('creative.delete', (tx) => {
    tx.all('mediaCollections').filter((c) => c.itemIds.includes(id)).forEach((c) => tx.patch('mediaCollections', c.id, { itemIds: c.itemIds.filter((/** @type {string} */ x) => x !== id) }));
    tx.remove('creativeProjects', id);
  });
}

/** Adds this project's missing materials that are not on the list yet. @param {string} id */
export function addMissingMaterials(id) {
  return appStore.mutate('creative.toShopping', (tx) => {
    const project = tx.get('creativeProjects', id);
    if (!project) return 0;
    const entries = creativeSuggestions([/** @type {any} */ (project)], tx.all('shoppingItems'));
    entries.forEach((e) => addShoppingTx(tx, /** @type {any} */ (e)));
    return entries.length;
  });
}
