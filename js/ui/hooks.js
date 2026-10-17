// @ts-check
// Preact hooks over the app store.

import { useEffect, useReducer } from './lib.js';
import { appStore } from '../core/store.js';

/**
 * Re-renders when any of the given collections changes.
 * @param {string[]} collections
 */
export function useStoreChanges(collections) {
  const [, force] = useReducer((n) => n + 1, 0);
  const key = collections.join('|');
  useEffect(
    () =>
      appStore.subscribe((touched) => {
        if (collections.some((c) => touched.has(c))) force(undefined);
      }),
    [key],
  );
}

/** @param {string} name */
export function useCollection(name) {
  useStoreChanges([name]);
  return appStore.all(name);
}

/** @param {string} id */
export function useProfile(id) {
  useStoreChanges(['profile']);
  return /** @type {Record<string, any>} */ (appStore.profile(id) ?? {});
}
