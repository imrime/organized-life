// @ts-check
// Window registry: the same window opens from the scene, the objects list, quick action, the strip and deep links.
// Objects whose window is not registered yet open the "coming soon" window.

/**
 * @typedef {{ load: () => Promise<{ default: any }>, size: 'compact'|'tall', props?: Record<string, unknown> }} WindowEntry
 */

const comingSoon = () => import('./features/coming-soon/window.js');

/** @type {Record<string, WindowEntry>} */
export const windows = {
  'alarms.main': { load: () => import('./features/alarms/window.js'), size: 'tall' },
  'calendar.main': { load: () => import('./features/calendar/window.js'), size: 'tall' },
  'sleep.main': { load: () => import('./features/sleep/window.js'), size: 'tall' },
  'wardrobe.main': { load: () => import('./features/wardrobe/window.js'), size: 'tall' },
  'tasks.main': { load: () => import('./features/tasks/window.js'), size: 'tall' },
  'meds.main': { load: () => import('./features/meds/window.js'), size: 'tall' },
  'inventory.fridge': { load: () => import('./features/inventory/window.js'), size: 'tall', props: { scope: 'fridge' } },
  'inventory.pantry': { load: () => import('./features/inventory/window.js'), size: 'tall', props: { scope: 'pantry' } },
  'inventory.bathroom': { load: () => import('./features/inventory/window.js'), size: 'tall', props: { scope: 'bathroom' } },
  'routines.care': { load: () => import('./features/care/mirror.js'), size: 'tall' },
  'routines.shower': { load: () => import('./features/care/shower.js'), size: 'tall' },
  'laundry.basket': { load: () => import('./features/laundry/basket.js'), size: 'tall' },
  'laundry.machine': { load: () => import('./features/laundry/machine.js'), size: 'tall' },
  'shop.clothing': { load: () => import('./features/shop/clothing.js'), size: 'tall' },
  'walks.main': { load: () => import('./features/walks/window.js'), size: 'tall' },
  'media.screen': { load: () => import('./features/media/screen.js'), size: 'tall' },
  'media.games': { load: () => import('./features/media/games.js'), size: 'tall' },
  'media.music': { load: () => import('./features/media/music.js'), size: 'tall' },
  'media.shelf': { load: () => import('./features/media/shelf.js'), size: 'tall' },
  'creative.main': { load: () => import('./features/creative/window.js'), size: 'tall' },
  'study.main': { load: () => import('./features/study/computer.js'), size: 'tall' },
  'study.planner': { load: () => import('./features/study/planner.js'), size: 'tall' },
  'study.resources': { load: () => import('./features/study/resources.js'), size: 'tall' },
  'focus.main': { load: () => import('./features/focus/window.js'), size: 'tall' },
  'workouts.today': { load: () => import('./features/workouts/today.js'), size: 'tall' },
  'workouts.library': { load: () => import('./features/workouts/library.js'), size: 'tall' },
  'workouts.progress': { load: () => import('./features/workouts/progress.js'), size: 'tall' },
  'recipes.main': { load: () => import('./features/recipes/window.js'), size: 'tall' },
  'shopping.main': { load: () => import('./features/shopping/window.js'), size: 'tall' },
  'diary.main': { load: () => import('./features/diary/window.js'), size: 'tall' },
  'shop.grocery': { load: () => import('./features/shop/grocery.js'), size: 'tall' },
  'finance.main': { load: () => import('./features/finance/window.js'), size: 'tall' },
  'settings.main': { load: () => import('./features/settings/window.js'), size: 'tall' },
  'map.main': { load: () => import('./features/map/window.js'), size: 'compact' },
  'world.list': { load: () => import('./features/world-list/window.js'), size: 'tall' },
  'character.main': { load: () => import('./features/character/window.js'), size: 'tall' },
  'quick.main': { load: () => import('./features/quick/window.js'), size: 'compact' },
};

/** @param {string} id */
export function windowEntry(id) {
  return windows[id] ?? { load: comingSoon, size: 'compact', props: {} };
}
