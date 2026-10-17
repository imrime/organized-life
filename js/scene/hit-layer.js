// @ts-check
// One accessible button per interactive object, positioned in % of the safe zone (docs/spec/03-ux-shell.md §4).
// Shows on-object displays (clock digits, calendar date), badges, optional hint dots and the feedback pulse.

import { html, useEffect, useRef, useState } from '../ui/lib.js';
import { t } from '../core/i18n.js';
import { bus } from '../core/bus.js';
import { openWindow } from '../ui/sheet.js';
import { useUi, getUi } from '../ui/ui-state.js';
import { readingOrder } from '../world/objects.js';
import { badgeFor, displayFor, stateTextFor } from './badges.js';

/** @typedef {import('../world/types.js').SceneObject} SceneObject */

/** @param {SceneObject} obj */
const keysOf = (obj) => (Array.isArray(obj.dataKey) ? obj.dataKey : [obj.dataKey]);

/**
 * Plays the object's feedback animation after its window closes, if its data changed meanwhile.
 * @param {SceneObject[]} objects
 */
function useSaveFeedback(objects) {
  const { sheet } = useUi();
  const changed = useRef(/** @type {Set<string>} */ (new Set()));
  const [pulse, setPulse] = useState(/** @type {string|null} */ (null));
  const lastSource = useRef(/** @type {string|null} */ (null));

  useEffect(
    () =>
      bus.on('saved', (/** @type {{ touched: Set<string>, quiet: boolean }} */ e) => {
        const source = getUi().sheet?.sourceObjectId;
        if (!source || e.quiet) return;
        const obj = objects.find((o) => o.id === source);
        if (obj && keysOf(obj).some((k) => e.touched.has(k))) changed.current.add(obj.id);
      }),
    [objects],
  );

  useEffect(() => {
    if (sheet?.sourceObjectId) {
      lastSource.current = sheet.sourceObjectId;
      return undefined;
    }
    const id = lastSource.current;
    lastSource.current = null;
    if (!id || !changed.current.has(id)) return undefined;
    changed.current.delete(id);
    setPulse(id);
    const timer = setTimeout(() => setPulse(null), 700);
    return () => clearTimeout(timer);
  }, [sheet?.sourceObjectId]);

  return pulse;
}

/** @param {{ objects: SceneObject[], settings: Record<string, any> }} props */
export function HitLayer({ objects, settings }) {
  const { sheet } = useUi();
  const pulse = useSaveFeedback(objects);
  const ordered = readingOrder(objects);
  return html`<div class="hit-layer">
    ${ordered.map((obj) => {
      const { x, y, width, height } = obj.hitArea;
      const badge = badgeFor(obj);
      const display = displayFor(obj);
      const label = t(obj.labelKey);
      const state = stateTextFor(obj);
      return html`<button
        key=${obj.id}
        type="button"
        class=${`hit${pulse === obj.id ? ' feedback' : ''}`}
        data-object=${obj.id}
        data-open=${sheet?.sourceObjectId === obj.id ? 'true' : 'false'}
        style=${`left:${x * 100}%;top:${y * 100}%;width:${width * 100}%;height:${height * 100}%;z-index:${obj.z}`}
        aria-label=${state ? `${label}, ${state}` : label}
        title=${label}
        onClick=${() => openWindow(obj.window, { props: obj.windowProps ?? {}, sourceObjectId: obj.id })}
      >
        ${display &&
        html`<span class=${`obj-display${display.dim ? ' dim' : ''}`} aria-hidden="true">
          ${display.lines.map((line, i) => html`<span key=${i} class=${`line line-${i}`}>${line}</span>`)}
        </span>`}
        ${settings.showHints && html`<span class="hint-dot" aria-hidden="true"></span>`}
        ${badge?.text && html`<span class="badge" data-tone=${badge.tone ?? 'neutral'} aria-hidden="true">${badge.text}</span>`}
      </button>`;
    })}
  </div>`;
}
