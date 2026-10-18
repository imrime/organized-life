// @ts-check
// Gym feedback: gentle "workout today" badge (never alert), elapsed minutes during a session, towel when done,
// progress board mini chart (last 6 weeks) and "2/3" weekly badge.

import { appStore } from '../../core/store.js';
import { PROFILE } from '../../core/schema.js';
import { t } from '../../core/i18n.js';
import { today } from '../../core/time.js';
import { registerBadge, registerVisualState } from '../../scene/badges.js';
import { registerStripProvider } from '../../ui/next-task-strip.js';
import { openObject } from '../../ui/navigation.js';
import { plansFor, inProgress, sessionStats, weeklyCounts } from './model.js';

const BENCH = 'gym.bench-mat';
const BOARD = 'gym.progress-board';
const sessions = () => /** @type {import('./model.js').WorkoutSession[]} */ (/** @type {unknown} */ (appStore.all('workoutSessions')));
const doneToday = () => sessions().some((s) => s.status === 'completed' && s.date === today());
const weekStart = () => /** @type {1|7} */ (appStore.profile(PROFILE.settings)?.weekStart ?? 1);

registerVisualState(BENCH, () => (inProgress(sessions()) ? 'session' : doneToday() ? 'done' : 'default'));

registerBadge(BENCH, () => {
  const live = inProgress(sessions());
  if (live) {
    const min = sessionStats(live).minutes;
    return { text: `${min}'`, tone: 'info', aria: t('workouts.badgeSession', { minutes: min }) };
  }
  const planned = plansFor(/** @type {any} */ (appStore.all('workoutPlans')), today()).length;
  return planned && !doneToday() ? { text: '1', tone: 'info', aria: t('workouts.badgePlanned') } : null;
});

registerVisualState(BOARD, () => weeklyCounts(sessions(), today(), weekStart(), 6).map((w) => Math.min(5, w.count)).join(','));

registerBadge(BOARD, () => {
  const goal = appStore.profile(PROFILE.fitness)?.weeklyGoal ?? 3;
  const count = weeklyCounts(sessions(), today(), weekStart(), 1)[0].count;
  return count ? { text: `${count}/${goal}`, tone: 'neutral', aria: t('workouts.thisWeekOf', { count, goal }) } : null;
});

registerStripProvider('workouts', () => {
  const live = inProgress(sessions());
  return live ? [{ key: `workout:${live.id}`, rank: 6, emoji: '💪', text: t('strip.workout', { minutes: sessionStats(live).minutes }), open: () => openObject(BENCH) }] : [];
});
