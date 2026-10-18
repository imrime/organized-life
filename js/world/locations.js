// @ts-check
// Location registry: order, palettes and visibility. Geometry of objects lives in rooms/*.js.

/**
 * @typedef {'bedroom'|'kitchen'|'bathroom'|'entertainment'|'study'|'gym'|'town'} LocationId
 * @typedef {{
 *   id: LocationId,
 *   group: 'home'|'out',
 *   emoji: string,
 *   wall: string,
 *   floor: string,
 *   floorLine: number,
 *   optional: boolean,
 *   shipped: boolean,
 * }} Location
 */

/** @type {Location[]} — `shipped` flips to true in the release that builds the room. */
export const LOCATIONS = [
  { id: 'bedroom', group: 'home', emoji: '🛏️', wall: '#E8D9D1', floor: '#C7AB91', floorLine: 0.58, optional: false, shipped: true },
  { id: 'kitchen', group: 'home', emoji: '🍳', wall: '#E1E6DD', floor: '#C8B898', floorLine: 0.6, optional: false, shipped: true },
  { id: 'bathroom', group: 'home', emoji: '🛁', wall: '#DDE7E6', floor: '#C9C3B8', floorLine: 0.6, optional: false, shipped: true },
  { id: 'entertainment', group: 'home', emoji: '🎮', wall: '#EADCDF', floor: '#BBA898', floorLine: 0.6, optional: false, shipped: true },
  { id: 'study', group: 'home', emoji: '📚', wall: '#E4E4EA', floor: '#BDB2A4', floorLine: 0.62, optional: true, shipped: false },
  { id: 'gym', group: 'home', emoji: '🏋️', wall: '#E1E7DF', floor: '#B8B5A2', floorLine: 0.62, optional: true, shipped: false },
  { id: 'town', group: 'out', emoji: '🏙️', wall: '#DDE7E6', floor: '#C4B19A', floorLine: 0.36, optional: false, shipped: true },
];

/**
 * @param {string|null|undefined} id
 * @returns {Location|undefined}
 */
export function locationById(id) {
  return LOCATIONS.find((loc) => loc.id === id);
}

/**
 * Shipped and not hidden by the user (Study and Gym can be hidden in Settings).
 * @param {Location} loc
 * @param {{ optionalRooms?: Record<string, boolean> }} settings
 */
export function isVisible(loc, settings) {
  if (!loc.shipped) return false;
  if (!loc.optional) return true;
  return settings.optionalRooms?.[loc.id] !== false;
}

/** @param {{ optionalRooms?: Record<string, boolean> }} settings */
export function visibleLocations(settings) {
  return LOCATIONS.filter((loc) => isVisible(loc, settings));
}
