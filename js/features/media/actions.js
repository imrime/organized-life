// @ts-check
// Media, playlist and collection mutations.

import { appStore } from '../../core/store.js';
import { today } from '../../core/time.js';
import { statusPatch, nextEpisode } from './model.js';

/** @typedef {import('./model.js').MediaItem} MediaItem */

/**
 * Saves an item and, when given, its collection membership (one undo step).
 * @param {Record<string, any>} form full item fields (kind, title, status…)
 * @param {string|null} id
 * @param {string[]} [collectionIds]
 */
export function saveMedia(form, id, collectionIds) {
  return appStore.mutate('media.save', (tx) => {
    const existing = id ? tx.get('media', id) : undefined;
    const fields = { ...form, title: String(form.title).trim(), ...statusPatch(existing ?? form, form.status, today()) };
    const saved = id ? tx.patch('media', id, fields) : tx.insert('media', { favorite: false, tags: [], nowPlaying: false, ...fields });
    if (collectionIds) setMembershipTx(tx, saved.id, collectionIds);
    return saved;
  });
}

/**
 * Puts an item (media or creative project) into exactly the given collections.
 * @param {import('../../core/store.js').Tx} tx
 * @param {string} itemId
 * @param {string[]} collectionIds
 */
export function setMembershipTx(tx, itemId, collectionIds) {
  for (const c of tx.all('mediaCollections')) {
    const has = c.itemIds.includes(itemId);
    const want = collectionIds.includes(c.id);
    if (has && !want) tx.patch('mediaCollections', c.id, { itemIds: c.itemIds.filter((/** @type {string} */ x) => x !== itemId) });
    if (!has && want) tx.patch('mediaCollections', c.id, { itemIds: [...c.itemIds, itemId] });
  }
}

/** @param {string} id @param {string} status */
export function setMediaStatus(id, status) {
  return appStore.mutate('media.status', (tx) => {
    const item = tx.get('media', id);
    if (item) tx.patch('media', id, statusPatch(item, status, today()));
  });
}

/** +1 episode for a series. @param {string} id */
export function addEpisode(id) {
  return appStore.mutate('media.episode', (tx) => {
    const item = tx.get('media', id);
    if (item) tx.patch('media', id, { progress: nextEpisode(/** @type {any} */ (item)) });
  });
}

/** @param {string} id @param {boolean} favorite */
export function setMediaFavorite(id, favorite) {
  return appStore.mutate('media.favorite', (tx) => tx.patch('media', id, { favorite }));
}

/** Deleting an item also takes it out of playlists and collections. @param {string} id */
export function deleteMedia(id) {
  return appStore.mutate('media.delete', (tx) => {
    tx.all('playlists').filter((p) => p.itemIds.includes(id)).forEach((p) => tx.patch('playlists', p.id, { itemIds: p.itemIds.filter((/** @type {string} */ x) => x !== id) }));
    tx.all('mediaCollections').filter((c) => c.itemIds.includes(id)).forEach((c) => tx.patch('mediaCollections', c.id, { itemIds: c.itemIds.filter((/** @type {string} */ x) => x !== id) }));
    tx.remove('media', id);
  });
}

/**
 * @param {{ name: string, itemIds: string[], moodTags: string[], notes: string, link: string|null }} form
 * @param {string|null} id
 */
export function savePlaylist(form, id) {
  return appStore.mutate('playlists.save', (tx) => {
    const fields = { ...form, name: form.name.trim(), link: form.link || null };
    return id ? tx.patch('playlists', id, fields) : tx.insert('playlists', { ...fields, nowPlaying: false });
  });
}

/** @param {string} id */
export function deletePlaylist(id) {
  return appStore.mutate('playlists.delete', (tx) => tx.remove('playlists', id));
}

/**
 * "Now playing": at most one playlist or music item at a time; null stops.
 * @param {{ collection: 'playlists'|'media', id: string }|null} target
 */
export function setNowPlaying(target) {
  return appStore.mutate('music.nowPlaying', (tx) => {
    tx.all('playlists').filter((p) => p.nowPlaying).forEach((p) => tx.patch('playlists', p.id, { nowPlaying: false }));
    tx.all('media').filter((m) => m.nowPlaying).forEach((m) => tx.patch('media', m.id, { nowPlaying: false }));
    if (target) tx.patch(target.collection, target.id, { nowPlaying: true });
  });
}

/** Creates a track inline (playlist editor). @param {{ title: string, creator: string }} t */
export function addTrack({ title, creator }) {
  return appStore.mutate('media.track', (tx) =>
    tx.insert('media', { kind: 'track', title: title.trim(), creator: creator.trim(), status: 'listened', favorite: false, tags: [], nowPlaying: false, year: null, rating: null, notes: '', link: null }),
  );
}

/**
 * @param {{ name: string, description: string, color: string }} form
 * @param {string|null} id
 */
export function saveCollection(form, id) {
  return appStore.mutate('collections.save', (tx) => {
    const fields = { name: form.name.trim(), description: form.description, color: form.color };
    return id ? tx.patch('mediaCollections', id, fields) : tx.insert('mediaCollections', { ...fields, itemIds: [] });
  });
}

/** @param {string} id */
export function deleteCollection(id) {
  return appStore.mutate('collections.delete', (tx) => tx.remove('mediaCollections', id));
}

/** @param {string} id @param {string[]} itemIds */
export function setCollectionItems(id, itemIds) {
  return appStore.mutate('collections.items', (tx) => tx.patch('mediaCollections', id, { itemIds: [...new Set(itemIds)] }));
}
