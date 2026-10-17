// @ts-check
// Quiet autosave indicator: hidden when idle, "Saving…" only if a write is slow, "Saved" briefly.

import { html, useEffect, useState } from './lib.js';
import { bus } from '../core/bus.js';
import { t } from '../core/i18n.js';
import { toast } from './toast.js';
import { icon } from './icons.js';

export function SaveStatus() {
  const [state, setState] = useState(/** @type {'idle'|'saving'|'saved'|'error'} */ ('idle'));

  useEffect(() => {
    /** @type {ReturnType<typeof setTimeout>|undefined} */
    let slowTimer;
    /** @type {ReturnType<typeof setTimeout>|undefined} */
    let hideTimer;
    const offs = [
      bus.on('saving', (/** @type {{quiet: boolean}} */ e) => {
        if (e?.quiet) return;
        clearTimeout(slowTimer);
        slowTimer = setTimeout(() => setState((s) => (s === 'error' ? s : 'saving')), 300);
      }),
      bus.on('saved', (/** @type {{quiet: boolean}} */ e) => {
        if (e?.quiet) return;
        clearTimeout(slowTimer);
        clearTimeout(hideTimer);
        setState('saved');
        hideTimer = setTimeout(() => setState('idle'), 1500);
      }),
      bus.on('save-failed', () => {
        clearTimeout(slowTimer);
        clearTimeout(hideTimer);
        setState('error');
        toast(t('errors.saveFailed'));
      }),
    ];
    return () => {
      clearTimeout(slowTimer);
      clearTimeout(hideTimer);
      offs.forEach((off) => off());
    };
  }, []);

  const label = state === 'saving' ? t('shell.saving') : state === 'saved' ? t('shell.saved') : state === 'error' ? t('shell.notSaved') : '';
  return html`<span class="save-status" data-state=${state} aria-live="polite">
    ${state === 'error'
      ? html`<button type="button" onClick=${() => toast(t('shell.notSavedHelp'))}>${icon('alert', { size: 16 })} ${label}</button>`
      : html`${state === 'saved' && icon('check', { size: 16 })} ${label}`}
  </span>`;
}
