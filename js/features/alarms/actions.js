// @ts-check
// Alarm mutations.

import { appStore } from '../../core/store.js';
import { acknowledge, snooze } from '../../core/reminder-state.js';
import { snoozeUntil } from './model.js';

/** @typedef {import('./model.js').Alarm} Alarm */

/**
 * Creates or updates an alarm.
 * @param {Partial<Alarm>} draft
 * @param {string|null} id
 */
export function saveAlarm(draft, id) {
  return appStore.mutate('alarms.save', (tx) => {
    const fields = {
      time: draft.time,
      repeatDays: [...(draft.repeatDays ?? [])].sort((a, b) => a - b),
      label: (draft.label ?? '').trim(),
      sound: draft.sound ?? 'chime',
      vibrate: draft.vibrate ?? true,
      snoozeMin: draft.snoozeMin ?? 10,
      enabled: draft.enabled ?? true,
    };
    if (id) return tx.patch('alarms', id, fields);
    const order = tx.all('alarms').length;
    return tx.insert('alarms', { ...fields, primary: false, order });
  });
}

/** @param {string} id */
export function deleteAlarm(id) {
  return appStore.mutate('alarms.delete', (tx) => tx.remove('alarms', id));
}

/**
 * @param {string} id
 * @param {boolean} enabled
 */
export function setAlarmEnabled(id, enabled) {
  return appStore.mutate('alarms.toggle', (tx) => tx.patch('alarms', id, { enabled }));
}

/**
 * Dismiss: acknowledge the ringing instances and switch off one-shot alarms.
 * @param {{ key: string, data?: Record<string, any> }[]} instances
 */
export async function dismissAlarms(instances) {
  await acknowledge(instances.map((i) => i.key));
  const oneShots = instances.map((i) => i.data?.alarmId).filter((alarmId) => {
    const alarm = appStore.get('alarms', alarmId);
    return alarm && !alarm.repeatDays.length && alarm.enabled;
  });
  if (oneShots.length) await appStore.mutate('alarms.oneShotDone', (tx) => oneShots.forEach((alarmId) => tx.patch('alarms', alarmId, { enabled: false })), { quiet: true });
}

/**
 * @param {{ key: string, data?: Record<string, any> }[]} instances
 * @param {number} minutes
 */
export function snoozeAlarms(instances, minutes) {
  return snooze(
    instances.map((i) => i.key),
    snoozeUntil(new Date(), minutes),
  );
}
