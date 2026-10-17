// @ts-check
// Badge registry: feature modules register a badge function per object id.

/** @typedef {{ text: string, tone?: 'neutral'|'info'|'warn'|'alert', aria?: string }} Badge */
/** @typedef {import('../world/types.js').SceneObject} SceneObject */

/** @type {Map<string, (obj: SceneObject) => Badge|null>} */
const registry = new Map();

/**
 * @param {string} objectId
 * @param {(obj: SceneObject) => Badge|null} fn
 */
export function registerBadge(objectId, fn) {
  registry.set(objectId, fn);
}

/** @param {SceneObject} obj */
export function badgeFor(obj) {
  try {
    return registry.get(obj.id)?.(obj) ?? null;
  } catch (err) {
    console.error(`badge for ${obj.id} failed`, err);
    return null;
  }
}
