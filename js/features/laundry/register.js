// @ts-check
// Laundry: machine/basket states and badges, "laundry done" reminder at finishesAt, strip items.

import { appStore } from '../../core/store.js';
import { t } from '../../core/i18n.js';
import { registerReminderSource } from '../../core/reminders.js';
import { registerBadge, registerVisualState } from '../../scene/badges.js';
import { registerStripProvider } from '../../ui/next-task-strip.js';
import { openObject } from '../../ui/navigation.js';
import { activeLoad, loadStatus, minutesLeft, basketLevel } from './model.js';

const MACHINE = 'bathroom.washing-machine';
const BASKET = 'bathroom.laundry-basket';
const loads = () => /** @type {import('./model.js').LaundryLoad[]} */ (/** @type {unknown} */ (appStore.all('laundryLoads')));
const dirtyCount = () =>
  appStore.all('clothingItems').filter((c) => c.status === 'dirty').length + appStore.all('laundryExtras').filter((e) => e.status === 'dirty').length;

registerVisualState(MACHINE, () => {
  const load = activeLoad(loads());
  return load ? loadStatus(load, new Date()) : 'idle';
});

registerBadge(MACHINE, () => {
  const load = activeLoad(loads());
  if (!load) return null;
  const now = new Date();
  if (loadStatus(load, now) === 'done') return { text: '✓', tone: 'warn', aria: t('laundry.badgeDone') };
  const min = minutesLeft(load, now);
  return { text: `${min}'`, tone: 'info', aria: t('laundry.badgeRunning', { minutes: min }) };
});

registerVisualState(BASKET, () => basketLevel(dirtyCount()));
registerBadge(BASKET, () => {
  const n = dirtyCount();
  return n ? { text: String(n), tone: 'neutral', aria: t('laundry.badgeBasket', { count: n }) } : null;
});

// "Laundry is done" when a running load reaches finishesAt.
registerReminderSource('laundry', (from, to) =>
  loads()
    .filter((l) => l.status === 'running' && l.finishesAt)
    .map((l) => ({ load: l, at: new Date(/** @type {string} */ (l.finishesAt)) }))
    .filter(({ at }) => at >= from && at <= to)
    .map(({ load, at }) => ({
      key: `laundry:${load.id}`,
      source: 'laundry',
      kind: /** @type {const} */ ('reminder'),
      at,
      title: t('laundry.doneReminder'),
      objectId: MACHINE,
    })),
);

registerStripProvider('laundry', (now) => {
  const out = [];
  const load = activeLoad(loads());
  if (load && loadStatus(load, now) === 'done') {
    out.push({ key: `laundry-done:${load.id}`, rank: 7, emoji: '🫧', text: t('strip.laundryDone'), open: () => openObject(MACHINE) });
  }
  const dirty = dirtyCount();
  if (dirty >= 7 && !load) out.push({ key: `basket-full:${now.toDateString()}`, rank: 12, emoji: '🧺', text: t('strip.basketFull', { count: dirty }), open: () => openObject(BASKET) });
  return out;
});
