// @ts-check
// Laundry logic (pure): cycles, load defaults, time-based status, basket grouping, mix warnings (F-7).

/**
 * @typedef {'whites'|'lights'|'darks'|'colours'} LaundryGroup
 * @typedef {'whites'|'darks'|'colours'|'delicates'|'towels'|'mixed'} LoadType
 * @typedef {'quick'|'cotton'|'synthetics'|'delicates'|'wool'|'eco'} Cycle
 * @typedef {{ id: string, label: string, seedKey?: string, kind?: string, laundryGroup: LaundryGroup, status: 'dirty'|'in_load' }} LaundryExtra
 * @typedef {{
 *   id: string, itemIds: string[], extraIds: string[], loadType: LoadType, cycle: Cycle, temperatureC: number, durationMin: number,
 *   status: 'queued'|'running'|'done'|'unloaded'|'cancelled', startedAt?: string|null, finishesAt?: string|null, finishedAt?: string|null, createdAt?: string,
 * }} LaundryLoad
 * @typedef {{ id: string, slot: string, color: string, laundryGroup: LaundryGroup, care: string, status: string, template: string }} Clothing
 */

export const LOAD_TYPES = /** @type {LoadType[]} */ (['whites', 'darks', 'colours', 'delicates', 'towels', 'mixed']);
export const TEMPERATURES = [20, 30, 40, 60, 90];
export const GROUPS = /** @type {LaundryGroup[]} */ (['whites', 'lights', 'darks', 'colours']);
export const EXTRA_KINDS = ['towels', 'linen', 'sportswear'];

/** Cycle defaults (docs/spec/04-data-model.md §3.12). @type {Record<Cycle, { durationMin: number, temperatureC: number }>} */
export const CYCLES = {
  quick: { durationMin: 30, temperatureC: 30 },
  cotton: { durationMin: 150, temperatureC: 40 },
  synthetics: { durationMin: 100, temperatureC: 40 },
  delicates: { durationMin: 50, temperatureC: 30 },
  wool: { durationMin: 40, temperatureC: 20 },
  eco: { durationMin: 180, temperatureC: 40 },
};

const GENTLE = ['delicate', 'wool', 'hand_wash'];

/**
 * Load type suggested for a set of items: gentle care → delicates, only towels → towels, otherwise the dominant colour group.
 * @param {{ laundryGroup: LaundryGroup, care?: string, kind?: string }[]} entries
 * @returns {LoadType}
 */
export function defaultLoadType(entries) {
  if (!entries.length) return 'mixed';
  if (entries.filter((e) => e.care && GENTLE.includes(e.care)).length * 2 > entries.length) return 'delicates';
  if (entries.every((e) => e.kind === 'towels')) return 'towels';
  /** @type {Record<string, number>} */
  const counts = {};
  for (const e of entries) {
    const g = e.laundryGroup === 'lights' ? 'colours' : e.laundryGroup;
    counts[g] = (counts[g] ?? 0) + 1;
  }
  const [top, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return n * 2 > entries.length ? /** @type {LoadType} */ (top) : 'mixed';
}

/** @param {LoadType} type @returns {Cycle} */
export function cycleFor(type) {
  return type === 'delicates' ? 'delicates' : 'cotton';
}

/**
 * Status with lazy completion: a running load past `finishesAt` counts as done.
 * @param {LaundryLoad} load
 * @param {Date} now
 */
export function loadStatus(load, now) {
  if (load.status === 'running' && load.finishesAt && new Date(load.finishesAt).getTime() <= now.getTime()) return 'done';
  return load.status;
}

/** Whole minutes left (rounded up), 0 when finished. @param {LaundryLoad} load @param {Date} now */
export function minutesLeft(load, now) {
  if (!load.finishesAt) return 0;
  return Math.max(0, Math.ceil((new Date(load.finishesAt).getTime() - now.getTime()) / 60_000));
}

/** 0…1 progress of a running load. @param {LaundryLoad} load @param {Date} now */
export function loadProgress(load, now) {
  if (!load.startedAt || !load.finishesAt) return 0;
  const start = new Date(load.startedAt).getTime();
  const end = new Date(load.finishesAt).getTime();
  return Math.min(1, Math.max(0, (now.getTime() - start) / Math.max(1, end - start)));
}

/** @param {string} startedAt ISO @param {number} durationMin */
export function finishTime(startedAt, durationMin) {
  return new Date(new Date(startedAt).getTime() + durationMin * 60_000).toISOString();
}

/**
 * The load currently in the machine (running or finished but not unloaded), if any.
 * @param {LaundryLoad[]} loads
 */
export function activeLoad(loads) {
  return loads.find((l) => l.status === 'running' || l.status === 'done');
}

/** @param {LaundryLoad[]} loads */
export function queuedLoads(loads) {
  return loads.filter((l) => l.status === 'queued').sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

/**
 * Non-blocking notes for a selection: whites with darks/colours may stain; gentle care with normal items.
 * @param {{ laundryGroup: LaundryGroup, care?: string }[]} entries
 * @returns {('stain'|'care')[]}
 */
export function mixWarnings(entries) {
  /** @type {('stain'|'care')[]} */
  const out = [];
  const groups = new Set(entries.map((e) => e.laundryGroup));
  if (groups.has('whites') && (groups.has('darks') || groups.has('colours'))) out.push('stain');
  const gentle = entries.some((e) => e.care && GENTLE.includes(e.care));
  const normal = entries.some((e) => !e.care || e.care === 'normal');
  if (gentle && normal) out.push('care');
  return out;
}

/** Basket fill level for the scene. @param {number} count */
export function basketLevel(count) {
  if (count <= 0) return 'empty';
  return count >= 7 ? 'full' : 'some';
}

/**
 * Counts for the machine's summary line.
 * @param {Clothing[]} clothes
 * @param {LaundryExtra[]} extras
 */
export function laundrySummary(clothes, extras) {
  const dirty = clothes.filter((c) => c.status === 'dirty').length + extras.filter((e) => e.status === 'dirty').length;
  const washing = clothes.filter((c) => c.status === 'in_load').length + extras.filter((e) => e.status === 'in_load').length;
  const clean = clothes.filter((c) => c.status === 'clean' && c.care !== 'no_wash').length;
  return { dirty, washing, clean };
}

/**
 * Basket sections by colour group or by clothing slot (extras go to their colour group, or "other" by type).
 * @template {{ laundryGroup: LaundryGroup, slot?: string }} T
 * @param {T[]} entries
 * @param {'colour'|'type'} by
 * @param {string[]} slots slot order
 * @returns {{ key: string, items: T[] }[]}
 */
export function basketSections(entries, by, slots) {
  const keys = by === 'colour' ? GROUPS : [...slots, 'other'];
  const keyOf = (/** @type {T} */ e) => (by === 'colour' ? e.laundryGroup : e.slot && slots.includes(e.slot) ? e.slot : 'other');
  return keys.map((key) => ({ key, items: entries.filter((e) => keyOf(e) === key) })).filter((s) => s.items.length);
}
