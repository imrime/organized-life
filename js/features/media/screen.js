// @ts-check
// Television window (docs/spec/rooms/entertainment.md E1): films and series by Watchlist · Watching · Watched.

import { html, useState } from '../../ui/lib.js';
import { t } from '../../core/i18n.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Segmented } from '../../ui/controls.js';
import { useCollection } from '../../ui/hooks.js';
import { toast } from '../../ui/toast.js';
import { icon } from '../../ui/icons.js';
import { randomPick } from './model.js';
import { setMediaStatus, addEpisode } from './actions.js';
import { MediaItemPage } from './item-page.js';
import { MediaRow, PickButton, revealRow } from './ui.js';

/** @typedef {import('./model.js').MediaItem} MediaItem */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

const session = { tab: 'watchlist', type: 'all', fav: false };

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function ScreenWindow({ page, nav }) {
  if (page?.id === 'item') return html`<${MediaItemPage} kind=${page.params?.kind ?? 'film'} id=${page.params?.id ?? null} defaults=${{ status: session.tab }} nav=${nav} />`;
  return html`<${ScreenRoot} nav=${nav} />`;
}

/** @param {{ nav: Nav }} props */
function ScreenRoot({ nav }) {
  const all = /** @type {MediaItem[]} */ (/** @type {unknown} */ (useCollection('media')));
  const [tab, setTab] = useState(session.tab);
  const [type, setType] = useState(session.type);
  const [fav, setFav] = useState(session.fav);
  const [picked, setPicked] = useState(/** @type {string|null} */ (null));
  const screen = all.filter((i) => (i.kind === 'film' || i.kind === 'series') && (type === 'all' || i.kind === type) && (!fav || i.favorite));
  const statuses = tab === 'watched' ? ['watched', 'dropped'] : [tab];
  const shown = screen.filter((i) => statuses.includes(i.status)).sort((a, b) => (tab === 'watchlist' ? a.title.localeCompare(b.title) : String(b.updatedAt).localeCompare(String(a.updatedAt))));

  const onPick = () => {
    const choice = randomPick(screen.filter((i) => i.status === 'watchlist'));
    if (!choice) return toast(t('media.nothingToPick'));
    session.tab = 'watchlist';
    setTab('watchlist');
    setPicked(choice.id);
    toast(t('media.tonight', { title: choice.title }));
    revealRow(choice.id);
  };

  /** @param {MediaItem} i */
  const actionsFor = (i) => {
    if (i.status === 'watchlist') return [{ label: t('media.startWatching'), onClick: () => setMediaStatus(i.id, 'watching') }, { label: t('media.markWatched'), onClick: () => setMediaStatus(i.id, 'watched') }];
    if (i.status === 'watching' && i.kind === 'series') return [{ label: t('media.plusEpisode'), onClick: () => addEpisode(i.id) }, { label: t('media.markWatched'), onClick: () => setMediaStatus(i.id, 'watched') }];
    if (i.status === 'watching') return [{ label: t('media.markWatched'), onClick: () => setMediaStatus(i.id, 'watched') }];
    return [];
  };

  return html`
    <${SheetHeader} title=${t('objects.entertainment.television.name')}>
      <${Segmented} label=${t('media.lists')} value=${tab}
        options=${['watchlist', 'watching', 'watched'].map((v) => ({ value: v, label: t(`media.statuses.${v}`) }))}
        onChange=${(/** @type {string} */ v) => { session.tab = v; setTab(v); setPicked(null); }} />
    <//>
    <${SheetBody}>
      <div class="chips">
        ${['all', 'film', 'series'].map((v) => html`<button type="button" class="chip-btn" key=${v} aria-pressed=${type === v ? 'true' : 'false'}
          onClick=${() => { session.type = v; setType(v); }}>${v === 'all' ? t('media.all') : t(`media.kindsPlural.${v}`)}</button>`)}
        <button type="button" class="chip-btn" aria-pressed=${fav ? 'true' : 'false'} onClick=${() => { session.fav = !fav; setFav(!fav); }}>★</button>
      </div>
      <${PickButton} label=${t('media.whatToWatch')} onPick=${onPick} />
      <div class="group">
        ${shown.map((i) => html`<${MediaRow} key=${i.id} item=${i} highlighted=${picked === i.id} actions=${actionsFor(i)}
          sub=${i.status === 'dropped' ? t('media.statuses.dropped') : i.whereToWatch} onOpen=${() => nav.push('item', { id: i.id })} />`)}
      </div>
      ${!shown.length && html`<div class="empty"><div class="art" aria-hidden="true">🍿</div><p>${t(`media.empty.${tab}`)}</p></div>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('item', { id: null, kind: type === 'series' ? 'series' : 'film' })}>${icon('plus', { size: 20 })} ${t('media.add')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}
