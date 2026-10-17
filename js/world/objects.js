// @ts-check
// All interactive objects, aggregated from the room definition files.

import * as bedroom from './rooms/bedroom.js';

/** @typedef {import('./types.js').SceneObject} SceneObject */
/** @typedef {import('./types.js').CharacterSpot} CharacterSpot */

/** @type {Record<string, { objects: SceneObject[], character: CharacterSpot }>} rooms register here as they ship */
const ROOMS = { bedroom };

/** @type {SceneObject[]} */
export const OBJECTS = Object.values(ROOMS).flatMap((room) => room.objects);

/** @param {string} roomId */
export function characterSpot(roomId) {
  return ROOMS[roomId]?.character ?? { anchor: { x: 0.82, y: 0.96 }, height: 0.3, pose: 'stand' };
}

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
