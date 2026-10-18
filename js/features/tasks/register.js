// @ts-check
// Desk: badge (due today + overdue), task reminders and next-task strip items.

import { appStore } from '../../core/store.js';
import { t, formatTime } from '../../core/i18n.js';
import { today, combine } from '../../core/time.js';
import { registerReminderSource } from '../../core/reminders.js';
import { registerBadge } from '../../scene/badges.js';
import { registerStripProvider } from '../../ui/next-task-strip.js';
import { openObject } from '../../ui/navigation.js';
import { attentionCount, dueState, taskReminders } from './model.js';

const DESK = 'bedroom.desk-notebook';
const tasks = () => /** @type {import('./model.js').Task[]} */ (/** @type {unknown} */ (appStore.all('tasks')));

registerBadge(DESK, () => {
  const { overdue, dueToday } = attentionCount(tasks(), today());
  const count = overdue + dueToday;
  if (!count) return null;
  return { text: String(count), tone: overdue ? 'alert' : 'neutral', aria: t('tasks.badge', { count }) };
});

registerReminderSource('task', (from, to) =>
  taskReminders(tasks(), from, to).map(({ task, at }) => ({
    key: `task:${task.id}:${task.dueDate}T${task.dueTime ?? '09:00'}:${task.reminderOffsetMin}`,
    source: 'task',
    kind: /** @type {const} */ ('reminder'),
    at,
    title: task.dueTime ? `${formatTime(task.dueTime)} ${task.title}` : task.title,
    objectId: DESK,
    data: { taskId: task.id },
  })),
);

registerStripProvider('tasks', () => {
  const day = today();
  const open = tasks().filter((task) => task.status !== 'done');
  const priority = { high: 0, normal: 1, low: 2 };
  const pick = (/** @type {'overdue'|'today'} */ state) =>
    open.filter((task) => dueState(task, day) === state).sort((a, b) => priority[a.priority] - priority[b.priority])[0];
  const items = [];
  const overdue = pick('overdue');
  if (overdue) {
    items.push({ key: `task:${overdue.id}`, rank: 6, emoji: '✅', text: t('strip.taskOverdue', { title: overdue.title }), open: () => openObject(DESK, { page: 'task', params: { id: overdue.id } }) });
  }
  const dueToday = pick('today');
  if (dueToday) {
    items.push({
      key: `task:${dueToday.id}`,
      rank: 7,
      at: dueToday.dueTime ? combine(day, dueToday.dueTime).getTime() : undefined,
      emoji: '✅',
      text: t('strip.taskToday', { title: dueToday.title }),
      open: () => openObject(DESK, { page: 'task', params: { id: dueToday.id } }),
    });
  }
  return items;
});
