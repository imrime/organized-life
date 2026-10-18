// @ts-check
// Study room feedback: next deadline on the monitor, due/overdue badge, today's classes on the planner, reading book.

import { appStore } from '../../core/store.js';
import { t } from '../../core/i18n.js';
import { today } from '../../core/time.js';
import { registerBadge, registerDisplay, registerVisualState } from '../../scene/badges.js';
import { dueCounts, deadlines, classesOn, daysUntil } from './model.js';

const tasks = () => /** @type {any[]} */ (appStore.all('tasks'));
const events = () => /** @type {any[]} */ (appStore.all('events'));

registerDisplay('study.computer', () => {
  const day = today();
  const next = deadlines(tasks(), events(), day).find((d) => d.date >= day);
  if (!next) return null;
  const days = daysUntil(day, next.date);
  const when = days === 0 ? t('calendar.today') : t('study.daysShort', { count: days });
  return { lines: [next.title, when], aria: t('study.nextDeadline', { title: next.title, when }) };
});

registerBadge('study.computer', () => {
  const { overdue, soon } = dueCounts(tasks(), today());
  if (overdue) return { text: String(overdue), tone: 'alert', aria: t('study.badgeOverdue', { count: overdue }) };
  return soon ? { text: String(soon), tone: 'warn', aria: t('study.badgeSoon', { count: soon }) } : null;
});

registerVisualState('study.planner', () => `classes-${Math.min(4, classesOn(events(), today()).length)}`);
registerBadge('study.planner', () => {
  const n = classesOn(events(), today()).length;
  return n ? { text: String(n), tone: 'info', aria: t('study.badgeClasses', { count: n }) } : null;
});

registerVisualState('study.bookshelf', () => (appStore.all('studyResources').some((r) => r.status === 'reading') ? 'reading' : 'default'));
