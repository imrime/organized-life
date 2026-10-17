// @ts-check
// Wires alarms into the scene (clock face), the reminder engine and the next-task strip.

import { appStore } from '../../core/store.js';
import { t, formatTime } from '../../core/i18n.js';
import { registerReminderSource, collectInstances, classify, LOOKBACK_MS } from '../../core/reminders.js';
import { reminderState } from '../../core/reminder-state.js';
import { registerDisplay, registerVisualState } from '../../scene/badges.js';
import { registerStripProvider } from '../../ui/next-task-strip.js';
import { openObject } from '../../ui/navigation.js';
import { startNightstand } from '../../ui/nightstand.js';
import { toLocalDate } from '../../core/time.js';
import { alarmInstances, instanceKey, nextAlarm } from './model.js';

/** @typedef {import('./model.js').Alarm} Alarm */

const CLOCK = 'bedroom.alarm-clock';
const alarms = () => /** @type {Alarm[]} */ (/** @type {unknown} */ (appStore.all('alarms')));

registerReminderSource('alarm', (from, to) =>
  alarmInstances(alarms(), from, to).map(({ alarm, at, date }) => ({
    key: instanceKey(alarm, date),
    source: 'alarm',
    kind: /** @type {const} */ ('alarm'),
    at,
    title: alarm.label,
    window: 'alarms.main',
    objectId: CLOCK,
    data: { alarmId: alarm.id },
  })),
);

registerDisplay(CLOCK, () => {
  const next = nextAlarm(alarms(), new Date());
  if (!next) return { lines: ['--:--'], dim: true, aria: t('alarms.none') };
  const time = formatTime(next.alarm.time);
  return { lines: [time], aria: t('alarms.nextAt', { time }) };
});

registerVisualState(CLOCK, () => (nextAlarm(alarms(), new Date()) ? 'armed' : 'idle'));

registerStripProvider('alarms', (now) => {
  /** @type {import('../../ui/next-task-strip.js').StripItem[]} */
  const items = [];
  const instances = collectInstances(new Date(now.getTime() - LOOKBACK_MS), now).filter((i) => i.source === 'alarm');
  const { missed } = classify(instances, reminderState, now, { kinds: ['alarm'] });
  for (const { inst } of missed) {
    const age = now.getTime() - inst.at.getTime();
    // Spec: shown until noon (or for 3 hours when missed later in the day).
    if (now.getHours() >= 12 && age > 3 * 3_600_000) continue;
    items.push({
      key: `missed:${inst.key}`,
      rank: 1,
      at: inst.at.getTime(),
      emoji: '⏰',
      text: t('strip.missedAlarm', { time: formatTime(inst.key.slice(-5)) }),
      open: () => openObject(CLOCK),
    });
  }
  if (now.getHours() >= 20) {
    const next = nextAlarm(alarms(), now);
    if (next && next.at.getTime() - now.getTime() < 16 * 3_600_000) {
      items.push({
        key: `nightstand:${toLocalDate(now)}`,
        rank: 11,
        at: next.at.getTime(),
        emoji: '🌙',
        text: t('strip.startNightstand', { time: formatTime(next.alarm.time) }),
        open: () => startNightstand(),
      });
    }
  }
  return items;
});
