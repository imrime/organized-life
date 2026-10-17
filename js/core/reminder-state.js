// @ts-check
// Persistence of reminder instance state (fired / snoozed / acknowledged). Records are keyed by instance key.

import { appStore } from './store.js';

/** @param {string} key */
export function reminderState(key) {
  return /** @type {import('./reminders.js').ReminderStateRecord|undefined} */ (appStore.get('reminderState', key));
}

/**
 * @param {string[]} keys
 * @param {Record<string, any>} patch
 */
function upsert(keys, patch) {
  return appStore.mutate(
    'reminders.state',
    (tx) => {
      for (const key of keys) {
        if (tx.get('reminderState', key)) tx.patch('reminderState', key, patch);
        else tx.insert('reminderState', { id: key, ...patch });
      }
    },
    { quiet: true },
  );
}

/** @param {string[]} keys */
export function markFired(keys) {
  return upsert(keys, { firedAt: new Date().toISOString() });
}

/** @param {string[]} keys */
export function acknowledge(keys) {
  return upsert(keys, { ackAt: new Date().toISOString() });
}

/**
 * @param {string[]} keys
 * @param {Date} until
 */
export function snooze(keys, until) {
  return upsert(keys, { snoozedUntil: until.toISOString() });
}

/** Drops records older than a week (startup housekeeping). */
export function purgeOldReminderState() {
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const old = appStore.all('reminderState').filter((r) => r.updatedAt < cutoff);
  if (!old.length) return Promise.resolve();
  return appStore.mutate('reminders.purge', (tx) => old.forEach((r) => tx.purge('reminderState', r.id)), { quiet: true });
}
