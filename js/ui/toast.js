// @ts-check
// Toast queue (max 2 visible). Toasts with an action stay 8 s, others 4 s.

import { html } from './lib.js';
import { getUi, setUi, useUi } from './ui-state.js';
import { appStore } from '../core/store.js';
import { t } from '../core/i18n.js';

let nextId = 1;

/**
 * @param {string} text
 * @param {{ actionLabel?: string, onAction?: () => void, duration?: number }} [options]
 * @returns {number} toast id
 */
export function toast(text, { actionLabel, onAction, duration } = {}) {
  const id = nextId++;
  setUi({ toasts: [...getUi().toasts, { id, text, actionLabel, onAction }].slice(-2) });
  setTimeout(() => dismissToast(id), duration ?? (actionLabel ? 8000 : 4000));
  return id;
}

/**
 * Toast offering to undo a store mutation.
 * @param {string} text
 * @param {string|null} token
 */
export function undoToast(text, token) {
  if (!token) return toast(text);
  return toast(text, { actionLabel: t('common.undo'), onAction: () => appStore.undo(token) });
}

/** @param {number} id */
export function dismissToast(id) {
  const toasts = getUi().toasts;
  if (toasts.some((item) => item.id === id)) setUi({ toasts: toasts.filter((item) => item.id !== id) });
}

export function Toasts() {
  const { toasts } = useUi();
  return html`<div class="toasts" role="status" aria-live="polite">
    ${toasts.map(
      (item) => html`<div class="toast" key=${item.id}>
        <span class="text">${item.text}</span>
        ${item.actionLabel &&
        html`<button
          type="button"
          onClick=${() => {
            dismissToast(item.id);
            item.onAction?.();
          }}
        >
          ${item.actionLabel}
        </button>`}
      </div>`,
    )}
  </div>`;
}
