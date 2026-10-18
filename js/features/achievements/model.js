// @ts-check
// Achievements (docs/spec/05-cross-system.md §5): catalogue and pure rules over a data snapshot.

import { addDays, startOfWeek } from '../../core/time.js';
import { streak, runId } from '../routines/model.js';
import { monthOf, shiftMonth, monthTotals } from '../finance/model.js';

/**
 * @typedef {{
 *   all: (c: string) => any[],
 *   allWithDeleted: (c: string) => any[],
 *   profile: (id: string) => Record<string, any>|undefined,
 *   today: string,
 *   visibleLocationIds: string[],
 * }} Snapshot
 * @typedef {{ id: string, icon: string, progress: (d: Snapshot) => [number, number] }} Achievement
 */

/** Longest run of consecutive dates. @param {string[]} dates */
export function longestRun(dates) {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const date of sorted) {
    run = prev && addDays(prev, 1) === date ? run + 1 : 1;
    best = Math.max(best, run);
    prev = date;
  }
  return best;
}

/** Consecutive weeks (ending with the last complete or current week) meeting the weekly goal. @param {string[]} dates @param {number} goal @param {string} today @param {1|7} weekStart */
export function goalWeeks(dates, goal, today, weekStart) {
  if (!goal) return 0;
  /** @type {Map<string, number>} */
  const perWeek = new Map();
  for (const d of dates) {
    const w = startOfWeek(d, weekStart);
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  }
  let week = startOfWeek(today, weekStart);
  // The current week counts only once the goal is met.
  if ((perWeek.get(week) ?? 0) < goal) week = addDays(week, -7);
  let count = 0;
  while ((perWeek.get(week) ?? 0) >= goal) {
    count++;
    week = addDays(week, -7);
  }
  return count;
}

/** @param {any[]} list @param {(x: any) => boolean} [fn] */
const count = (list, fn = () => true) => list.filter(fn).length;
/** @param {number} n @param {number} target @returns {[number, number]} */
const of = (n, target) => [Math.min(n, target), target];

/** @type {Achievement[]} */
export const ACHIEVEMENTS = [
  { id: 'settled_in', icon: '🏡', progress: (d) => of(d.profile('settings')?.onboarding?.done ? 1 : 0, 1) },
  { id: 'on_time', icon: '⏰', progress: (d) => of(d.allWithDeleted('alarms').length, 1) },
  { id: 'planner', icon: '📅', progress: (d) => of(d.allWithDeleted('events').length, 10) },
  { id: 'well_rested', icon: '😴', progress: (d) => of(longestRun(d.all('sleepLogs').map((l) => l.date)), 7) },
  { id: 'task_tamer', icon: '✅', progress: (d) => of(count(d.all('tasks'), (x) => x.status === 'done'), 50) },
  {
    id: 'project_done',
    icon: '🗂️',
    progress: (d) => {
      const tasks = d.all('tasks');
      const done = d.all('projects').some((p) => {
        const own = tasks.filter((x) => x.projectId === p.id);
        return own.length >= 3 && own.every((x) => x.status === 'done');
      });
      return of(done ? 1 : 0, 1);
    },
  },
  {
    id: 'glow',
    icon: '✨',
    progress: (d) => {
      const runs = new Map(d.all('routineRuns').map((r) => [r.id, r]));
      const best = Math.max(0, ...d.all('routines').filter((r) => String(r.owner).startsWith('bathroom.')).map((r) => streak(r, (date) => runs.get(runId(r.id, date)), d.today)));
      return of(best, 7);
    },
  },
  { id: 'stocked', icon: '🥫', progress: (d) => of(d.allWithDeleted('inventoryItems').length, 20) },
  { id: 'no_waste', icon: '🌱', progress: (d) => of(d.profile('stats')?.noWaste?.run ?? 0, 7) },
  { id: 'home_cook', icon: '🍳', progress: (d) => of(Math.max(d.all('recipes').length, d.profile('stats')?.cooked ?? 0), 5) },
  { id: 'food_journal', icon: '🍽️', progress: (d) => of(longestRun(d.all('meals').map((m) => m.date)), 7) },
  { id: 'list_master', icon: '🛒', progress: (d) => of(d.profile('stats')?.shoppingChecked ?? 0, 100) },
  { id: 'fresh_laundry', icon: '🫧', progress: (d) => of(count(d.all('laundryLoads'), (l) => l.status === 'unloaded'), 10) },
  { id: 'stylist', icon: '👗', progress: (d) => of(d.all('outfits').length, 5) },
  { id: 'cinephile', icon: '🎬', progress: (d) => of(count(d.all('media'), (m) => m.kind === 'film' && m.status === 'watched'), 10) },
  { id: 'binge', icon: '📺', progress: (d) => of(count(d.all('media'), (m) => m.kind === 'series' && m.status === 'watched'), 1) },
  { id: 'completionist', icon: '🎮', progress: (d) => of(count(d.all('media'), (m) => m.kind === 'game' && m.status === 'completed'), 5) },
  { id: 'bookworm', icon: '📚', progress: (d) => of(count(d.all('media'), (m) => m.kind === 'book' && m.status === 'read'), 5) },
  { id: 'mixtape', icon: '🎶', progress: (d) => of(Math.max(0, ...d.all('playlists').map((p) => p.itemIds.length)), 10) },
  { id: 'curator', icon: '🗃️', progress: (d) => of(d.all('mediaCollections').length, 3) },
  { id: 'maker', icon: '🎨', progress: (d) => of(count(d.all('creativeProjects'), (p) => p.status === 'done'), 3) },
  { id: 'deep_focus', icon: '🎯', progress: (d) => of(count(d.all('focusSessions'), (s) => s.status === 'completed'), 10) },
  { id: 'scholar', icon: '🎓', progress: (d) => of(count(d.all('tasks'), (x) => x.context === 'study' && x.status === 'done'), 10) },
  { id: 'first_rep', icon: '💪', progress: (d) => of(count(d.all('workoutSessions'), (s) => s.status === 'done'), 1) },
  {
    id: 'iron_habit',
    icon: '🏋️',
    progress: (d) => {
      const dates = d.all('workoutSessions').filter((s) => s.status === 'done').map((s) => s.date);
      const settings = d.profile('settings');
      return of(goalWeeks(dates, d.profile('fitness')?.weeklyGoal ?? 0, d.today, settings?.weekStart ?? 1), 4);
    },
  },
  { id: 'new_record', icon: '🏆', progress: (d) => of(d.all('workoutSessions').some((s) => (s.records ?? []).length > 0) ? 1 : 0, 1) },
  { id: 'explorer', icon: '🚶', progress: (d) => of(count(d.all('walks'), (w) => w.status === 'done'), 10) },
  {
    id: 'wanderer',
    icon: '🗺️',
    progress: (d) => {
      const visited = d.profile('settings')?.visited ?? [];
      return of(d.visibleLocationIds.filter((id) => visited.includes(id)).length, d.visibleLocationIds.length);
    },
  },
  {
    id: 'budget_keeper',
    icon: '💰',
    progress: (d) => {
      const current = monthOf(d.today);
      const tx = d.all('transactions');
      const kept = d.all('budgets').some((b) => b.month < current && b.totalLimitMinor > 0 && b.month >= shiftMonth(current, -24) && monthTotals(/** @type {any} */ (tx), b.month).spent <= b.totalLimitMinor);
      return of(kept ? 1 : 0, 1);
    },
  },
];

/** @param {Achievement} a @param {Snapshot} d */
export function isUnlockedBy(a, d) {
  const [n, target] = a.progress(d);
  return target > 0 && n >= target;
}

/**
 * Achievements newly earned (not yet unlocked).
 * @param {Snapshot} d
 * @param {Set<string>} unlocked
 */
export function newlyEarned(d, unlocked) {
  return ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && isUnlockedBy(a, d));
}

/**
 * Daily "no waste" counter: one step per day with ≥ 5 food items tracked and none expired.
 * @param {{ date?: string, run?: number }|undefined} state
 * @param {string} today
 * @param {{ tracked: number, expired: number }} food
 */
export function nextNoWaste(state, today, food) {
  if (state?.date === today) return state;
  const ok = food.tracked >= 5 && food.expired === 0;
  if (!ok) return { date: today, run: 0 };
  return { date: today, run: state?.date === addDays(today, -1) ? (state.run ?? 0) + 1 : 1 };
}

/** Trophy shelf state by unlocked count. @param {number} n */
export const trophyState = (n) => (n === 0 ? 'trophies-none' : n < 5 ? 'trophies-some' : 'trophies-many');
