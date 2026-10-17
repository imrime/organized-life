// @ts-check
// Per-object scene feedback registries: badges, on-object text displays and art states.
// Feature modules register functions here; the scene calls them on every render.

/** @typedef {{ text: string, tone?: 'neutral'|'info'|'warn'|'alert', aria?: string }} Badge */
/** @typedef {{ lines: string[], aria?: string, dim?: boolean }} Display text drawn on the object (clock digits, calendar date) */
/** @typedef {import('../world/types.js').SceneObject} SceneObject */

/** @type {Map<string, (obj: SceneObject) => Badge|null>} */
const badges = new Map();
/** @type {Map<string, (obj: SceneObject) => Display|null>} */
const displays = new Map();
/** @type {Map<string, () => string>} */
const states = new Map();

/**
 * @param {string} objectId
 * @param {(obj: SceneObject) => Badge|null} fn
 */
export function registerBadge(objectId, fn) {
  badges.set(objectId, fn);
}

/**
 * @param {string} objectId
 * @param {(obj: SceneObject) => Display|null} fn
 */
export function registerDisplay(objectId, fn) {
  displays.set(objectId, fn);
}

/**
 * @param {string} objectId
 * @param {() => string} fn returns the art state name (e.g. "armed", "turned-down")
 */
export function registerVisualState(objectId, fn) {
  states.set(objectId, fn);
}

/**
 * @template T
 * @param {Map<string, (obj: SceneObject) => T|null>} map
 * @param {SceneObject} obj
 * @returns {T|null}
 */
function safe(map, obj) {
  try {
    return map.get(obj.id)?.(obj) ?? null;
  } catch (err) {
    console.error(`scene feedback for ${obj.id} failed`, err);
    return null;
  }
}

/** @param {SceneObject} obj */
export const badgeFor = (obj) => safe(badges, obj);
/** @param {SceneObject} obj */
export const displayFor = (obj) => safe(displays, obj);

/** @param {string} objectId */
export function visualStateFor(objectId) {
  try {
    return states.get(objectId)?.() ?? 'default';
  } catch {
    return 'default';
  }
}

/**
 * Accessible state text for an object (used by hit buttons and the objects list).
 * @param {SceneObject} obj
 */
export function stateTextFor(obj) {
  const display = displayFor(obj);
  const badge = badgeFor(obj);
  return [display?.aria, badge?.aria ?? badge?.text].filter(Boolean).join(', ');
}
