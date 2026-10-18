// @ts-check
// Laundry mutations (F-7): basket → queued load → running → done → unloaded.

import { appStore } from '../../core/store.js';
import { CYCLES, defaultLoadType, cycleFor, loadStatus, finishTime } from './model.js';

/** @typedef {import('./model.js').LaundryLoad} LaundryLoad */
/** @typedef {import('../../core/store.js').Tx} Tx */

const loadsIn = (/** @type {Tx} */ tx) => /** @type {LaundryLoad[]} */ (/** @type {unknown} */ (tx.all('laundryLoads')));

/** Entries (clothes and extras) of a load, for defaults. @param {Tx} tx @param {string[]} itemIds @param {string[]} extraIds */
function entriesOf(tx, itemIds, extraIds) {
  return [
    ...itemIds.map((id) => tx.get('clothingItems', id)).filter(Boolean).map((c) => ({ laundryGroup: c.laundryGroup, care: c.care })),
    ...extraIds.map((id) => tx.get('laundryExtras', id)).filter(Boolean).map((e) => ({ laundryGroup: e.laundryGroup, kind: e.kind })),
  ];
}

/** Persists lazy completion of running loads whose time has passed. @param {Tx} tx @param {Date} now */
function settleTx(tx, now) {
  for (const load of loadsIn(tx)) {
    if (load.status === 'running' && loadStatus(load, now) === 'done') tx.patch('laundryLoads', load.id, { status: 'done', finishedAt: load.finishesAt });
  }
}

/** Called when the machine window opens and at startup. */
export function settleLoads() {
  const now = new Date();
  const due = /** @type {LaundryLoad[]} */ (/** @type {unknown} */ (appStore.all('laundryLoads'))).some((l) => l.status === 'running' && loadStatus(l, now) === 'done');
  if (!due) return Promise.resolve({ token: null, result: undefined });
  return appStore.mutate('laundry.settle', (tx) => settleTx(tx, now), { quiet: true });
}

/**
 * Adds a non-wardrobe item (towels, bed linen…) to the basket.
 * @param {{ kind: string, label?: string, laundryGroup?: import('./model.js').LaundryGroup }} extra
 */
export function addExtra({ kind, label = '', laundryGroup }) {
  return appStore.mutate('laundry.extra', (tx) =>
    tx.insert('laundryExtras', {
      label: label.trim(),
      ...(kind !== 'other' ? { seedKey: `laundry.extras.${kind}` } : {}),
      kind,
      laundryGroup: laundryGroup ?? (kind === 'towels' || kind === 'linen' ? 'whites' : 'colours'),
      status: 'dirty',
    }),
  );
}

/** @param {string} id */
export function deleteExtra(id) {
  return appStore.mutate('laundry.extraDelete', (tx) => tx.remove('laundryExtras', id));
}

/** Clean wardrobe items picked in the basket go to the laundry. @param {string[]} ids */
export function markDirty(ids) {
  return appStore.mutate('laundry.dirty', (tx) => ids.forEach((id) => tx.get('clothingItems', id) && tx.patch('clothingItems', id, { status: 'dirty' })));
}

/**
 * Moves basket items into a queued load (a new one when `loadId` is null).
 * @param {{ itemIds: string[], extraIds: string[], loadId: string|null }} args
 * @returns {Promise<{ token: string|null, result: LaundryLoad }>}
 */
export function addToLoad({ itemIds, extraIds, loadId }) {
  return /** @type {any} */ (
    appStore.mutate('laundry.addToLoad', (tx) => {
      itemIds.forEach((id) => tx.patch('clothingItems', id, { status: 'in_load' }));
      extraIds.forEach((id) => tx.patch('laundryExtras', id, { status: 'in_load' }));
      const existing = loadId ? tx.get('laundryLoads', loadId) : undefined;
      if (existing && existing.status === 'queued') {
        const ids = { itemIds: [...existing.itemIds, ...itemIds], extraIds: [...existing.extraIds, ...extraIds] };
        return tx.patch('laundryLoads', existing.id, ids);
      }
      const loadType = defaultLoadType(entriesOf(tx, itemIds, extraIds));
      const cycle = cycleFor(loadType);
      return tx.insert('laundryLoads', { itemIds, extraIds, loadType, cycle, ...CYCLES[cycle], status: 'queued', startedAt: null, finishesAt: null, finishedAt: null });
    })
  );
}

/**
 * Takes one entry out of a queued load and returns it to the basket; an empty load is removed.
 * @param {string} loadId
 * @param {string} id
 * @param {'item'|'extra'} kind
 */
export function removeFromLoad(loadId, id, kind) {
  return appStore.mutate('laundry.removeFromLoad', (tx) => {
    const load = tx.get('laundryLoads', loadId);
    if (!load) return;
    const itemIds = kind === 'item' ? load.itemIds.filter((/** @type {string} */ x) => x !== id) : load.itemIds;
    const extraIds = kind === 'extra' ? load.extraIds.filter((/** @type {string} */ x) => x !== id) : load.extraIds;
    tx.patch(kind === 'item' ? 'clothingItems' : 'laundryExtras', id, { status: 'dirty' });
    if (!itemIds.length && !extraIds.length) tx.remove('laundryLoads', loadId);
    else tx.patch('laundryLoads', loadId, { itemIds, extraIds });
  });
}

/**
 * Saves settings of a queued load and optionally starts it (only one load may run).
 * @param {string} loadId
 * @param {{ loadType: string, cycle: string, temperatureC: number, durationMin: number }} settings
 * @param {boolean} start
 * @returns {Promise<{ token: string|null, result: 'started'|'busy'|'saved' }>}
 */
export function saveLoad(loadId, settings, start) {
  return /** @type {any} */ (
    appStore.mutate('laundry.start', (tx) => {
      const now = new Date();
      settleTx(tx, now);
      if (start && loadsIn(tx).some((l) => l.id !== loadId && (l.status === 'running' || l.status === 'done'))) {
        tx.patch('laundryLoads', loadId, settings);
        return 'busy';
      }
      if (!start) {
        tx.patch('laundryLoads', loadId, settings);
        return 'saved';
      }
      const startedAt = now.toISOString();
      tx.patch('laundryLoads', loadId, { ...settings, status: 'running', startedAt, finishesAt: finishTime(startedAt, settings.durationMin), finishedAt: null });
      return 'started';
    })
  );
}

/** Marks a running load finished right away. @param {string} loadId */
export function finishNow(loadId) {
  return appStore.mutate('laundry.finish', (tx) => {
    const now = new Date().toISOString();
    tx.patch('laundryLoads', loadId, { status: 'done', finishesAt: now, finishedAt: now });
  });
}

/** Cancels a queued or running load; its items go back to the basket. @param {string} loadId */
export function cancelLoad(loadId) {
  return appStore.mutate('laundry.cancel', (tx) => {
    const load = tx.get('laundryLoads', loadId);
    if (!load) return;
    load.itemIds.forEach((/** @type {string} */ id) => tx.get('clothingItems', id) && tx.patch('clothingItems', id, { status: 'dirty' }));
    load.extraIds.forEach((/** @type {string} */ id) => tx.get('laundryExtras', id) && tx.patch('laundryExtras', id, { status: 'dirty' }));
    tx.patch('laundryLoads', loadId, { status: 'cancelled' });
  });
}

/** Unload: clothes become clean (washCount + 1), extras are done and removed. @param {string} loadId */
export function unloadLoad(loadId) {
  return appStore.mutate('laundry.unload', (tx) => {
    const load = tx.get('laundryLoads', loadId);
    if (!load) return 0;
    let count = 0;
    for (const id of load.itemIds) {
      const item = tx.get('clothingItems', id);
      if (!item) continue;
      tx.patch('clothingItems', id, { status: 'clean', washCount: (item.washCount ?? 0) + 1 });
      count++;
    }
    for (const id of load.extraIds) {
      if (!tx.get('laundryExtras', id)) continue;
      tx.remove('laundryExtras', id);
      count++;
    }
    tx.patch('laundryLoads', loadId, { status: 'unloaded', finishedAt: load.finishedAt ?? load.finishesAt ?? new Date().toISOString() });
    return count;
  });
}
