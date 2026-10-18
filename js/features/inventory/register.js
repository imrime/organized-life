// @ts-check
// Fridge, cabinets and bathroom cabinet: expiry/low-stock badges, art state, 09:00 expiry digest, strip items.

import { appStore } from '../../core/store.js';
import { t } from '../../core/i18n.js';
import { today, toLocalDate, addDays, combine } from '../../core/time.js';
import { registerReminderSource } from '../../core/reminders.js';
import { registerBadge, registerVisualState } from '../../scene/badges.js';
import { registerStripProvider } from '../../ui/next-task-strip.js';
import { openObject } from '../../ui/navigation.js';
import { expiryState, expiringItems, isLow } from './model.js';

const items = () => /** @type {import('./model.js').InventoryItem[]} */ (/** @type {unknown} */ (appStore.all('inventoryItems')));
const food = () => items().filter((i) => i.location === 'fridge' || i.location === 'freezer' || i.location === 'pantry');

registerBadge('kitchen.refrigerator', () => {
  const day = today();
  const cold = items().filter((i) => i.location === 'fridge' || i.location === 'freezer');
  const expired = cold.filter((i) => expiryState(i, day) === 'expired').length;
  if (expired) return { text: String(expired), tone: 'alert', aria: t('inventory.badgeExpired', { count: expired }) };
  const soon = cold.filter((i) => ['today', 'tomorrow'].includes(expiryState(i, day))).length;
  return soon ? { text: String(soon), tone: 'warn', aria: t('inventory.badgeSoon', { count: soon }) } : null;
});
registerVisualState('kitchen.refrigerator', () => (items().some((i) => i.location === 'fridge') ? 'default' : 'empty'));

registerBadge('kitchen.cabinets', () => {
  const low = items().filter((i) => i.location === 'pantry' && isLow(i)).length;
  return low ? { text: String(low), tone: 'warn', aria: t('inventory.badgeLow', { count: low }) } : null;
});

// Bathroom cabinet: expired products (alert) take precedence over low stock (warn).
registerBadge('bathroom.cabinet', () => {
  const day = today();
  const bath = items().filter((i) => i.location === 'bathroom');
  const expired = bath.filter((i) => expiryState(i, day) === 'expired').length;
  if (expired) return { text: String(expired), tone: 'alert', aria: t('inventory.badgeExpired', { count: expired }) };
  const low = bath.filter(isLow).length;
  return low ? { text: String(low), tone: 'warn', aria: t('inventory.badgeLow', { count: low }) } : null;
});

// One digest per day at 09:00 when food expires today or tomorrow.
registerReminderSource('expiry', (from, to) => {
  const out = [];
  for (let date = toLocalDate(from); date <= toLocalDate(to); date = addDays(date, 1)) {
    const at = combine(date, '09:00');
    if (at < from || at > to) continue;
    const soon = expiringItems(food(), date);
    if (!soon.length) continue;
    out.push({
      key: `expiry:${date}`,
      source: 'expiry',
      kind: /** @type {const} */ ('reminder'),
      at,
      title: t('inventory.digest', { names: soon.slice(0, 3).map((i) => i.name).join(', '), count: soon.length }),
      objectId: 'kitchen.refrigerator',
    });
  }
  return out;
});

registerStripProvider('inventory', () => {
  const day = today();
  const soon = expiringItems(food(), day);
  const out = [];
  if (soon.length) {
    const first = soon[0];
    const state = expiryState(first, day);
    out.push({
      key: `expiring:${first.id}:${day}`,
      rank: 9,
      emoji: '🥛',
      text: t(state === 'expired' ? 'strip.foodExpired' : state === 'today' ? 'strip.foodToday' : 'strip.foodTomorrow', { name: first.name, count: soon.length - 1 }),
      open: () => openObject(first.location === 'pantry' ? 'kitchen.cabinets' : 'kitchen.refrigerator'),
    });
  }
  const low = items().filter(isLow).length;
  if (low) out.push({ key: `low:${day}`, rank: 10, emoji: '🛒', text: t('strip.lowStock', { count: low }), open: () => openObject('kitchen.shopping-board') });
  return out;
});
