// @ts-check
// Recipe mutations, including "add missing items" to the shopping list (F-2).

import { appStore } from '../../core/store.js';
import { newId } from '../../core/ids.js';
import { nameOf, t } from '../../core/i18n.js';
import { ensureProductTx } from '../products/model.js';
import { addShoppingTx } from '../shopping/actions.js';
import { missingIngredients } from './model.js';

/** @typedef {import('./model.js').Recipe} Recipe */

/**
 * @param {Record<string, any>} form
 * @param {string|null} id
 */
export function saveRecipe(form, id) {
  return appStore.mutate('recipes.save', (tx) => {
    const fields = {
      title: form.title.trim(),
      servings: Number(form.servings),
      prepMin: form.prepMin === '' ? null : Number(form.prepMin),
      cookMin: form.cookMin === '' ? null : Number(form.cookMin),
      tags: form.tags,
      ingredients: form.ingredients
        .filter((/** @type {any} */ i) => i.name.trim())
        .map((/** @type {any} */ i) => {
          const product = ensureProductTx(tx, i.name, { unit: i.unit || undefined }, nameOf);
          return { id: i.id ?? newId(), name: i.name.trim(), productId: product.id, quantity: i.quantity === '' || i.quantity === null ? null : Number(i.quantity), unit: i.unit || null, optional: Boolean(i.optional) };
        }),
      steps: form.steps.filter((/** @type {any} */ s) => s.text.trim()).map((/** @type {any} */ s) => ({ id: s.id ?? newId(), text: s.text.trim() })),
      notes: form.notes,
    };
    return id ? tx.patch('recipes', id, fields) : tx.insert('recipes', { ...fields, favorite: false, lastCookedAt: null, cookCount: 0 });
  });
}

/** @param {string} id */
export function deleteRecipe(id) {
  return appStore.mutate('recipes.delete', (tx) => tx.remove('recipes', id));
}

/** @param {string} id @param {boolean} favorite */
export function setRecipeFavorite(id, favorite) {
  return appStore.mutate('recipes.favorite', (tx) => tx.patch('recipes', id, { favorite }));
}

/**
 * @param {Recipe} recipe
 * @param {number} servings
 */
export function addMissingToShopping(recipe, servings) {
  return appStore.mutate('recipes.addMissing', (tx) => {
    const missing = missingIngredients(recipe, servings, /** @type {any[]} */ (tx.all('inventoryItems')));
    for (const { ing, missing: qty, needed } of missing) {
      const product = ing.productId ? tx.get('products', ing.productId) : undefined;
      addShoppingTx(tx, {
        name: ing.name,
        productId: ing.productId ?? null,
        shopCategory: product?.shopCategory ?? 'other',
        quantity: qty ?? needed ?? product?.defaultQty ?? 1,
        unit: ing.unit ?? product?.defaultUnit ?? 'pcs',
        source: 'recipe',
        sourceId: recipe.id,
      });
    }
    return missing.length;
  });
}

/** Three localised sample recipes for the empty state. */
export function addSampleRecipes() {
  /** @type {[string, number, number, [string, number|null, string|null][], number][]} key, servings, minutes, ingredients, steps */
  const samples = [
    ['omelette', 1, 10, [['eggs', 2, 'pcs'], ['milk', 50, 'ml'], ['butter', 10, 'g'], ['salt', null, null]], 3],
    ['pasta', 2, 25, [['pasta', 200, 'g'], ['tomatoSauce', 1, 'pcs'], ['cheese', 50, 'g'], ['garlic', 1, 'pcs']], 3],
    ['oats', 1, 5, [['oats', 50, 'g'], ['milk', 150, 'ml'], ['honey', 1, 'pcs'], ['bananas', 1, 'pcs']], 2],
  ];
  return appStore.mutate('recipes.samples', (tx) => {
    for (const [key, servings, minutes, ingredients, stepCount] of samples) {
      tx.insert('recipes', {
        title: t(`recipes.samples.${key}.title`),
        servings,
        prepMin: minutes,
        cookMin: null,
        tags: [t('recipes.samples.tag')],
        ingredients: ingredients.map(([product, quantity, unit]) => {
          const p = tx.get('products', `prod-${product}`);
          return { id: newId(), name: p ? nameOf(p) : product, productId: p?.id ?? null, quantity, unit, optional: false };
        }),
        steps: Array.from({ length: stepCount }, (_, i) => ({ id: newId(), text: t(`recipes.samples.${key}.step${i + 1}`) })),
        notes: '',
        favorite: false,
        lastCookedAt: null,
        cookCount: 0,
      });
    }
  });
}
