// @ts-check
// Achievement engine: evaluates rules 1 s after relevant changes, stores unlocks, shows one toast per batch.
// Bookshelf trophies and the "New" sparkle badge reflect unlocks.

import { appStore } from '../../core/store.js';
import { PROFILE } from '../../core/schema.js';
import { t } from '../../core/i18n.js';
import { today } from '../../core/time.js';
import { registerBadge, registerVisualState } from '../../scene/badges.js';
import { visibleLocations } from '../../world/locations.js';
import { toast } from '../../ui/toast.js';
import { openObject } from '../../ui/navigation.js';
import { expiryState } from '../inventory/model.js';
import { newlyEarned, nextNoWaste, trophyState } from './model.js';

const SHELF = 'entertainment.bookshelf';
const IGNORED = new Set(['achievementUnlocks', 'reminderState']);

const unlocks = () => appStore.all('achievementUnlocks');

registerVisualState(SHELF, () => trophyState(unlocks().length));
registerBadge(SHELF, () => (unlocks().some((u) => !u.seen) ? { text: '✨', tone: 'info', aria: t('achievements.badgeNew') } : null));

/** @returns {import('./model.js').Snapshot} */
export function snapshot() {
  const settings = /** @type {any} */ (appStore.profile(PROFILE.settings) ?? {});
  return {
    all: (c) => appStore.all(c),
    allWithDeleted: (c) => appStore.all(c, { includeDeleted: true }),
    profile: (id) => appStore.profile(id),
    today: today(),
    visibleLocationIds: visibleLocations(settings).map((l) => l.id),
  };
}

/** Advances the daily "no waste" counter once per day. */
async function tickNoWaste() {
  const day = today();
  const stats = /** @type {any} */ (appStore.profile(PROFILE.stats) ?? {});
  if (stats.noWaste?.date === day) return;
  const food = appStore.all('inventoryItems').filter((i) => ['fridge', 'freezer', 'pantry'].includes(i.location));
  const next = nextNoWaste(stats.noWaste, day, { tracked: food.length, expired: food.filter((i) => expiryState(/** @type {any} */ (i), day) === 'expired').length });
  await appStore.mutate('achievements.noWaste', (tx) => tx.setProfile(PROFILE.stats, { noWaste: next }), { quiet: true });
}

let running = false;
export async function evaluateAchievements() {
  if (running) return;
  running = true;
  try {
    await tickNoWaste();
    const earned = newlyEarned(snapshot(), new Set(unlocks().map((u) => u.id)));
    if (!earned.length) return;
    const at = new Date().toISOString();
    await appStore.mutate('achievements.unlock', (tx) => earned.forEach((a) => tx.insert('achievementUnlocks', { id: a.id, unlockedAt: at, seen: false })), { quiet: true });
    const text = earned.length === 1 ? `${earned[0].icon} ${t('achievements.unlocked', { name: t(`achievements.items.${earned[0].id}.name`) })}` : `🏆 ${t('achievements.unlockedMany', { count: earned.length })}`;
    toast(text, { actionLabel: t('achievements.view'), onAction: () => openObject(SHELF, { page: 'achievements' }) });
  } finally {
    running = false;
  }
}

/** Mark all unlocks as seen (opening the Achievements tab). */
export function markAchievementsSeen() {
  const unseen = unlocks().filter((u) => !u.seen);
  if (!unseen.length) return Promise.resolve();
  return appStore.mutate('achievements.seen', (tx) => unseen.forEach((u) => tx.patch('achievementUnlocks', u.id, { seen: true })), { quiet: true });
}

/** Starts watching the store; call once after the store is ready. */
export function startAchievements() {
  /** @type {ReturnType<typeof setTimeout>|undefined} */
  let timer;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => evaluateAchievements().catch((err) => console.error('achievements failed', err)), 1000);
  };
  appStore.subscribe((touched) => {
    if ([...touched].some((c) => !IGNORED.has(c))) schedule();
  });
  schedule();
}
