// @ts-check
// One accessible button per interactive object, positioned in % of the safe zone (docs/spec/03-ux-shell.md §4).

import { html } from '../ui/lib.js';
import { t } from '../core/i18n.js';
import { openWindow } from '../ui/sheet.js';
import { useUi } from '../ui/ui-state.js';
import { readingOrder } from '../world/objects.js';
import { badgeFor } from './badges.js';

/** @typedef {import('../world/types.js').SceneObject} SceneObject */

/** @param {{ objects: SceneObject[], settings: Record<string, any> }} props */
export function HitLayer({ objects, settings }) {
  const { sheet } = useUi();
  const ordered = readingOrder(objects);
  return html`<div class="hit-layer">
    ${ordered.map((obj) => {
      const { x, y, width, height } = obj.hitArea;
      const badge = badgeFor(obj);
      const label = t(obj.labelKey);
      return html`<button
        key=${obj.id}
        type="button"
        class="hit"
        data-object=${obj.id}
        data-open=${sheet?.sourceObjectId === obj.id ? 'true' : 'false'}
        style=${`left:${x * 100}%;top:${y * 100}%;width:${width * 100}%;height:${height * 100}%;z-index:${obj.z}`}
        aria-label=${badge?.text ? `${label}, ${badge.aria ?? badge.text}` : label}
        title=${label}
        onClick=${() => openWindow(obj.window, { props: obj.windowProps ?? {}, sourceObjectId: obj.id })}
      >
        ${settings.showHints && html`<span class="hint-dot" aria-hidden="true"></span>`}
        ${badge?.text && html`<span class="badge" data-tone=${badge.tone ?? 'neutral'} aria-hidden="true">${badge.text}</span>`}
      </button>`;
    })}
  </div>`;
}
