// @ts-check
// Sleep mutations, including the sleep plan ↔ primary alarm link (docs/spec/05-cross-system.md F-8).

import { appStore } from '../../core/store.js';
import { PROFILE } from '../../core/schema.js';
import { morningOf, toLocalDateTime } from './model.js';

/** @typedef {import('./model.js').SleepPlan} SleepPlan */

/**
 * Saves the plan; with linkAlarm on, creates/updates the primary alarm to ring at wake time on the chosen days.
 * @param {Partial<SleepPlan>} patch
 */
export function savePlan(patch) {
  return appStore.mutate('sleep.plan', (tx) => {
    const plan = /** @type {SleepPlan} */ ({ ...tx.get('profile', PROFILE.sleepPlan), ...patch });
    tx.setProfile(PROFILE.sleepPlan, patch);
    if (!plan.linkAlarm) return;
    const primary = tx.all('alarms').find((a) => a.primary);
    const fields = { time: plan.wakeTime, repeatDays: [...plan.alarmDays].sort(), enabled: true };
    if (primary) tx.patch('alarms', primary.id, fields);
    else tx.insert('alarms', { ...fields, label: '', sound: 'chime', vibrate: true, snoozeMin: 10, primary: true, order: tx.all('alarms').length });
  });
}

/**
 * @param {{ bedAt: string, wakeAt: string, quality: number|null, notes: string }} log
 * @param {string|null} id
 */
export function saveLog(log, id) {
  return appStore.mutate('sleep.log', (tx) => {
    const date = morningOf(log.wakeAt);
    // One log per morning: saving over an existing date replaces it.
    const clash = tx.all('sleepLogs').find((l) => l.date === date && l.id !== id);
    if (clash) tx.remove('sleepLogs', clash.id);
    const fields = { date, bedAt: log.bedAt, wakeAt: log.wakeAt, quality: log.quality, notes: log.notes };
    return id ? tx.patch('sleepLogs', id, fields) : tx.insert('sleepLogs', fields);
  });
}

/** @param {string} id */
export function deleteLog(id) {
  return appStore.mutate('sleep.deleteLog', (tx) => tx.remove('sleepLogs', id));
}

/** "Go to sleep": remember when the night started. */
export function markBedtime() {
  return appStore.mutate('sleep.goToSleep', (tx) => tx.setProfile(PROFILE.sleepPlan, { pendingBedAt: toLocalDateTime(new Date()) }));
}

/**
 * Saves the pending night as a log (or discards it) and clears the pending state.
 * @param {{ bedAt: string, wakeAt: string, quality: number|null } | null} log null = discard
 */
export function finishNight(log) {
  return appStore.mutate('sleep.morning', (tx) => {
    tx.setProfile(PROFILE.sleepPlan, { pendingBedAt: null });
    if (!log) return;
    const date = morningOf(log.wakeAt);
    const clash = tx.all('sleepLogs').find((l) => l.date === date);
    if (clash) tx.remove('sleepLogs', clash.id);
    tx.insert('sleepLogs', { date, bedAt: log.bedAt, wakeAt: log.wakeAt, quality: log.quality, notes: '' });
  });
}
