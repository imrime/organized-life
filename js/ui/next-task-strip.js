// @ts-check
// Next-task strip: one most relevant item under the top bar (docs/spec/05-cross-system.md §4).

import { html, useEffect, useReducer } from './lib.js';
import { appStore } from '../core/store.js';
import { PROFILE } from '../core/schema.js';
import { today } from '../core/time.js';
import { t } from '../core/i18n.js';
import { useStoreChanges } from './hooks.js';
import { icon } from './icons.js';

/**
 * @typedef {{
 *   key: string,        // stable per item and day (used for "hide for today")
 *   rank: number,       // lower = more important (spec table §4)
 *   at?: number,        // ms timestamp for tie-breaking
 *   emoji: string,
 *   text: string,
 *   open: () => void,
 * }} StripItem
 */

/** @type {Map<string, (now: Date) => StripItem[]>} */
const providers = new Map();

/**
 * @param {string} name
 * @param {(now: Date) => StripItem[]} provide
 */
export function registerStripProvider(name, provide) {
  providers.set(name, provide);
}

/**
 * Highest-ranked item not hidden for today (pure apart from providers).
 * @param {Date} now
 * @param {{ key: string, date: string }[]} dismissed
 */
export function pickStripItem(now, dismissed) {
  const day = today(now);
  const hidden = new Set(dismissed.filter((d) => d.date === day).map((d) => d.key));
  const items = [...providers.values()].flatMap((provide) => {
    try {
      return provide(now);
    } catch (err) {
      console.error('strip provider failed', err);
      return [];
    }
  });
  return items.filter((item) => !hidden.has(item.key)).sort((a, b) => a.rank - b.rank || (a.at ?? 0) - (b.at ?? 0))[0] ?? null;
}

/** @param {string} key */
function dismiss(key) {
  const settings = appStore.profile(PROFILE.settings);
  const day = today();
  const kept = (settings?.stripDismissed ?? []).filter((/** @type {{date: string}} */ d) => d.date === day);
  return appStore.mutate('strip.dismiss', (tx) => tx.setProfile(PROFILE.settings, { stripDismissed: [...kept, { key, date: day }] }), { quiet: true });
}

export function NextTaskStrip() {
  const [, force] = useReducer((n) => n + 1, 0);
  useStoreChanges(['alarms', 'events', 'tasks', 'reminderState', 'profile', 'medications', 'doseLogs', 'routines', 'routineRuns', 'inventoryItems']);
  useEffect(() => {
    /** @type {ReturnType<typeof setTimeout>} */
    let timer;
    const tick = () => {
      force(undefined);
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    const onVisible = () => document.visibilityState === 'visible' && force(undefined);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const settings = /** @type {Record<string, any>} */ (appStore.profile(PROFILE.settings) ?? {});
  if (settings.nextTaskStrip === false) return null;
  const item = pickStripItem(new Date(), settings.stripDismissed ?? []);
  if (!item) return null;
  return html`<div class="strip" role="status">
    <button type="button" class="strip-main" onClick=${item.open}>
      <span aria-hidden="true">${item.emoji}</span>
      <span class="strip-text">${item.text}</span>
    </button>
    <button type="button" class="icon-button strip-close" onClick=${() => dismiss(item.key)} aria-label=${t('strip.hide')}>
      ${icon('close', { size: 18 })}
    </button>
  </div>`;
}
