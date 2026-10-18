// @ts-check
// Walk and place mutations. One running walk at a time; it survives reloads because it is stored.

import { appStore } from '../../core/store.js';
import { today } from '../../core/time.js';

/** @param {string|null} placeId */
export function startWalk(placeId) {
  return appStore.mutate('walks.start', (tx) => {
    const running = tx.all('walks').find((w) => w.status === 'running');
    if (running) return running;
    return tx.insert('walks', { date: today(), startedAt: new Date().toISOString(), endedAt: null, durationMin: 0, steps: null, distanceKm: null, placeId, notes: '', status: 'running' });
  });
}

/** @param {string|number|null|undefined} v */
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

/**
 * Saves a finished, past or edited walk.
 * @param {{ date: string, startTime?: string, durationMin: number|string, steps: any, distanceKm: any, placeId: string|null, notes: string }} form
 * @param {string|null} id existing walk (a running walk is finished by saving it)
 */
export function saveWalk(form, id) {
  return appStore.mutate('walks.save', (tx) => {
    const fields = {
      date: form.date,
      durationMin: Math.round(Number(form.durationMin)),
      steps: num(form.steps),
      distanceKm: num(form.distanceKm),
      placeId: form.placeId || null,
      notes: form.notes.trim(),
      status: 'done',
    };
    if (id) {
      const existing = tx.get('walks', id);
      return tx.patch('walks', id, { ...fields, endedAt: existing?.endedAt ?? new Date().toISOString() });
    }
    const startedAt = form.startTime ? new Date(`${form.date}T${form.startTime}`).toISOString() : null;
    const endedAt = startedAt ? new Date(new Date(startedAt).getTime() + fields.durationMin * 60_000).toISOString() : null;
    return tx.insert('walks', { ...fields, startedAt, endedAt });
  });
}

/** @param {string} id */
export function deleteWalk(id) {
  return appStore.mutate('walks.delete', (tx) => tx.remove('walks', id));
}

/**
 * @param {{ name: string, notes: string, favorite: boolean }} form
 * @param {string|null} id
 */
export function savePlace(form, id) {
  return appStore.mutate('places.save', (tx) => {
    const fields = { name: form.name.trim(), notes: form.notes, favorite: form.favorite };
    if (!id) return tx.insert('places', fields);
    const previous = tx.get('places', id);
    // Renaming a seeded place replaces its translated default name.
    return tx.patch('places', id, previous?.seedKey && fields.name ? { ...fields, seedKey: undefined } : fields);
  });
}

/** Walks keep their history; they just lose the place. @param {string} id */
export function deletePlace(id) {
  return appStore.mutate('places.delete', (tx) => {
    tx.all('walks').filter((w) => w.placeId === id).forEach((w) => tx.patch('walks', w.id, { placeId: null }));
    tx.remove('places', id);
  });
}
