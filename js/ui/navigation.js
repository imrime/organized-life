// @ts-check
// Travelling between locations (docs/spec/03-ux-shell.md §6).

import { getUi, setUi } from './ui-state.js';
import { closeSheet, openWindow } from './sheet.js';
import { buildHash } from '../core/router.js';
import { t } from '../core/i18n.js';
import { rememberLocation } from '../features/settings/actions.js';
import { objectById } from '../world/objects.js';

let bannerKey = 0;

/** @param {string} locationId */
export async function goToLocation(locationId) {
  if (getUi().sheet && !(await closeSheet())) return false;
  if (getUi().locationId === locationId) return true;
  const reduce = document.documentElement.dataset.motion === 'reduce';
  if (!reduce) {
    setUi({ veil: true });
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  setUi({ locationId, veil: false, banner: { text: t(`locations.${locationId}.name`), key: ++bannerKey } });
  history.replaceState({ depth: 0 }, '', buildHash({ locationId }));
  rememberLocation(locationId).catch(() => undefined);
  return true;
}

/**
 * Travels to an object's location and opens its window (next-task strip, notifications).
 * @param {string} objectId
 * @param {{ page?: string, params?: Record<string, any> }} [options]
 */
export async function openObject(objectId, { page, params } = {}) {
  const obj = objectById(objectId);
  if (!obj) return;
  if (!(await goToLocation(obj.roomId))) return;
  await openWindow(obj.window, { props: obj.windowProps ?? {}, sourceObjectId: obj.id, page, params });
}
