// @ts-check
// Creative projects (pure): board columns, status dates, materials (docs/spec/rooms/entertainment.md E4).

import { findOpenItem } from '../shopping/model.js';

/**
 * @typedef {{ id: string, name: string, have: boolean }} Material
 * @typedef {{
 *   id: string, title: string, medium: string, status: 'idea'|'in_progress'|'paused'|'done', nextStep?: string, materials: Material[],
 *   referenceNotes?: string, links: string[], startedAt?: string|null, finishedAt?: string|null, favorite: boolean, order: number, updatedAt?: string,
 * }} CreativeProject
 */

export const MEDIUMS = ['drawing', 'painting', 'craft', 'knitting', 'sewing', 'photo', 'writing', 'music', 'other'];
export const MEDIUM_ICON = /** @type {Record<string, string>} */ ({
  drawing: '✏️', painting: '🎨', craft: '✂️', knitting: '🧶', sewing: '🧵', photo: '📷', writing: '✍️', music: '🎼', other: '✨',
});

/** Board column of a status (paused projects stay in "In progress"). @param {CreativeProject['status']} status */
export const columnOf = (status) => (status === 'paused' ? 'in_progress' : status);

/**
 * @param {{ startedAt?: string|null, finishedAt?: string|null }} project
 * @param {CreativeProject['status']} status
 * @param {string} today
 */
export function projectStatusPatch(project, status, today) {
  /** @type {Record<string, any>} */
  const patch = { status };
  if ((status === 'in_progress' || status === 'done') && !project.startedAt) patch.startedAt = today;
  patch.finishedAt = status === 'done' ? project.finishedAt ?? today : null;
  return patch;
}

/** @param {CreativeProject} p */
export const missingMaterials = (p) => p.materials.filter((m) => !m.have && m.name.trim());

/**
 * F-4: missing materials of active projects that are not on the shopping list yet.
 * @param {CreativeProject[]} projects
 * @param {any[]} shopping
 */
export function creativeSuggestions(projects, shopping) {
  return projects
    .filter((p) => p.status !== 'done')
    .flatMap((p) =>
      missingMaterials(p).map((m) => ({
        key: `creative:${p.id}:${m.id}`,
        name: m.name.trim(),
        productId: null,
        shopCategory: 'hobby',
        quantity: 1,
        unit: 'pcs',
        source: 'creative',
        sourceId: p.id,
      })),
    )
    .filter((e) => !findOpenItem(shopping, e));
}
