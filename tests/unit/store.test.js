// @ts-check
import { describe, it, expect } from '../harness.js';
import { createStore } from '../../js/core/store.js';

/** In-memory persistence that records operations and can be told to fail. */
function fakePersist() {
  const state = { calls: /** @type {any[][]} */ ([]), fail: false };
  /** @param {any[]} ops */
  const persist = async (ops) => {
    if (state.fail) throw new Error('disk full');
    state.calls.push(ops);
  };
  return { state, persist };
}

describe('store', () => {
  it('inserts records with ids and timestamps and persists them in one batch', async () => {
    const { state, persist } = fakePersist();
    const store = createStore({ persist });
    const { result } = await store.mutate('test', (tx) => {
      tx.insert('alarms', { time: '07:00' });
      return tx.insert('alarms', { time: '08:00' });
    });
    expect(store.all('alarms').length).toBe(2);
    expect(typeof result.id).toBe('string');
    expect(result.deletedAt).toBe(null);
    expect(state.calls.length).toBe(1);
    expect(state.calls[0].length).toBe(2);
  });

  it('keeps state unchanged when persistence fails', async () => {
    const { state, persist } = fakePersist();
    const store = createStore({ persist });
    await store.mutate('a', (tx) => tx.insert('alarms', { id: 'a1', time: '07:00' }));
    state.fail = true;
    await expect(store.mutate('b', (tx) => tx.patch('alarms', 'a1', { time: '09:00' }))).rejects();
    expect(store.get('alarms', 'a1')?.time).toBe('07:00');
  });

  it('soft-deletes and undoes a mutation', async () => {
    const { persist } = fakePersist();
    const store = createStore({ persist });
    await store.mutate('a', (tx) => tx.insert('tasks', { id: 't1', title: 'Call' }));
    const { token } = await store.mutate('b', (tx) => tx.remove('tasks', 't1'));
    expect(store.get('tasks', 't1')).toBe(undefined);
    expect(store.all('tasks', { includeDeleted: true }).length).toBe(1);
    expect(await store.undo(/** @type {string} */ (token))).toBe(true);
    expect(store.get('tasks', 't1')?.title).toBe('Call');
  });

  it('undo of an insert removes the record completely', async () => {
    const { persist } = fakePersist();
    const store = createStore({ persist });
    const { token } = await store.mutate('a', (tx) => tx.insert('notes', { id: 'n1', body: 'x' }));
    await store.undo(/** @type {string} */ (token));
    expect(store.all('notes', { includeDeleted: true }).length).toBe(0);
  });

  it('sees its own pending changes inside a transaction', async () => {
    const { persist } = fakePersist();
    const store = createStore({ persist });
    await store.mutate('a', (tx) => {
      tx.insert('products', { id: 'p1', name: 'Milk' });
      tx.patch('products', 'p1', { favorite: true });
      expect(tx.all('products').length).toBe(1);
      expect(tx.get('products', 'p1')?.favorite).toBe(true);
    });
    expect(store.get('products', 'p1')?.favorite).toBe(true);
  });

  it('upserts profile singletons', async () => {
    const { persist } = fakePersist();
    const store = createStore({ persist });
    await store.mutate('a', (tx) => tx.setProfile('settings', { language: 'en' }));
    await store.mutate('b', (tx) => tx.setProfile('settings', { textSize: 'L' }));
    expect(store.profile('settings')?.language).toBe('en');
    expect(store.profile('settings')?.textSize).toBe('L');
  });

  it('notifies subscribers with touched collections and keeps array identity otherwise', async () => {
    const { persist } = fakePersist();
    const store = createStore({ persist });
    await store.mutate('a', (tx) => tx.insert('events', { title: 'A' }));
    const eventsBefore = store.all('events');
    /** @type {Set<string>|null} */
    let touched = null;
    store.subscribe((set) => {
      touched = set;
    });
    await store.mutate('b', (tx) => tx.insert('alarms', { time: '07:00' }));
    expect(touched && [.../** @type {Set<string>} */ (touched)]).toEqual(['alarms']);
    expect(store.all('events')).toBe(eventsBefore);
  });

  it('serialises concurrent mutations', async () => {
    const { persist } = fakePersist();
    const store = createStore({ persist });
    await store.mutate('a', (tx) => tx.insert('accounts', { id: 'w', balance: 0 }));
    await Promise.all(
      [1, 2, 3].map(() => store.mutate('inc', (tx) => tx.patch('accounts', 'w', { balance: (tx.get('accounts', 'w')?.balance ?? 0) + 1 }))),
    );
    expect(store.get('accounts', 'w')?.balance).toBe(3);
  });

  it('purges soft-deleted records older than the cutoff', async () => {
    const { persist } = fakePersist();
    const store = createStore({ persist });
    await store.mutate('a', (tx) => tx.insert('tasks', { id: 't1' }));
    await store.mutate('b', (tx) => tx.remove('tasks', 't1'));
    await store.purgeDeleted('2999-01-01T00:00:00.000Z');
    expect(store.all('tasks', { includeDeleted: true }).length).toBe(0);
  });

  it('freezes records in development mode', async () => {
    const { persist } = fakePersist();
    const store = createStore({ persist, freeze: true });
    await store.mutate('a', (tx) => tx.insert('alarms', { id: 'a1', repeatDays: [1] }));
    expect(Object.isFrozen(store.get('alarms', 'a1'))).toBe(true);
    expect(Object.isFrozen(store.get('alarms', 'a1')?.repeatDays)).toBe(true);
  });
});
