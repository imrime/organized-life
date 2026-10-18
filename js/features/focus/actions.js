// @ts-check
// Focus session mutations. One running/paused session at a time.

import { appStore } from '../../core/store.js';
import { isFocusOver, plannedEnd, stopOutcome } from './model.js';

/** @typedef {import('./model.js').FocusSession} FocusSession */

/** @param {{ plannedMin: number, breakMin: number, taskId: string|null, moduleId: string|null }} p */
export function startFocus(p) {
  return appStore.mutate('focus.start', (tx) => {
    const now = new Date().toISOString();
    // Close a break left open by the previous session.
    tx.all('focusSessions').filter((s) => s.breakStartedAt && !s.breakEndedAt).forEach((s) => tx.patch('focusSessions', s.id, { breakEndedAt: now }));
    const active = tx.all('focusSessions').find((s) => s.status === 'running' || s.status === 'paused');
    if (active) return active;
    return tx.insert('focusSessions', { ...p, startedAt: now, pausedAt: null, pausedTotalSec: 0, endedAt: null, status: 'running', actualMin: null, breakStartedAt: null, breakEndedAt: null, note: '' });
  });
}

/** @param {string} id */
export function pauseFocus(id) {
  return appStore.mutate('focus.pause', (tx) => tx.patch('focusSessions', id, { status: 'paused', pausedAt: new Date().toISOString() }));
}

/** @param {string} id */
export function resumeFocus(id) {
  return appStore.mutate('focus.resume', (tx) => {
    const s = tx.get('focusSessions', id);
    if (!s?.pausedAt) return;
    const extra = Math.round((Date.now() - new Date(s.pausedAt).getTime()) / 1000);
    tx.patch('focusSessions', id, { status: 'running', pausedAt: null, pausedTotalSec: (s.pausedTotalSec || 0) + extra });
  });
}

/** @param {string} id */
export function stopFocus(id) {
  return appStore.mutate('focus.stop', (tx) => {
    const s = /** @type {FocusSession|undefined} */ (/** @type {unknown} */ (tx.get('focusSessions', id)));
    if (!s) return null;
    const now = new Date();
    const outcome = stopOutcome(s, now);
    tx.patch('focusSessions', id, { ...outcome, endedAt: s.pausedAt ?? now.toISOString(), pausedAt: null });
    return outcome.status;
  });
}

/**
 * Completes running sessions whose time is up (also when the app was closed). Returns how many ended "while away".
 * @returns {Promise<{ token: string|null, result: { ended: number, away: number } }>}
 */
export function settleFocus() {
  const now = new Date();
  const due = appStore.all('focusSessions').filter((s) => isFocusOver(/** @type {any} */ (s), now));
  if (!due.length) return Promise.resolve({ token: null, result: { ended: 0, away: 0 } });
  return /** @type {any} */ (
    appStore.mutate(
      'focus.settle',
      (tx) => {
        let away = 0;
        for (const s of due) {
          const end = plannedEnd(/** @type {any} */ (s));
          if (now.getTime() - new Date(end).getTime() > 90_000) away++;
          tx.patch('focusSessions', s.id, { status: 'completed', endedAt: end, actualMin: s.plannedMin });
        }
        return { ended: due.length, away };
      },
      { quiet: true },
    )
  );
}

/** @param {string} id */
export function startBreak(id) {
  return appStore.mutate('focus.break', (tx) => tx.patch('focusSessions', id, { breakStartedAt: new Date().toISOString(), breakEndedAt: null }));
}

/** Ends (or skips) the break. @param {string} id */
export function endBreak(id) {
  return appStore.mutate('focus.breakEnd', (tx) => {
    const s = tx.get('focusSessions', id);
    const now = new Date().toISOString();
    tx.patch('focusSessions', id, { breakStartedAt: s?.breakStartedAt ?? now, breakEndedAt: now });
  });
}

/** @param {string} id @param {string} note */
export function saveFocusNote(id, note) {
  return appStore.mutate('focus.note', (tx) => tx.patch('focusSessions', id, { note }));
}

/** @param {string} id */
export function deleteFocus(id) {
  return appStore.mutate('focus.delete', (tx) => tx.remove('focusSessions', id));
}
