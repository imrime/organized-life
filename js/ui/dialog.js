// @ts-check
// Centred dialogs: confirm (two buttons) and choice (several actions). Destructive buttons are red, on the right.

import { html, useEffect, useRef } from './lib.js';
import { setUi, useUi } from './ui-state.js';
import { t } from '../core/i18n.js';

/** @typedef {{ value: string, label: string, destructive?: boolean, primary?: boolean }} Choice */

/** @type {((value: string|null) => void)|null} */
let resolver = null;

/**
 * Shows a dialog with several choices; resolves with the chosen value or null (cancel / Escape / backdrop).
 * @param {{ title: string, message?: string, choices: Choice[], cancelLabel?: string }} options
 * @returns {Promise<string|null>}
 */
export function choiceDialog({ title, message, choices, cancelLabel }) {
  resolver?.(null);
  return new Promise((resolve) => {
    resolver = resolve;
    setUi({ dialog: { title, message, choices, cancelLabel: cancelLabel ?? t('common.cancel'), confirmLabel: '' } });
  });
}

/**
 * @param {{ title: string, message?: string, confirmLabel?: string, cancelLabel?: string, destructive?: boolean }} options
 * @returns {Promise<boolean>}
 */
export async function confirmDialog({ title, message, confirmLabel, cancelLabel, destructive = false }) {
  const value = await choiceDialog({
    title,
    message,
    cancelLabel,
    choices: [{ value: 'ok', label: confirmLabel ?? t('common.ok'), destructive, primary: !destructive }],
  });
  return value === 'ok';
}

export function confirmDiscard() {
  return confirmDialog({
    title: t('dialogs.discardTitle'),
    message: t('dialogs.discardMessage'),
    confirmLabel: t('common.discard'),
    cancelLabel: t('common.keepEditing'),
    destructive: true,
  });
}

/** @param {string|null} value */
function finish(value) {
  const resolve = resolver;
  resolver = null;
  setUi({ dialog: null });
  resolve?.(value);
}

export function DialogHost() {
  const { dialog } = useUi();
  /** @type {{ current: HTMLButtonElement|null }} */
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!dialog) return undefined;
    const previous = /** @type {HTMLElement|null} */ (document.activeElement);
    cancelRef.current?.focus();
    /** @param {KeyboardEvent} event */
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [dialog]);

  if (!dialog) return null;
  const choices = /** @type {Choice[]} */ (/** @type {any} */ (dialog).choices ?? []);
  const stacked = choices.length > 1;
  return html`<div class="dialog-layer" onClick=${(/** @type {MouseEvent} */ e) => e.target === e.currentTarget && finish(null)}>
    <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby=${dialog.message ? 'dialog-message' : undefined}>
      <h2 id="dialog-title">${dialog.title}</h2>
      ${dialog.message && html`<p id="dialog-message">${dialog.message}</p>`}
      <div class=${`actions${stacked ? ' stacked' : ''}`}>
        <button type="button" class="btn btn-ghost" ref=${cancelRef} onClick=${() => finish(null)}>${dialog.cancelLabel}</button>
        ${choices.map(
          (c) => html`<button
            type="button"
            key=${c.value}
            class=${c.destructive ? 'btn btn-danger solid' : c.primary ? 'btn btn-primary' : 'btn'}
            onClick=${() => finish(c.value)}
          >
            ${c.label}
          </button>`,
        )}
      </div>
    </div>
  </div>`;
}
