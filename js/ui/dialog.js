// @ts-check
// Centred confirm dialog. Destructive confirmations put the red button on the right.

import { html, useEffect, useRef } from './lib.js';
import { setUi, useUi } from './ui-state.js';
import { t } from '../core/i18n.js';

/** @type {((value: boolean) => void)|null} */
let resolver = null;

/**
 * @param {{ title: string, message?: string, confirmLabel?: string, cancelLabel?: string, destructive?: boolean }} options
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title, message, confirmLabel, cancelLabel, destructive = false }) {
  resolver?.(false);
  return new Promise((resolve) => {
    resolver = resolve;
    setUi({
      dialog: {
        title,
        message,
        confirmLabel: confirmLabel ?? t('common.ok'),
        cancelLabel: cancelLabel ?? t('common.cancel'),
        destructive,
      },
    });
  });
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

/** @param {boolean} value */
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
        finish(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [dialog]);

  if (!dialog) return null;
  return html`<div class="dialog-layer" onClick=${(/** @type {MouseEvent} */ e) => e.target === e.currentTarget && finish(false)}>
    <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-message">
      <h2 id="dialog-title">${dialog.title}</h2>
      ${dialog.message && html`<p id="dialog-message">${dialog.message}</p>`}
      <div class="actions">
        <button type="button" class="btn btn-ghost" ref=${cancelRef} onClick=${() => finish(false)}>${dialog.cancelLabel}</button>
        <button type="button" class=${dialog.destructive ? 'btn btn-danger solid' : 'btn btn-primary'} onClick=${() => finish(true)}>
          ${dialog.confirmLabel}
        </button>
      </div>
    </div>
  </div>`;
}
