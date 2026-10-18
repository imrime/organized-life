// @ts-check
// Lifetime counters for achievements whose records don't stay around (e.g. checked shopping items).

import { PROFILE } from '../../core/schema.js';

/**
 * @param {import('../../core/store.js').Tx} tx
 * @param {string} key
 * @param {number} [by]
 */
export function bumpStatTx(tx, key, by = 1) {
  const stats = tx.get('profile', PROFILE.stats);
  tx.setProfile(PROFILE.stats, { [key]: (stats?.[key] ?? 0) + by });
}
