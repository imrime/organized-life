// @ts-check
// Browser-only: real IndexedDB in a throwaway database.
import { describe, it, expect } from '../harness.js';
import { openDb, loadAll, writeOps, getMeta, putMeta, deleteDb } from '../../js/core/db.js';
import { createStore } from '../../js/core/store.js';

const TEST_DB = 'organized-life-test';

describe('db (IndexedDB)', () => {
  it('creates every store and round-trips records across reopen', async () => {
    await deleteDb(TEST_DB);
    let db = await openDb(TEST_DB);
    const store = createStore({ persist: (ops) => writeOps(db, ops) });
    await store.mutate('a', (tx) => {
      tx.insert('alarms', { id: 'a1', time: '07:00' });
      tx.setProfile('settings', { language: 'en' });
    });
    await putMeta(db, { id: 'schema', version: 1 });
    db.close();

    db = await openDb(TEST_DB);
    const data = await loadAll(db);
    expect(data.alarms.length).toBe(1);
    expect(data.profile[0].language).toBe('en');
    expect((await getMeta(db, 'schema'))?.version).toBe(1);
    db.close();
    await deleteDb(TEST_DB);
  });

  it('writes a multi-store batch atomically (all or nothing)', async () => {
    await deleteDb(TEST_DB);
    const db = await openDb(TEST_DB);
    // Second op targets a store that does not exist → transaction creation fails → nothing written.
    await expect(
      writeOps(db, [
        { collection: 'alarms', key: 'x', value: { id: 'x' } },
        { collection: 'no-such-store', key: 'y', value: { id: 'y' } },
      ]),
    ).rejects();
    const data = await loadAll(db);
    expect(data.alarms.length).toBe(0);
    db.close();
    await deleteDb(TEST_DB);
  });
});
