// @ts-check
// Recipe logic (pure): servings scaling and availability against food stock (F-2). rooms/kitchen.md K2.

import { normalizeName } from '../../core/text.js';
import { convert } from '../../core/units.js';

/**
 * @typedef {{ id: string, name: string, productId?: string|null, quantity?: number|null, unit?: string|null, optional: boolean }} Ingredient
 * @typedef {{ id: string, title: string, servings: number, prepMin?: number|null, cookMin?: number|null, tags: string[], ingredients: Ingredient[], steps: { id: string, text: string }[], notes?: string, favorite: boolean }} Recipe
 * @typedef {{ state: 'have'|'missing'|'partial'|'check', missing: number|null }} Availability
 */

/** Rounds scaled quantities sensibly (pcs to 0.5, g/ml to 5, others to 0.05). @param {number} q @param {string|null|undefined} unit */
export function roundScaled(q, unit) {
  if (unit === 'pcs' || unit === 'pack' || !unit) return Math.max(0.5, Math.round(q * 2) / 2);
  if (unit === 'g' || unit === 'ml') return Math.max(5, Math.round(q / 5) * 5);
  return Math.round(q * 20) / 20;
}

/** @param {Ingredient} ing @param {number} from @param {number} to */
export function scaledQuantity(ing, from, to) {
  if (typeof ing.quantity !== 'number') return null;
  return roundScaled((ing.quantity * to) / Math.max(1, from), ing.unit);
}

/**
 * Availability of one ingredient across fridge, freezer and pantry.
 * @param {Ingredient} ing
 * @param {number|null} needed scaled quantity
 * @param {import('../inventory/model.js').InventoryItem[]} stock food items
 * @returns {Availability}
 */
export function availability(ing, needed, stock) {
  const key = normalizeName(ing.name);
  const matches = stock.filter((i) => ['fridge', 'freezer', 'pantry'].includes(i.location) && ((ing.productId && i.productId === ing.productId) || normalizeName(i.name) === key) && i.quantity > 0);
  if (!matches.length) return { state: 'missing', missing: needed };
  if (needed === null || !ing.unit) return { state: 'have', missing: 0 };
  let have = 0;
  for (const item of matches) {
    const q = convert(item.quantity, /** @type {any} */ (item.unit), /** @type {any} */ (ing.unit));
    if (q === null) return { state: 'check', missing: null };
    have += q;
  }
  if (have >= needed) return { state: 'have', missing: 0 };
  return { state: 'partial', missing: Math.round((needed - have) * 1000) / 1000 };
}

/**
 * Ingredients still to buy for the chosen servings (optional ones excluded).
 * @param {Recipe} recipe
 * @param {number} servings
 * @param {import('../inventory/model.js').InventoryItem[]} stock
 */
export function missingIngredients(recipe, servings, stock) {
  return recipe.ingredients
    .filter((ing) => !ing.optional)
    .map((ing) => {
      const needed = scaledQuantity(ing, recipe.servings, servings);
      return { ing, needed, ...availability(ing, needed, stock) };
    })
    .filter((x) => x.state === 'missing' || x.state === 'partial');
}

/** @param {Record<string, any>} form */
export function validateRecipe(form) {
  /** @type {Record<string, string>} */
  const errors = {};
  if (!form.title.trim()) errors.title = 'form.errors.required';
  if (!(form.servings >= 1 && form.servings <= 50)) errors.servings = 'recipes.errors.servings';
  if (!form.ingredients.some((/** @type {any} */ i) => i.name.trim())) errors.ingredients = 'recipes.errors.ingredients';
  return errors;
}
