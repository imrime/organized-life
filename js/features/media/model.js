// @ts-check
// Media logic (pure): statuses per kind, status transitions with dates, filters, random pick (docs/spec/rooms/entertainment.md).

/**
 * @typedef {'film'|'series'|'game'|'track'|'album'|'book'} MediaKind
 * @typedef {{
 *   id: string, kind: MediaKind, title: string, creator?: string, year?: number|null, status: string, rating?: number|null,
 *   favorite: boolean, notes?: string, link?: string|null, tags: string[], platform?: string|null, whereToWatch?: string,
 *   progress?: { season?: number, episode?: number, page?: number, totalPages?: number, hours?: number }|null,
 *   album?: string, startedAt?: string|null, finishedAt?: string|null, nowPlaying?: boolean, updatedAt?: string,
 * }} MediaItem
 * @typedef {{ id: string, name: string, itemIds: string[], moodTags: string[], notes?: string, link?: string|null, nowPlaying: boolean }} Playlist
 */

/** @type {Record<MediaKind, string[]>} */
export const STATUSES = {
  film: ['watchlist', 'watching', 'watched', 'dropped'],
  series: ['watchlist', 'watching', 'watched', 'dropped'],
  game: ['backlog', 'playing', 'paused', 'completed', 'dropped'],
  track: ['want', 'listened'],
  album: ['want', 'listened'],
  book: ['to_read', 'reading', 'read', 'dropped'],
};

const STARTED = ['watching', 'playing', 'reading'];
const FINISHED = ['watched', 'completed', 'read', 'listened'];

export const PLATFORMS = ['pc', 'playstation', 'xbox', 'switch', 'mobile', 'other'];
export const MOODS = ['calm', 'focus', 'energetic', 'happy', 'melancholy', 'party', 'sleep', 'workout'];

/** Default status for a new item. @param {MediaKind} kind */
export const defaultStatus = (kind) => STATUSES[kind][0];

/**
 * Fields to patch when the status changes: start date on the first "in progress" status, finish date on completion.
 * @param {MediaItem|{ startedAt?: string|null, finishedAt?: string|null }} item
 * @param {string} status
 * @param {string} today
 */
export function statusPatch(item, status, today) {
  /** @type {Record<string, any>} */
  const patch = { status };
  if (STARTED.includes(status) && !item.startedAt) patch.startedAt = today;
  if (FINISHED.includes(status)) {
    patch.finishedAt = item.finishedAt ?? today;
    if (!item.startedAt) patch.startedAt = today;
  } else patch.finishedAt = null;
  return patch;
}

/** Next episode of a series (1-based). @param {MediaItem} item */
export function nextEpisode(item) {
  const p = item.progress ?? {};
  return { ...p, season: p.season ?? 1, episode: (p.episode ?? 0) + 1 };
}

/**
 * Random item from a list; `random` is injectable for tests.
 * @template T
 * @param {T[]} items
 * @param {() => number} [random]
 * @returns {T|undefined}
 */
export function randomPick(items, random = Math.random) {
  if (!items.length) return undefined;
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

/** Most recently updated "watching" film/series (shown on the TV). @param {MediaItem[]} items */
export function nowWatching(items) {
  return items
    .filter((i) => (i.kind === 'film' || i.kind === 'series') && i.status === 'watching')
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
}

/**
 * "S2 · E5" / "p. 120 / 380" / "12 h"
 * @param {MediaItem} item
 * @param {{ page: string, hours: string }} [units] localised short units
 */
export function progressText(item, units = { page: 'p.', hours: 'h' }) {
  const p = item.progress;
  if (!p) return '';
  if (item.kind === 'series' && (p.season || p.episode)) return `S${p.season ?? 1} · E${p.episode ?? 0}`;
  if (item.kind === 'book' && p.page) return p.totalPages ? `${units.page} ${p.page} / ${p.totalPages}` : `${units.page} ${p.page}`;
  if (item.kind === 'game' && p.hours) return `${p.hours} ${units.hours}`;
  return '';
}

/** Matches a mood/tag filter (empty filter matches all). @param {{ tags?: string[], moodTags?: string[] }} entry @param {string[]} moods */
export function matchesMoods(entry, moods) {
  if (!moods.length) return true;
  const tags = entry.moodTags ?? entry.tags ?? [];
  return moods.some((m) => tags.includes(m));
}

/** http(s) links only. @param {string|null|undefined} link */
export function isValidLink(link) {
  if (!link) return true;
  try {
    const url = new URL(link);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * @param {{ title: string, year?: string|number|null, link?: string|null }} form
 * @param {number} currentYear
 * @returns {Record<string, string>}
 */
export function validateMedia(form, currentYear) {
  /** @type {Record<string, string>} */
  const errors = {};
  if (!form.title.trim()) errors.title = 'form.errors.required';
  if (form.year !== null && form.year !== undefined && form.year !== '') {
    const y = Number(form.year);
    if (!(Number.isInteger(y) && y >= 1880 && y <= currentYear + 5)) errors.year = 'media.errors.year';
  }
  if (!isValidLink(form.link)) errors.link = 'media.errors.link';
  return errors;
}

/** Group label for favourites. @param {string} kind */
export function favouriteGroup(kind) {
  if (kind === 'film' || kind === 'series') return 'screen';
  if (kind === 'track' || kind === 'album') return 'music';
  if (kind === 'game') return 'games';
  if (kind === 'book') return 'books';
  return 'projects';
}
