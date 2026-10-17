// @ts-check
// Window registry: the same window opens from the scene, the objects list, quick action, the strip and deep links.

/**
 * @typedef {{ load: () => Promise<{ default: any }>, size: 'compact'|'tall', props?: Record<string, unknown> }} WindowEntry
 */

const comingSoon = () => import('./features/coming-soon/window.js');

/** @type {Record<string, WindowEntry>} */
export const windows = {
  'settings.main': { load: () => import('./features/settings/window.js'), size: 'tall' },
  'map.main': { load: () => import('./features/map/window.js'), size: 'compact' },
  'world.list': { load: () => import('./features/world-list/window.js'), size: 'tall' },
  'character.main': { load: comingSoon, size: 'compact', props: { titleKey: 'character.title' } },
  'quick.main': { load: comingSoon, size: 'compact', props: { titleKey: 'quick.title' } },
};

/** @param {string} id */
export function windowEntry(id) {
  return windows[id] ?? { load: comingSoon, size: 'compact', props: {} };
}
