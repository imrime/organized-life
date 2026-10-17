// @ts-check
// Shared JSDoc types for the world definition (docs/spec/02-architecture.md §6).

/**
 * @typedef {{ x: number, y: number, width: number, height: number }} Rect  normalised to the safe zone (0..1)
 * @typedef {{
 *   id: string,
 *   roomId: import('./locations.js').LocationId,
 *   code: string,
 *   labelKey: string,
 *   descriptionKey: string,
 *   action: 'open_window'|'navigate',
 *   window: string,
 *   windowProps?: Record<string, unknown>,
 *   hitArea: Rect,
 *   z: number,
 *   dataKey: string|string[],
 *   feedback: string,
 *   phase: number,
 * }} SceneObject
 * @typedef {{ anchor: { x: number, y: number }, height: number, pose: 'stand'|'sit' }} CharacterSpot
 */

export {};
