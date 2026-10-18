// @ts-check
// Food diary logic (pure). rooms/kitchen.md K4.

import { normalizeName } from '../../core/text.js';

/**
 * @typedef {{ id: string, date: string, time?: string|null, mealType: 'breakfast'|'lunch'|'dinner'|'snack', food: string, portion?: string,
 *   kcal?: number|null, proteinG?: number|null, carbsG?: number|null, fatG?: number|null, recipeId?: string|null, notes?: string, updatedAt?: string }} Meal
 */

export const MEAL_TYPES = /** @type {const} */ (['breakfast', 'lunch', 'dinner', 'snack']);

/** Default meal type by time of day (spec K4). @param {Date} now */
export function mealTypeAt(now) {
  const m = now.getHours() * 60 + now.getMinutes();
  if (m < 10 * 60 + 30) return 'breakfast';
  if (m < 15 * 60) return 'lunch';
  if (m >= 17 * 60 && m <= 21 * 60 + 30) return 'dinner';
  return 'snack';
}

/** @param {Meal[]} meals of one day */
export function daySummary(meals) {
  /** @type {Record<string, number>} */
  const counts = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  const totals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  /** @type {Record<string, boolean>} */
  const has = { kcal: false, proteinG: false, carbsG: false, fatG: false };
  for (const meal of meals) {
    counts[meal.mealType]++;
    for (const key of /** @type {const} */ (['kcal', 'proteinG', 'carbsG', 'fatG'])) {
      const v = meal[key];
      if (typeof v === 'number') {
        totals[key] += v;
        has[key] = true;
      }
    }
  }
  return { counts, totals, has, mainMeals: counts.breakfast + counts.lunch + counts.dinner };
}

/**
 * Last distinct foods (newest first) for one-tap re-logging.
 * @param {Meal[]} meals
 * @param {number} [limit]
 */
export function recentFoods(meals, limit = 8) {
  const seen = new Set();
  /** @type {Meal[]} */
  const out = [];
  for (const meal of [...meals].sort((a, b) => `${b.date}${b.time ?? ''}${b.updatedAt ?? ''}`.localeCompare(`${a.date}${a.time ?? ''}${a.updatedAt ?? ''}`))) {
    const key = normalizeName(meal.food);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(meal);
    if (out.length >= limit) break;
  }
  return out;
}

/** @param {{ food: string }} form */
export function validateMeal(form) {
  return form.food.trim() ? {} : { food: 'form.errors.required' };
}
