// @ts-check
// Hash routes: #/<locationId>[/<target>[/<page>[/<pageId>]]]. target = object slug or "~<window>".

/** System windows reachable as "~name". */
export const SYSTEM_WINDOWS = /** @type {const} */ ({
  map: 'map.main',
  list: 'world.list',
  me: 'character.main',
  settings: 'settings.main',
  quick: 'quick.main',
});

/**
 * @typedef {{ locationId: string|null, target: string|null, page: string|null, pageId: string|null }} Route
 */

/**
 * @param {string} hash e.g. "#/kitchen/refrigerator"
 * @returns {Route}
 */
export function parseHash(hash) {
  const parts = String(hash ?? '')
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
  return { locationId: parts[0] ?? null, target: parts[1] ?? null, page: parts[2] ?? null, pageId: parts[3] ?? null };
}

/**
 * @param {Partial<Route>} route
 * @returns {string}
 */
export function buildHash({ locationId, target, page, pageId }) {
  const parts = [locationId, target, page, pageId];
  const end = parts.findIndex((part) => !part);
  const used = end === -1 ? parts : parts.slice(0, end);
  return `#/${used.map((part) => encodeURIComponent(/** @type {string} */ (part))).join('/')}`;
}

/**
 * Hash target for a window opened without an object (system windows or plain window ids).
 * @param {string} windowId
 */
export function systemTarget(windowId) {
  const entry = Object.entries(SYSTEM_WINDOWS).find(([, id]) => id === windowId);
  return `~${entry ? entry[0] : windowId}`;
}

/**
 * Resolves a "~name" target to a window id.
 * @param {string} target
 * @returns {string|null}
 */
export function windowFromTarget(target) {
  if (!target.startsWith('~')) return null;
  const name = target.slice(1);
  return /** @type {Record<string, string>} */ (SYSTEM_WINDOWS)[name] ?? name;
}
