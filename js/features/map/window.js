// @ts-check
// Map: every shipped location is open (owner decision D-09); Study/Gym can be hidden in Settings.

import { html } from '../../ui/lib.js';
import { t } from '../../core/i18n.js';
import { SheetHeader, SheetBody, DoneFooter } from '../../ui/sheet.js';
import { useProfile } from '../../ui/hooks.js';
import { useUi } from '../../ui/ui-state.js';
import { PROFILE } from '../../core/schema.js';
import { LOCATIONS, isVisible } from '../../world/locations.js';
import { goToLocation } from '../../ui/navigation.js';
import { updateSettings } from '../settings/actions.js';
import { icon } from '../../ui/icons.js';

export default function MapWindow() {
  const settings = useProfile(PROFILE.settings);
  const { locationId } = useUi();
  const shipped = LOCATIONS.filter((loc) => loc.shipped);
  const visible = shipped.filter((loc) => isVisible(loc, settings));
  const hidden = shipped.filter((loc) => !isVisible(loc, settings));
  const toursSeen = settings.toursSeen ?? [];

  /** @param {'home'|'out'} group */
  const section = (group) => {
    const items = visible.filter((loc) => loc.group === group);
    if (!items.length) return null;
    return html`<section class="section">
      <h3 class="section-title">${t(`map.${group}`)}</h3>
      <div class="group">
        ${items.map((loc) => {
          const current = loc.id === locationId;
          return html`<button type="button" class="row" key=${loc.id} aria-current=${current ? 'location' : undefined} onClick=${() => goToLocation(loc.id)}>
            <span class="lead" style=${`background:${loc.wall}`} aria-hidden="true">${loc.emoji}</span>
            <span class="main">
              <span class="title">${t(`locations.${loc.id}.name`)}</span>
              <span class="subtitle" style="display:block">${t(`locations.${loc.id}.desc`)}</span>
            </span>
            <span class="meta">${current ? t('map.current') : toursSeen.includes(loc.id) ? '' : t('map.new')}</span>
            ${!current && html`<span class="chev">${icon('chevron')}</span>`}
          </button>`;
        })}
      </div>
    </section>`;
  };

  return html`
    <${SheetHeader} title=${t('map.title')} />
    <${SheetBody}>
      ${section('home')} ${section('out')}
      ${hidden.length > 0 &&
      html`<section class="section">
        <h3 class="section-title">${t('map.hidden')}</h3>
        <div class="group">
          ${hidden.map(
            (loc) => html`<div class="row" key=${loc.id}>
              <span class="lead" aria-hidden="true">${loc.emoji}</span>
              <span class="main"><span class="title">${t(`locations.${loc.id}.name`)}</span></span>
              <button type="button" class="btn" onClick=${() => updateSettings({ optionalRooms: { ...settings.optionalRooms, [loc.id]: true } })}>
                ${t('map.show')}
              </button>
            </div>`,
          )}
        </div>
      </section>`}
      ${shipped.length < LOCATIONS.length && html`<p class="field-help" style="margin-top:16px;text-align:center">${t('map.more')}</p>`}
    <//>
    <${DoneFooter} />
  `;
}
