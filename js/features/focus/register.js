// @ts-check
// Focus timer: lamp state, minutes-left / coffee badge, end-of-focus and end-of-break reminders, strip item.

import { appStore } from '../../core/store.js';
import { t } from '../../core/i18n.js';
import { registerReminderSource } from '../../core/reminders.js';
import { registerBadge, registerVisualState } from '../../scene/badges.js';
import { registerStripProvider } from '../../ui/next-task-strip.js';
import { openObject } from '../../ui/navigation.js';
import { activeFocus, sessionOnBreak, focusRemainingSec, plannedEnd } from './model.js';

const DESK = 'study.desk-planner';
const sessions = () => /** @type {import('./model.js').FocusSession[]} */ (/** @type {unknown} */ (appStore.all('focusSessions')));

registerVisualState(DESK, () => (activeFocus(sessions()) ? 'focus' : sessionOnBreak(sessions()) ? 'break' : 'idle'));

registerBadge(DESK, () => {
  const active = activeFocus(sessions());
  if (active) {
    const min = Math.ceil(focusRemainingSec(active, new Date()) / 60);
    return { text: active.status === 'paused' ? '⏸' : `${min}'`, tone: 'info', aria: t('focus.badge', { minutes: min }) };
  }
  return sessionOnBreak(sessions()) ? { text: '☕', tone: 'info', aria: t('focus.onBreak') } : null;
});

// In-app banner + chime when focus or a break ends while the window is closed.
registerReminderSource('focus', (from, to) => {
  const out = [];
  for (const s of sessions()) {
    if (s.status === 'running') {
      const at = new Date(plannedEnd(s));
      if (at >= from && at <= to) out.push({ key: `focus:${s.id}`, source: 'focus', kind: /** @type {const} */ ('reminder'), at, title: t('focus.breakTime', { minutes: s.breakMin }), objectId: DESK });
    }
    if (s.breakStartedAt && !s.breakEndedAt) {
      const at = new Date(new Date(s.breakStartedAt).getTime() + s.breakMin * 60_000);
      if (at >= from && at <= to) out.push({ key: `focus-break:${s.id}`, source: 'focus', kind: /** @type {const} */ ('reminder'), at, title: t('focus.backToWork'), objectId: DESK });
    }
  }
  return out;
});

registerStripProvider('focus', (now) => {
  const active = activeFocus(sessions());
  if (!active) return [];
  return [{ key: `focus:${active.id}`, rank: 5, emoji: '🎯', text: t('strip.focusing', { minutes: Math.ceil(focusRemainingSec(active, now) / 60) }), open: () => openObject(DESK) }];
});
