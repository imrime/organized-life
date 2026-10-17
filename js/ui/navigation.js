// @ts-check
// Travelling between locations (docs/spec/03-ux-shell.md §6).

import { getUi, setUi } from './ui-state.js';
import { closeSheet } from './sheet.js';
import { buildHash } from '../core/router.js';
import { t } from '../core/i18n.js';
import { rememberLocation } from '../features/settings/actions.js';

let bannerKey = 0;

/** @param {string} locationId */
export async function goToLocation(locationId) {
  if (getUi().sheet && !(await closeSheet())) return;
  if (getUi().locationId === locationId) return;
  const reduce = document.documentElement.dataset.motion === 'reduce';
  if (!reduce) {
    setUi({ veil: true });
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  setUi({ locationId, veil: false, banner: { text: t(`locations.${locationId}.name`), key: ++bannerKey } });
  history.replaceState({ depth: 0 }, '', buildHash({ locationId }));
  rememberLocation(locationId).catch(() => undefined);
}
