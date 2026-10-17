// @ts-check
// Settings mutations.

import { appStore } from '../../core/store.js';
import { PROFILE } from '../../core/schema.js';

/** @param {Record<string, any>} partial */
export function updateSettings(partial) {
  return appStore.mutate('settings.update', (tx) => tx.setProfile(PROFILE.settings, partial));
}

/**
 * Records the current location (restored on next launch) and marks it visited.
 * @param {string} locationId
 */
export function rememberLocation(locationId) {
  return appStore.mutate('settings.location', (tx) => {
    const settings = tx.get('profile', PROFILE.settings);
    const visited = settings?.visited ?? [];
    tx.setProfile(PROFILE.settings, {
      lastLocationId: locationId,
      visited: visited.includes(locationId) ? visited : [...visited, locationId],
    });
  }, { quiet: true });
}
