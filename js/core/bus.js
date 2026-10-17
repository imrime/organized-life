// @ts-check
// Tiny event bus for app-wide signals ('saving', 'saved', 'save-failed', 'reminder', 'tour-done', 'power-mode').

/** @type {Map<string, Set<(payload: any) => void>>} */
const listeners = new Map();

export const bus = {
  /**
   * @param {string} event
   * @param {(payload: any) => void} fn
   * @returns {() => void} unsubscribe
   */
  on(event, fn) {
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    set.add(fn);
    return () => set?.delete(fn);
  },

  /**
   * @param {string} event
   * @param {any} [payload]
   */
  emit(event, payload) {
    const set = listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`bus listener for "${event}" failed`, err);
      }
    }
  },
};
