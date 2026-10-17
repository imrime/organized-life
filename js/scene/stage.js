// @ts-check
// Scene stage: 2:3 safe zone scaled to fit, art bleeding to the edges, character and hit layer on top
// (docs/spec/03-ux-shell.md §3).

import { html } from '../ui/lib.js';
import { t } from '../core/i18n.js';
import { locationById } from '../world/locations.js';
import { objectsInRoom, characterSpot } from '../world/objects.js';
import { useUi } from '../ui/ui-state.js';
import { useProfile, useStoreChanges } from '../ui/hooks.js';
import { PROFILE } from '../core/schema.js';
import { HitLayer } from './hit-layer.js';
import { SceneCharacter } from './character.js';
import { roomArt } from './art/index.js';

/** @param {{ locationId: string, settings: Record<string, any> }} props */
export function Stage({ locationId, settings }) {
  const loc = locationById(locationId) ?? locationById('bedroom');
  const { veil, banner } = useUi();
  const character = useProfile(PROFILE.character);
  const objects = loc ? objectsInRoom(loc.id) : [];
  // Re-render art and badges whenever data behind this room's objects changes.
  useStoreChanges([...new Set(objects.flatMap((o) => (Array.isArray(o.dataKey) ? o.dataKey : [o.dataKey]))), 'reminderState']);
  if (!loc) return null;
  const style = `--wall: ${loc.wall}; --floor: ${loc.floor}; --floor-line: ${Math.round(loc.floorLine * 100)}%`;

  return html`<main class="stage" style=${style} aria-label=${t('shell.scene', { name: t(`locations.${loc.id}.name`) })}>
    <div class="safe-zone">
      <div class="art-layer" aria-hidden="true">${roomArt(loc)}</div>
      <${SceneCharacter} spot=${characterSpot(loc.id)} character=${character} />
      <${HitLayer} objects=${objects} settings=${settings} />
    </div>
    <div class="transition-veil" data-active=${veil ? 'true' : 'false'}></div>
    ${banner && html`<div class="location-banner" key=${banner.key} aria-hidden="true">${banner.text}</div>`}
  </main>`;
}
