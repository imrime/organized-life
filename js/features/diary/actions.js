// @ts-check
// Food diary mutations.

import { appStore } from '../../core/store.js';

/** @param {any} v */
const num = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * @param {Record<string, any>} form
 * @param {string|null} id
 */
export function saveMeal(form, id) {
  return appStore.mutate('diary.save', (tx) => {
    const fields = {
      date: form.date,
      time: form.time || null,
      mealType: form.mealType,
      food: form.food.trim(),
      portion: form.portion.trim(),
      kcal: num(form.kcal),
      proteinG: num(form.proteinG),
      carbsG: num(form.carbsG),
      fatG: num(form.fatG),
      recipeId: form.recipeId || null,
      notes: form.notes,
    };
    return id ? tx.patch('meals', id, fields) : tx.insert('meals', fields);
  });
}

/** @param {string} id */
export function deleteMeal(id) {
  return appStore.mutate('diary.delete', (tx) => tx.remove('meals', id));
}
