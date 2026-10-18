// @ts-check
// Medication tray: art state, due/overdue badge, dose reminders, strip items (due doses, refills).

import { appStore } from '../../core/store.js';
import { t, formatTime } from '../../core/i18n.js';
import { today, toLocalDate, combine } from '../../core/time.js';
import { registerReminderSource } from '../../core/reminders.js';
import { registerBadge, registerVisualState } from '../../scene/badges.js';
import { registerStripProvider } from '../../ui/next-task-strip.js';
import { openObject } from '../../ui/navigation.js';
import { todaySummary, dosesOn, doseState, doseReminders, needsRefill } from './model.js';

const TRAY = 'bedroom.medication-tray';
const meds = () => /** @type {import('./model.js').Medication[]} */ (/** @type {unknown} */ (appStore.all('medications')));
/** @param {string} id */
const logOf = (id) => /** @type {any} */ (appStore.get('doseLogs', id));

registerVisualState(TRAY, () => {
  const s = todaySummary(meds(), today(), logOf, new Date());
  if (!s.total || s.handled === s.total) return s.total ? 'empty' : 'full';
  return s.handled ? 'partial' : 'full';
});

registerBadge(TRAY, () => {
  const s = todaySummary(meds(), today(), logOf, new Date());
  const count = s.due + s.overdue;
  if (!count) return null;
  return { text: String(count), tone: s.overdue ? 'alert' : 'warn', aria: t('meds.badge', { count }) };
});

registerReminderSource('dose', (from, to) =>
  doseReminders(meds(), from, to, toLocalDate)
    .filter(({ med, date, time }) => !logOf(`${med.id}:${date}:${time}`))
    .map(({ med, date, time, at }) => ({
      key: `dose:${med.id}:${date}T${time}`,
      source: 'dose',
      kind: /** @type {const} */ ('reminder'),
      at,
      title: `${formatTime(time)} ${med.name} · ${med.dose}`,
      objectId: TRAY,
      data: { medId: med.id },
    })),
);

registerStripProvider('meds', (now) => {
  const day = today();
  const items = [];
  for (const { med, time } of dosesOn(meds(), day)) {
    const state = doseState(med, day, time, logOf, now);
    if (state !== 'due' && state !== 'overdue') continue;
    items.push({
      key: `dose:${med.id}:${day}T${time}`,
      rank: 2,
      at: combine(day, time).getTime(),
      emoji: '💊',
      text: t(state === 'overdue' ? 'strip.doseOverdue' : 'strip.doseDue', { time: formatTime(time), name: med.name }),
      open: () => openObject(TRAY),
    });
  }
  for (const med of meds().filter(needsRefill)) {
    items.push({ key: `refill:${med.id}`, rank: 10, emoji: '🛒', text: t('strip.refill', { name: med.name, count: med.stock ?? 0 }), open: () => openObject(TRAY, { page: 'med', params: { id: med.id } }) });
  }
  return items;
});
