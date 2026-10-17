// @ts-check
// Accessible list of all objects (docs/spec/03-ux-shell.md §9): opens the same windows as tapping the scene.

import { html, useState } from '../../ui/lib.js';
import { t } from '../../core/i18n.js';
import { matchesQuery } from '../../core/text.js';
import { SheetHeader, SheetBody, DoneFooter, openWindow } from '../../ui/sheet.js';
import { useProfile } from '../../ui/hooks.js';
import { useUi } from '../../ui/ui-state.js';
import { PROFILE } from '../../core/schema.js';
import { visibleLocations } from '../../world/locations.js';
import { objectsInRoom, readingOrder } from '../../world/objects.js';
import { badgeFor } from '../../scene/badges.js';
import { icon } from '../../ui/icons.js';

const SYSTEM = [
  { window: 'map.main', labelKey: 'map.title', emoji: '🗺️' },
  { window: 'character.main', labelKey: 'character.title', emoji: '🙂' },
  { window: 'settings.main', labelKey: 'settings.title', emoji: '⚙️' },
];

export default function WorldListWindow() {
  const settings = useProfile(PROFILE.settings);
  const { locationId } = useUi();
  const [query, setQuery] = useState('');
  const locations = visibleLocations(settings).sort((a, b) => Number(b.id === locationId) - Number(a.id === locationId));

  const sections = locations
    .map((loc) => ({
      loc,
      objects: readingOrder(objectsInRoom(loc.id)).filter((obj) => matchesQuery(`${t(obj.labelKey)} ${t(obj.descriptionKey)}`, query)),
    }))
    .filter((s) => s.objects.length);
  const system = SYSTEM.filter((s) => matchesQuery(t(s.labelKey), query));
  const nothing = !sections.length && !system.length;

  return html`
    <${SheetHeader} title=${t('worldList.title')}>
      <input
        class="search"
        type="search"
        placeholder=${t('worldList.search')}
        aria-label=${t('worldList.search')}
        value=${query}
        onInput=${(/** @type {Event} */ e) => setQuery(/** @type {HTMLInputElement} */ (e.currentTarget).value)}
      />
    <//>
    <${SheetBody}>
      ${!query && !sections.length && html`<p class="empty">${t('worldList.empty')}</p>`}
      ${sections.map(
        ({ loc, objects }) => html`<section class="section" key=${loc.id}>
          <h3 class="section-title">${loc.emoji} ${t(`locations.${loc.id}.name`)}</h3>
          <div class="group">
            ${objects.map((obj) => {
              const badge = badgeFor(obj);
              return html`<button
                type="button"
                class="row"
                key=${obj.id}
                onClick=${() => openWindow(obj.window, { props: obj.windowProps ?? {}, sourceObjectId: obj.id })}
              >
                <span class="main">
                  <span class="title">${t(obj.labelKey)}</span>
                  <span class="subtitle" style="display:block">${t(obj.descriptionKey)}</span>
                </span>
                ${badge?.text && html`<span class="meta">${badge.aria ?? badge.text}</span>`}
                <span class="chev">${icon('chevron')}</span>
              </button>`;
            })}
          </div>
        </section>`,
      )}
      ${system.length > 0 &&
      html`<section class="section">
        <h3 class="section-title">${t('worldList.system')}</h3>
        <div class="group">
          ${system.map(
            (s) => html`<button type="button" class="row" key=${s.window} onClick=${() => openWindow(s.window)}>
              <span class="lead" aria-hidden="true">${s.emoji}</span>
              <span class="main"><span class="title">${t(s.labelKey)}</span></span>
              <span class="chev">${icon('chevron')}</span>
            </button>`,
          )}
        </div>
      </section>`}
      ${query && nothing && html`<p class="empty">${t('worldList.noResults', { query })}</p>`}
    <//>
    <${DoneFooter} />
  `;
}
