// @ts-check
// In-memory store with atomic, write-through, undoable mutations.
// Persistence is injected (IndexedDB in the app, a fake in tests), so this module has no DOM/IDB dependency.

import { newId, nowIso } from './ids.js';
import { bus } from './bus.js';

/**
 * @typedef {{ id: string, createdAt: string, updatedAt: string, deletedAt?: string|null, [key: string]: any }} Rec
 * @typedef {{ collection: string, id: string, before: Rec|null, after: Rec|null }} Change
 * @typedef {{ collection: string, key: string, value: Rec|null }} Op
 * @typedef {{
 *   get: (collection: string, id: string) => Rec|undefined,
 *   all: (collection: string) => Rec[],
 *   insert: (collection: string, partial: Record<string, any>) => Rec,
 *   patch: (collection: string, id: string, partial: Record<string, any>) => Rec,
 *   replace: (collection: string, record: Rec) => Rec,
 *   remove: (collection: string, id: string) => void,
 *   purge: (collection: string, id: string) => void,
 *   setProfile: (id: string, partial: Record<string, any>) => Rec,
 * }} Tx
 * @typedef {ReturnType<typeof createStore>} Store
 */

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(/** @type {any} */ (value)[key]);
  }
  return value;
}

/**
 * @param {{ persist: (ops: Op[]) => Promise<void>, freeze?: boolean, undoLimit?: number }} options
 */
export function createStore({ persist, freeze = false, undoLimit = 20 }) {
  /** @type {Map<string, Map<string, Rec>>} */
  const data = new Map();
  /** @type {Map<string, readonly Rec[]>} visible (non-deleted) records per collection */
  const cache = new Map();
  /** @type {Set<(touched: Set<string>) => void>} */
  const listeners = new Set();
  /** @type {{ token: string, label: string, changes: Change[] }[]} */
  const undoStack = [];
  /** @type {Promise<unknown>} serialises mutations */
  let queue = Promise.resolve();
  let seq = 0;

  /** @param {Rec} record */
  const prep = (record) => (freeze ? deepFreeze(record) : record);

  /** @param {string} name */
  function collection(name) {
    let map = data.get(name);
    if (!map) {
      map = new Map();
      data.set(name, map);
    }
    return map;
  }

  /**
   * Replaces the whole state (boot, import). Does not persist.
   * @param {Record<string, Rec[]>} snapshot
   */
  function load(snapshot) {
    data.clear();
    cache.clear();
    for (const [name, records] of Object.entries(snapshot)) {
      const map = collection(name);
      for (const record of records) map.set(record.id, prep(record));
    }
  }

  /**
   * @param {string} name
   * @param {string} id
   * @returns {Rec|undefined}
   */
  function get(name, id) {
    const record = data.get(name)?.get(id);
    return record && !record.deletedAt ? record : undefined;
  }

  /**
   * @param {string} name
   * @param {{ includeDeleted?: boolean }} [options]
   * @returns {readonly Rec[]} stable array identity until the collection changes
   */
  function all(name, { includeDeleted = false } = {}) {
    if (includeDeleted) return [...collection(name).values()];
    let list = cache.get(name);
    if (!list) {
      list = Object.freeze([...collection(name).values()].filter((r) => !r.deletedAt));
      cache.set(name, list);
    }
    return list;
  }

  /** @param {string} id */
  function profile(id) {
    return get('profile', id);
  }

  /**
   * @param {Change[]} changes
   * @param {boolean} [quiet] background writes (e.g. last location) don't flash the autosave indicator
   */
  async function commit(changes, quiet = false) {
    bus.emit('saving', { quiet });
    /** @type {Op[]} */
    const ops = changes.map((ch) => ({ collection: ch.collection, key: ch.id, value: ch.after }));
    try {
      await persist(ops);
    } catch (err) {
      bus.emit('save-failed', { error: err, quiet });
      throw err;
    }
    /** @type {Set<string>} */
    const touched = new Set();
    for (const ch of changes) {
      const map = collection(ch.collection);
      if (ch.after) map.set(ch.id, ch.after);
      else map.delete(ch.id);
      touched.add(ch.collection);
      cache.delete(ch.collection);
    }
    for (const listener of [...listeners]) listener(touched);
    bus.emit('saved', { touched, quiet });
  }

  /**
   * @template T
   * @param {() => Promise<T>} job
   * @returns {Promise<T>}
   */
  function enqueue(job) {
    const run = queue.then(job);
    queue = run.catch(() => undefined);
    return run;
  }

  /**
   * Runs `fn` against a transaction view and commits all its changes atomically.
   * @template T
   * @param {string} label i18n key describing the action (used for undo toasts)
   * @param {(tx: Tx) => T} fn synchronous
   * @param {{ quiet?: boolean }} [options]
   * @returns {Promise<{ token: string|null, result: T }>}
   */
  function mutate(label, fn, { quiet = false } = {}) {
    return enqueue(async () => {
      /** @type {Map<string, Change>} */
      const pending = new Map();
      /** @param {string} c @param {string} id */
      const keyOf = (c, id) => `${c}\u0000${id}`;
      /** @param {string} c @param {string} id @returns {Rec|null} */
      const current = (c, id) => {
        const change = pending.get(keyOf(c, id));
        if (change) return change.after;
        return data.get(c)?.get(id) ?? null;
      };
      /** @param {string} c @param {string} id @param {Rec|null} after */
      const stage = (c, id, after) => {
        const key = keyOf(c, id);
        const change = pending.get(key);
        if (change) change.after = after;
        else pending.set(key, { collection: c, id, before: data.get(c)?.get(id) ?? null, after });
        return after;
      };
      const now = nowIso();

      /** @type {Tx} */
      const tx = {
        get(c, id) {
          const record = current(c, id);
          return record && !record.deletedAt ? record : undefined;
        },
        all(c) {
          /** @type {Map<string, Rec>} */
          const merged = new Map(collection(c));
          for (const change of pending.values()) {
            if (change.collection !== c) continue;
            if (change.after) merged.set(change.id, change.after);
            else merged.delete(change.id);
          }
          return [...merged.values()].filter((r) => !r.deletedAt);
        },
        insert(c, partial) {
          const id = partial.id ?? newId();
          if (current(c, id)) throw new Error(`Duplicate id ${c}/${id}`);
          return /** @type {Rec} */ (stage(c, id, prep({ ...partial, id, createdAt: now, updatedAt: now, deletedAt: null })));
        },
        patch(c, id, partial) {
          const record = current(c, id);
          if (!record || record.deletedAt) throw new Error(`Missing record ${c}/${id}`);
          return /** @type {Rec} */ (stage(c, id, prep({ ...record, ...partial, id, updatedAt: now })));
        },
        replace(c, record) {
          const existing = current(c, record.id);
          return /** @type {Rec} */ (
            stage(c, record.id, prep({ ...record, createdAt: existing?.createdAt ?? record.createdAt ?? now, updatedAt: now }))
          );
        },
        remove(c, id) {
          const record = current(c, id);
          if (!record || record.deletedAt) return;
          stage(c, id, prep({ ...record, deletedAt: now, updatedAt: now }));
        },
        purge(c, id) {
          if (current(c, id) || data.get(c)?.has(id)) stage(c, id, null);
        },
        setProfile(id, partial) {
          return current('profile', id) ? tx.patch('profile', id, partial) : tx.insert('profile', { ...partial, id });
        },
      };

      const result = fn(tx);
      const changes = [...pending.values()].filter((ch) => ch.before !== ch.after);
      if (!changes.length) return { token: null, result };
      await commit(changes, quiet);
      const token = `m${++seq}`;
      undoStack.push({ token, label, changes });
      if (undoStack.length > undoLimit) undoStack.shift();
      return { token, result };
    });
  }

  /**
   * Reverts a previous mutation by restoring the before-images of all records it touched.
   * @param {string} token
   * @returns {Promise<boolean>}
   */
  function undo(token) {
    return enqueue(async () => {
      const index = undoStack.findIndex((entry) => entry.token === token);
      if (index < 0) return false;
      const [entry] = undoStack.splice(index, 1);
      /** @type {Change[]} */
      const inverse = entry.changes.map((ch) => ({
        collection: ch.collection,
        id: ch.id,
        before: data.get(ch.collection)?.get(ch.id) ?? null,
        after: ch.before,
      }));
      await commit(inverse);
      return true;
    });
  }

  /**
   * @param {(touched: Set<string>) => void} listener
   * @returns {() => void}
   */
  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /** Full copy of all records including soft-deleted ones (for backups). */
  function snapshot() {
    /** @type {Record<string, Rec[]>} */
    const out = {};
    for (const [name, map] of data) out[name] = [...map.values()];
    return out;
  }

  /**
   * Hard-deletes soft-deleted records whose deletedAt is older than the cutoff.
   * @param {string} cutoffIso
   */
  function purgeDeleted(cutoffIso) {
    return mutate('store.purge', (tx) => {
      for (const [name, map] of data) {
        for (const record of map.values()) {
          if (record.deletedAt && record.deletedAt < cutoffIso) tx.purge(name, record.id);
        }
      }
    });
  }

  return { load, get, all, profile, mutate, undo, subscribe, snapshot, purgeDeleted };
}

/** The app-wide store instance, set once at boot (live binding for importers). */
/** @type {Store} */
export let appStore = /** @type {any} */ (null);

/** @param {Store} store */
export function setAppStore(store) {
  appStore = store;
}
