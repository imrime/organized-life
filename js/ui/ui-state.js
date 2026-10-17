// @ts-check
// Transient UI state (current location, open sheet, toasts, dialog). Not persisted.

import { useEffect, useReducer } from './lib.js';

/**
 * @typedef {{ id: string, params?: Record<string, any> }} SheetPage
 * @typedef {{
 *   windowId: string,
 *   props: Record<string, any>,
 *   pages: SheetPage[],
 *   dirty: boolean,
 *   sourceObjectId: string|null,
 *   key: number,
 * }} SheetState
 * @typedef {{ id: number, text: string, actionLabel?: string, onAction?: () => void }} ToastItem
 * @typedef {{ title: string, message?: string, confirmLabel: string, cancelLabel: string, destructive?: boolean, choices?: { value: string, label: string, destructive?: boolean, primary?: boolean }[] }} DialogState
 * @typedef {{
 *   locationId: string,
 *   sheet: SheetState|null,
 *   toasts: ToastItem[],
 *   dialog: DialogState|null,
 *   banner: { text: string, key: number }|null,
 *   veil: boolean,
 *   ringing: import('../core/reminders.js').ReminderInstance[]|null,
 *   nightstand: boolean,
 *   tour: { locationId: string, step: number }|null,
 * }} UiState
 */

/** @type {UiState} */
let state = { locationId: 'bedroom', sheet: null, toasts: [], dialog: null, banner: null, veil: false, ringing: null, nightstand: false, tour: null };

/** @type {Set<() => void>} */
const listeners = new Set();

export function getUi() {
  return state;
}

/** @param {Partial<UiState>} patch */
export function setUi(patch) {
  state = { ...state, ...patch };
  for (const listener of [...listeners]) listener();
}

/** @param {() => void} listener */
export function subscribeUi(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Re-renders the calling component on every UI state change. */
export function useUi() {
  const [, force] = useReducer((n) => n + 1, 0);
  useEffect(() => subscribeUi(() => force(undefined)), []);
  return state;
}
