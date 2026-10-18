// @ts-check
// Shared media list pieces: row with quick actions, random-pick button.

import { html } from '../../ui/lib.js';
import { t } from '../../core/i18n.js';
import { progressText } from './model.js';
import { KIND_ICON } from './item-page.js';

/** @typedef {import('./model.js').MediaItem} MediaItem */

/**
 * @param {{ item: MediaItem, sub?: string, actions?: { label: string, onClick: () => void }[], highlighted?: boolean, onOpen: () => void }} props
 */
export function MediaRow({ item, sub, actions = [], highlighted = false, onOpen }) {
  const meta = [item.year ? String(item.year) : '', progressText(item, { page: t('media.pageShort'), hours: t('media.hoursShort') }), sub ?? ''].filter(Boolean).join(' · ');
  return html`<div class=${`row media-row${highlighted ? ' picked' : ''}`} id=${`media-${item.id}`}>
    <button type="button" class="row-hit" onClick=${onOpen}>
      <span class="lead" aria-hidden="true">${KIND_ICON[item.kind]}</span>
      <span class="main">
        <span class="title">${item.favorite ? '★ ' : ''}${item.title}</span>
        <span class="subtitle" style="display:block">${meta}${item.rating ? ` ${'★'.repeat(item.rating)}` : ''}</span>
      </span>
    </button>
    ${actions.length > 0 &&
    html`<div class="row-actions">
      ${actions.map((a) => html`<button type="button" class="btn btn-small" key=${a.label} onClick=${a.onClick}>${a.label}</button>`)}
    </div>`}
  </div>`;
}

/** @param {{ label: string, onPick: () => void, disabled?: boolean }} props */
export function PickButton({ label, onPick, disabled = false }) {
  return html`<button type="button" class="btn wide pick-btn" disabled=${disabled} onClick=${onPick}>🎲 ${label}</button>`;
}

/** Scrolls a picked row into view after render. @param {string} id */
export function revealRow(id) {
  requestAnimationFrame(() => document.getElementById(`media-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
}

