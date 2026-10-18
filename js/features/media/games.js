// @ts-check
// Game console window (docs/spec/rooms/entertainment.md E2): Playing · Backlog · Paused · Completed, platform chips.

import { html, useState } from '../../ui/lib.js';
import { t } from '../../core/i18n.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Segmented } from '../../ui/controls.js';
import { useCollection } from '../../ui/hooks.js';
import { toast } from '../../ui/toast.js';
import { icon } from '../../ui/icons.js';
import { PLATFORMS, randomPick } from './model.js';
import { setMediaStatus } from './actions.js';
import { MediaItemPage } from './item-page.js';
import { MediaRow, PickButton, revealRow } from './ui.js';

/** @typedef {import('./model.js').MediaItem} MediaItem */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

const session = { tab: 'playing', platform: 'all' };

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function GamesWindow({ page, nav }) {
  if (page?.id === 'item') {
    const defaults = { status: session.tab === 'dropped' ? 'backlog' : session.tab, platform: session.platform === 'all' ? 'pc' : session.platform };
    return html`<${MediaItemPage} kind="game" id=${page.params?.id ?? null} defaults=${defaults} nav=${nav} />`;
  }
  return html`<${GamesRoot} nav=${nav} />`;
}

/** @param {{ nav: Nav }} props */
function GamesRoot({ nav }) {
  const all = /** @type {MediaItem[]} */ (/** @type {unknown} */ (useCollection('media')));
  const [tab, setTab] = useState(session.tab);
  const [platform, setPlatform] = useState(session.platform);
  const [picked, setPicked] = useState(/** @type {string|null} */ (null));
  const games = all.filter((i) => i.kind === 'game' && (platform === 'all' || i.platform === platform));
  const shown = games.filter((i) => i.status === tab).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const usedPlatforms = PLATFORMS.filter((p) => all.some((i) => i.kind === 'game' && i.platform === p));
  const dropped = games.filter((i) => i.status === 'dropped').length;

  const choose = (/** @type {string} */ v) => {
    session.tab = v;
    setTab(v);
    setPicked(null);
  };
  const onPick = () => {
    const choice = randomPick(games.filter((i) => i.status === 'backlog'));
    if (!choice) return toast(t('media.nothingToPick'));
    choose('backlog');
    setPicked(choice.id);
    toast(t('media.playNext', { title: choice.title }));
    revealRow(choice.id);
  };
  /** @param {MediaItem} i */
  const actionsFor = (i) => {
    if (i.status === 'backlog') return [{ label: t('media.start'), onClick: () => setMediaStatus(i.id, 'playing') }];
    if (i.status === 'playing') return [{ label: t('media.pause'), onClick: () => setMediaStatus(i.id, 'paused') }, { label: t('media.complete'), onClick: () => setMediaStatus(i.id, 'completed') }];
    if (i.status === 'paused' || i.status === 'dropped') return [{ label: t('media.resume'), onClick: () => setMediaStatus(i.id, 'playing') }];
    return [];
  };

  return html`
    <${SheetHeader} title=${t('objects.entertainment.gameConsole.name')}>
      <${Segmented} label=${t('media.lists')} value=${tab === 'dropped' ? 'completed' : tab}
        options=${['playing', 'backlog', 'paused', 'completed'].map((v) => ({ value: v, label: t(`media.statuses.${v}`) }))} onChange=${choose} />
    <//>
    <${SheetBody}>
      ${usedPlatforms.length > 0 &&
      html`<div class="chips">
        ${['all', ...usedPlatforms].map((v) => html`<button type="button" class="chip-btn" key=${v} aria-pressed=${platform === v ? 'true' : 'false'}
          onClick=${() => { session.platform = v; setPlatform(v); }}>${v === 'all' ? t('media.all') : t(`media.platforms.${v}`)}</button>`)}
      </div>`}
      <${PickButton} label=${t('media.pickBacklog')} onPick=${onPick} />
      <div class="group">
        ${shown.map((i) => html`<${MediaRow} key=${i.id} item=${i} highlighted=${picked === i.id} actions=${actionsFor(i)}
          sub=${[i.platform ? t(`media.platforms.${i.platform}`) : '', i.notes ? i.notes.slice(0, 40) : ''].filter(Boolean).join(' · ')}
          onOpen=${() => nav.push('item', { id: i.id })} />`)}
      </div>
      ${!shown.length && html`<div class="empty"><div class="art" aria-hidden="true">🕹️</div><p>${t(`media.empty.${tab}`)}</p></div>`}
      ${dropped > 0 && tab !== 'dropped' &&
      html`<button type="button" class="link-button" onClick=${() => choose('dropped')}>${t('media.showDropped', { count: dropped })}</button>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('item', { id: null })}>${icon('plus', { size: 20 })} ${t('media.addGame')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}
