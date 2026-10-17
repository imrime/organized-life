// @ts-check
// Ringing alarm overlay: big time, label(s), Snooze and Dismiss (docs/spec/03-ux-shell.md §5.4).

import { html, useEffect, useState } from './lib.js';
import { getUi, setUi, useUi } from './ui-state.js';
import { t, formatTime } from '../core/i18n.js';
import { nowTime } from '../core/time.js';
import { playAlarm } from '../core/sound.js';
import { ALARM_RING_MS } from '../core/reminders.js';
import { appStore } from '../core/store.js';
import { PROFILE } from '../core/schema.js';
import { dismissAlarms, snoozeAlarms } from '../features/alarms/actions.js';
import { exitNightstand, powerMode } from '../core/power.js';
import { toast } from './toast.js';

/** @param {import('../core/reminders.js').ReminderInstance[]} instances */
export function ringAlarms(instances) {
  const current = getUi().ringing ?? [];
  const keys = new Set(current.map((i) => i.key));
  setUi({ ringing: [...current, ...instances.filter((i) => !keys.has(i.key))] });
}

export function AlarmOverlay() {
  const { ringing } = useUi();
  if (!ringing?.length) return null;
  return html`<${Ringing} instances=${ringing} />`;
}

/** @param {{ instances: import('../core/reminders.js').ReminderInstance[] }} props */
function Ringing({ instances }) {
  const first = instances[0];
  const alarm = appStore.get('alarms', first.data?.alarmId);
  const settings = /** @type {Record<string, any>} */ (appStore.profile(PROFILE.settings) ?? {});
  const [clock, setClock] = useState(nowTime());

  useEffect(() => {
    const stop = playAlarm(alarm?.sound ?? 'chime', settings.alarmVolume ?? 0.8);
    if (alarm?.vibrate !== false && 'vibrate' in navigator) navigator.vibrate?.([600, 400, 600, 400, 600]);
    const vibrateTimer = setInterval(() => alarm?.vibrate !== false && navigator.vibrate?.([600, 400, 600]), 4000);
    const clockTimer = setInterval(() => setClock(nowTime()), 10_000);
    // Stop ringing after 5 minutes; the instance then shows up as a missed alarm.
    const giveUp = setTimeout(() => setUi({ ringing: null }), ALARM_RING_MS);
    return () => {
      stop();
      clearInterval(vibrateTimer);
      clearInterval(clockTimer);
      clearTimeout(giveUp);
      navigator.vibrate?.(0);
    };
  }, [instances.map((i) => i.key).join()]);

  const snoozeMin = alarm?.snoozeMin ?? 10;
  const onSnooze = async () => {
    setUi({ ringing: null });
    await snoozeAlarms(instances, snoozeMin);
    toast(t('alarms.snoozedFor', { minutes: snoozeMin }));
  };
  const onDismiss = async () => {
    setUi({ ringing: null });
    await dismissAlarms(instances);
    if (powerMode() === 'nightstand') {
      await exitNightstand();
      setUi({ nightstand: false });
      toast(t('nightstand.goodMorning'));
    }
  };

  const labels = instances.map((i) => i.title).filter(Boolean);
  return html`<div class="alarm-overlay" role="alertdialog" aria-modal="true" aria-labelledby="alarm-time">
    <div class="alarm-bell" aria-hidden="true">⏰</div>
    <div id="alarm-time" class="alarm-time">${formatTime(clock)}</div>
    <div class="alarm-labels">${labels.length ? labels.join(' · ') : t('alarms.defaultLabel')}</div>
    <div class="alarm-actions">
      <button type="button" class="btn alarm-snooze" onClick=${onSnooze}>${t('alarms.snooze', { minutes: snoozeMin })}</button>
      <button type="button" class="btn btn-primary alarm-dismiss" onClick=${onDismiss}>${t('alarms.dismiss')}</button>
    </div>
  </div>`;
}
