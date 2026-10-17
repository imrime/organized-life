// @ts-check
// Wires the calendar into the scene (date on the page, today's count), reminders and the next-task strip.

import { appStore } from '../../core/store.js';
import { t, formatTime, formatIn, intlLocale } from '../../core/i18n.js';
import { registerReminderSource } from '../../core/reminders.js';
import { registerBadge, registerDisplay } from '../../scene/badges.js';
import { registerStripProvider } from '../../ui/next-task-strip.js';
import { openObject } from '../../ui/navigation.js';
import { today, toLocalDate, addDays } from '../../core/time.js';
import { agenda, eventReminders, occurrences, startOf } from './model.js';
import { timeUntil } from '../alarms/model.js';

/** @typedef {import('./model.js').CalendarEvent} CalendarEvent */

const CALENDAR = 'bedroom.wall-calendar';
const events = () => /** @type {CalendarEvent[]} */ (/** @type {unknown} */ (appStore.all('events')));
const tasks = () => /** @type {any[]} */ (appStore.all('tasks'));

registerReminderSource('event', (from, to) =>
  eventReminders(events(), from, to, toLocalDate).map(({ event, date, at }) => ({
    key: `event:${event.id}:${date}T${event.allDay ? 'allday' : event.start}:${event.reminderOffsetMin}`,
    source: 'event',
    kind: /** @type {const} */ ('reminder'),
    at,
    title: event.allDay ? event.title : `${formatTime(event.start ?? '00:00')} ${event.title}`,
    window: 'calendar.main',
    objectId: CALENDAR,
    data: { eventId: event.id, date },
  })),
);

registerDisplay(CALENDAR, () => {
  const now = new Date();
  const month = new Intl.DateTimeFormat(intlLocale(), { month: 'short' }).format(now).replace('.', '').toUpperCase();
  return { lines: [month, String(now.getDate())], aria: t('calendar.todayIs', { date: now.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'long' }) }) };
});

registerBadge(CALENDAR, () => {
  const day = today();
  const count = (agenda(events(), tasks().filter((task) => task.status !== 'done'), day, day).get(day) ?? []).length;
  return count ? { text: String(count), tone: 'neutral', aria: t('calendar.todayCount', { count }) } : null;
});

registerStripProvider('events', (now) => {
  const day = toLocalDate(now);
  /** @type {import('../../ui/next-task-strip.js').StripItem[]} */
  const items = [];
  for (const event of events()) {
    if (event.allDay) continue;
    for (const date of occurrences(event, day, addDays(day, 1))) {
      const at = startOf(event, date);
      const diff = at.getTime() - now.getTime();
      if (diff < 0 || diff > 2 * 3_600_000) continue;
      items.push({
        key: `event:${event.id}:${date}`,
        rank: 5,
        at: at.getTime(),
        emoji: '📅',
        text: t('strip.eventSoon', { time: formatTime(event.start ?? '00:00'), title: event.title, when: formatIn(timeUntil(at, now)) }),
        open: () => openObject(CALENDAR),
      });
    }
  }
  return items;
});
