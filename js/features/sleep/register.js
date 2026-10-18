// @ts-check
// Bed: art state, bedtime badge, wind-down reminder (with Nightstand prompt), routine reminders, morning prompt.

import { appStore } from '../../core/store.js';
import { PROFILE } from '../../core/schema.js';
import { t, formatTime, nameOf } from '../../core/i18n.js';
import { registerReminderSource } from '../../core/reminders.js';
import { registerBadge, registerVisualState } from '../../scene/badges.js';
import { registerStripProvider } from '../../ui/next-task-strip.js';
import { openObject } from '../../ui/navigation.js';
import { combine, toLocalDate, addDays, today } from '../../core/time.js';
import { bedState, inNightWindow, windDownTime, morningDue } from './model.js';
import { isActiveOn, isComplete, runId } from '../routines/model.js';
import { nextAlarm } from '../alarms/model.js';

const BED = 'bedroom.bed';
const plan = () => /** @type {import('./model.js').SleepPlan} */ (/** @type {unknown} */ (appStore.profile(PROFILE.sleepPlan) ?? { bedtime: '23:00', wakeTime: '07:00', windDownMin: 30 }));
const routine = (/** @type {string|null|undefined} */ id) => (id ? /** @type {any} */ (appStore.get('routines', id)) : undefined);
/** @param {any} r @param {string} date */
const doneOn = (r, date) => isComplete(r, /** @type {any} */ (appStore.get('routineRuns', runId(r.id, date))));

registerVisualState(BED, () => bedState(new Date(), plan(), /** @type {any[]} */ (appStore.all('sleepLogs'))));

registerBadge(BED, () => {
  const p = plan();
  const r = routine(p.bedtimeRoutineId);
  if (!r || !inNightWindow(new Date(), p)) return null;
  // The routine belongs to the evening it started (before midnight).
  const now = new Date();
  const date = now.getHours() < 12 ? toLocalDate(new Date(now.getTime() - 12 * 3_600_000)) : toLocalDate(now);
  return isActiveOn(r, date) && !doneOn(r, date) ? { text: '🌙', tone: 'info', aria: t('sleep.badgeRoutine') } : null;
});

// Wind-down: one instance per evening; offers Nightstand mode when an alarm is set for the morning.
registerReminderSource('winddown', (from, to) => {
  const p = plan();
  if (!p.windDownMin) return [];
  const time = windDownTime(p);
  const out = [];
  for (let date = toLocalDate(from); date <= toLocalDate(to); date = addDays(date, 1)) {
    const at = combine(date, time);
    if (at < from || at > to) continue;
    const settings = appStore.profile(PROFILE.settings);
    const alarm = nextAlarm(/** @type {any} */ (appStore.all('alarms')), at);
    const offerNightstand = Boolean(settings?.nightstandPrompt !== false && alarm && alarm.at.getTime() - at.getTime() < 16 * 3_600_000);
    out.push({
      key: `winddown:${date}T${time}`,
      source: 'winddown',
      kind: /** @type {const} */ ('reminder'),
      at,
      title: t('sleep.windDownReminder', { time: formatTime(p.bedtime) }),
      window: 'sleep.main',
      objectId: BED,
      data: { action: offerNightstand ? 'nightstand' : 'open' },
    });
  }
  return out;
});

// Routines with their own reminder time, only on active days and only if not yet done.
registerReminderSource('routine', (from, to) => {
  const out = [];
  for (const r of /** @type {any[]} */ (appStore.all('routines'))) {
    if (!r.reminderTime || !r.enabled) continue;
    for (let date = toLocalDate(from); date <= toLocalDate(to); date = addDays(date, 1)) {
      if (!isActiveOn(r, date) || doneOn(r, date)) continue;
      const at = combine(date, r.reminderTime);
      if (at < from || at > to) continue;
      out.push({
        key: `routine:${r.id}:${date}T${r.reminderTime}`,
        source: 'routine',
        kind: /** @type {const} */ ('reminder'),
        at,
        title: nameOf(r),
        objectId: r.owner,
        data: { routineId: r.id },
      });
    }
  }
  return out;
});

// Strip rank 8: a routine whose reminder time passed today and isn't done.
registerStripProvider('routines', (now) => {
  const day = today();
  return /** @type {any[]} */ (appStore.all('routines'))
    .filter((r) => r.reminderTime && isActiveOn(r, day) && !doneOn(r, day) && combine(day, r.reminderTime) <= now)
    .map((r) => ({
      key: `routine:${r.id}:${day}`,
      rank: 8,
      at: combine(day, r.reminderTime).getTime(),
      emoji: '✨',
      text: nameOf(r),
      open: () => openObject(r.owner),
    }));
});

/** Opens the "Good morning" page when a night started with "Go to sleep" is waiting to be saved. */
export function maybeShowMorning() {
  if (morningDue(plan(), new Date())) openObject(BED, { page: 'morning' });
}
