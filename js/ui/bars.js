// @ts-check
// Top bar (location button, autosave status, settings) and bottom bar (objects, quick add, me).

import { html } from './lib.js';
import { t } from '../core/i18n.js';
import { locationById } from '../world/locations.js';
import { openWindow } from './sheet.js';
import { SaveStatus } from './save-status.js';
import { icon } from './icons.js';

/** @param {{ locationId: string }} props */
export function TopBar({ locationId }) {
  const loc = locationById(locationId);
  const name = t(`locations.${locationId}.name`);
  return html`<header class="topbar">
    <button type="button" class="location-button" onClick=${() => openWindow('map.main')} aria-label=${t('shell.openMap', { name })}>
      <span aria-hidden="true">${loc?.emoji}</span>
      <span class="label">${name}</span>
      <span class="caret" aria-hidden="true">▾</span>
    </button>
    <span class="spacer"></span>
    <${SaveStatus} />
    <button type="button" class="icon-button" onClick=${() => openWindow('settings.main')} aria-label=${t('shell.settings')}>
      ${icon('settings')}
    </button>
  </header>`;
}

export function BottomBar() {
  return html`<nav class="bottombar">
    <button type="button" class="bar-button left" onClick=${() => openWindow('world.list')}>
      ${icon('list')}<span>${t('shell.objects')}</span>
    </button>
    <button type="button" class="fab" onClick=${() => openWindow('quick.main')} aria-label=${t('shell.quickAction')}>
      ${icon('plus', { size: 28 })}
    </button>
    <button type="button" class="bar-button right" onClick=${() => openWindow('character.main')}>
      ${icon('user')}<span>${t('shell.me')}</span>
    </button>
  </nav>`;
}
