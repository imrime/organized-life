// @ts-check
// Thin IndexedDB layer: one object store per collection, keyPath "id".

import { DB_NAME, DB_VERSION, COLLECTIONS, META_STORE } from './schema.js';

/**
 * @typedef {{ collection: string, key: string, value: Record<string, any>|null }} WriteOp
 *   value null = hard delete of key
 */

/**
 * @template T
 * @param {IDBRequest<T>} request
 * @returns {Promise<T>}
 */
function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Opens (and creates/upgrades) the database.
 * @param {string} [name]
 * @returns {Promise<IDBDatabase>}
 */
export function openDb(name = DB_NAME) {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = indexedDB.open(name, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of [...COLLECTIONS, META_STORE]) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Another tab with a newer version wants to upgrade: let it.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Database upgrade is blocked by another open tab'));
  });
}

/**
 * Reads every collection.
 * @param {IDBDatabase} db
 * @returns {Promise<Record<string, any[]>>}
 */
export async function loadAll(db) {
  const tx = db.transaction([...COLLECTIONS], 'readonly');
  const results = await Promise.all(COLLECTIONS.map((name) => promisify(tx.objectStore(name).getAll())));
  return Object.fromEntries(COLLECTIONS.map((name, i) => [name, results[i]]));
}

/**
 * Applies all operations in a single readwrite transaction (all-or-nothing).
 * @param {IDBDatabase} db
 * @param {WriteOp[]} ops
 * @returns {Promise<void>}
 */
export function writeOps(db, ops) {
  if (!ops.length) return Promise.resolve();
  const stores = [...new Set(ops.map((op) => op.collection))];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    for (const op of ops) {
      const store = tx.objectStore(op.collection);
      if (op.value) store.put(op.value);
      else store.delete(op.key);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

/**
 * @param {IDBDatabase} db
 * @param {string} id
 * @returns {Promise<Record<string, any>|undefined>}
 */
export function getMeta(db, id) {
  return promisify(db.transaction(META_STORE, 'readonly').objectStore(META_STORE).get(id));
}

/**
 * @param {IDBDatabase} db
 * @param {Record<string, any> & {id: string}} record
 */
export function putMeta(db, record) {
  return writeOps(db, [{ collection: META_STORE, key: record.id, value: record }]);
}

/**
 * Deletes a whole database (used by tests and "Reset all data").
 * @param {string} name
 * @returns {Promise<void>}
 */
export function deleteDb(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}
