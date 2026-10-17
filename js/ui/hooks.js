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
  const seen = collections.map((c) => appStore.all(c));
  useEffect(() => {
    const unsubscribe = appStore.subscribe((touched) => {
      if (collections.some((c) => touched.has(c))) force(undefined);
    });
    // A write may have landed between render and subscription.
    if (collections.some((c, i) => appStore.all(c) !== seen[i])) force(undefined);
    return unsubscribe;
  }, [key]);
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
