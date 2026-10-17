// @ts-check
// All interactive objects, aggregated from the room definition files.

/** @typedef {import('./types.js').SceneObject} SceneObject */

/** @type {Record<string, SceneObject[]>} rooms register their objects here as they ship */
const ROOMS = {};

/** @type {SceneObject[]} */
export const OBJECTS = Object.values(ROOMS).flat();

/** @param {string} id e.g. "bedroom.alarm-clock" */
export function objectById(id) {
  return OBJECTS.find((obj) => obj.id === id);
}

/** @param {string} roomId */
export function objectsInRoom(roomId) {
  return OBJECTS.filter((obj) => obj.roomId === roomId).sort((a, b) => a.z - b.z);
}

/** @param {SceneObject} obj */
export function slugOf(obj) {
  return obj.id.slice(obj.id.indexOf('.') + 1);
}

/**
 * @param {string} roomId
 * @param {string} slug
 */
export function objectBySlug(roomId, slug) {
  return objectById(`${roomId}.${slug}`);
}

/** Tab / tour order: top-to-bottom, then left-to-right. */
export function readingOrder(/** @type {SceneObject[]} */ objects) {
  return [...objects].sort((a, b) => a.hitArea.y - b.hitArea.y || a.hitArea.x - b.hitArea.x);
}
