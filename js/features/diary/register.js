// @ts-check
// Dining table: plates for today's main meals (no badge — no pressure).

import { appStore } from '../../core/store.js';
import { today } from '../../core/time.js';
import { registerVisualState } from '../../scene/badges.js';
import { daySummary } from './model.js';

registerVisualState('kitchen.dining-table', () => {
  const day = today();
  const meals = /** @type {any[]} */ (appStore.all('meals')).filter((m) => m.date === day);
  return `plates-${Math.min(3, daySummary(meals).mainMeals)}`;
});
