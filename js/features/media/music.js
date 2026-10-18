// @ts-check
// Music player window (docs/spec/rooms/entertainment.md E3): a tracker for playlists, albums and favourites — no audio.

import { html, useState } from '../../ui/lib.js';
import { t } from '../../core/i18n.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Segmented, TextInput, TextArea, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection } from '../../ui/hooks.js';
import { toast, undoToast } from '../../ui/toast.js';
import { choiceDialog, confirmDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { matchesQuery } from '../../core/text.js';
import { MOODS, matchesMoods, isValidLink } from './model.js';
import { savePlaylist, deletePlaylist, setNowPlaying, addTrack } from './actions.js';
import { MediaItemPage, ChipSelect } from './item-page.js';
import { MediaRow } from './ui.js';

/** @typedef {import('./model.js').MediaItem} MediaItem */
/** @typedef {import('./model.js').Playlist} Playlist */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

const session = { tab: 'playlists', moods: /** @type {string[]} */ ([]) };

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function MusicWindow({ page, nav }) {
  if (page?.id === 'item') return html`<${MediaItemPage} kind=${page.params?.kind ?? 'album'} id=${page.params?.id ?? null} nav=${nav} />`;
  if (page?.id === 'playlist') return html`<${PlaylistPage} id=${page.params?.id ?? null} nav=${nav} />`;
  return html`<${MusicRoot} nav=${nav} />`;
}

/** @param {{ nav: Nav }} props */
function MusicRoot({ nav }) {
  const media = /** @type {MediaItem[]} */ (/** @type {unknown} */ (useCollection('media')));
  const playlists = /** @type {Playlist[]} */ (/** @type {unknown} */ (useCollection('playlists')));
  const [tab, setTab] = useState(session.tab);
  const [moods, setMoods] = useState(session.moods);
  const music = media.filter((i) => i.kind === 'track' || i.kind === 'album');

  const onAdd = async () => {
    const choice = await choiceDialog({
      title: t('media.add'),
      choices: [{ value: 'track', label: t('media.kinds.track') }, { value: 'album', label: t('media.kinds.album') }, { value: 'playlist', label: t('media.playlist') }],
    });
    if (choice === 'playlist') nav.push('playlist', { id: null });
    else if (choice) nav.push('item', { id: null, kind: choice });
  };

  const lists = playlists.filter((p) => matchesMoods(p, moods)).sort((a, b) => Number(b.nowPlaying) - Number(a.nowPlaying) || a.name.localeCompare(b.name));
  const albums = music.filter((i) => i.kind === 'album' && matchesMoods(i, moods)).sort((a, b) => a.title.localeCompare(b.title));
  const favourites = music.filter((i) => i.favorite && matchesMoods(i, moods));

  return html`
    <${SheetHeader} title=${t('objects.entertainment.musicPlayer.name')}>
      <${Segmented} label=${t('media.lists')} value=${tab}
        options=${[{ value: 'playlists', label: t('media.playlists') }, { value: 'albums', label: t('media.albums') }, { value: 'favourites', label: t('media.favourites') }]}
        onChange=${(/** @type {string} */ v) => { session.tab = v; setTab(v); }} />
    <//>
    <${SheetBody}>
      <div class="chips scroll">
        <${ChipSelect} label=${t('media.moods')} value=${moods} options=${MOODS.map((m) => ({ value: m, label: t(`media.moodNames.${m}`) }))}
          onChange=${(/** @type {string[]} */ v) => { session.moods = v; setMoods(v); }} />
      </div>
      ${tab === 'playlists' &&
      html`<div class="group">
        ${lists.map((p) => html`<div class=${`row media-row${p.nowPlaying ? ' playing' : ''}`} key=${p.id}>
          <button type="button" class="row-hit" onClick=${() => nav.push('playlist', { id: p.id })}>
            <span class="lead" aria-hidden="true">${p.nowPlaying ? '🔊' : '🎶'}</span>
            <span class="main"><span class="title">${p.name}</span>
              <span class="subtitle" style="display:block">${[t('media.tracksCount', { count: p.itemIds.length }), ...p.moodTags.map((m) => t(`media.moodNames.${m}`))].join(' · ')}</span></span>
          </button>
          <button type="button" class="icon-button play-toggle" aria-pressed=${p.nowPlaying ? 'true' : 'false'} aria-label=${t(p.nowPlaying ? 'media.stop' : 'media.nowPlaying')}
            onClick=${() => setNowPlaying(p.nowPlaying ? null : { collection: 'playlists', id: p.id })}>${p.nowPlaying ? '⏸' : '▶'}</button>
        </div>`)}
      </div>
      ${!lists.length && html`<div class="empty"><div class="art" aria-hidden="true">🎧</div><p>${t('media.empty.playlists')}</p></div>`}`}
      ${tab === 'albums' &&
      html`<div class="group">${albums.map((i) => html`<${MediaRow} key=${i.id} item=${i} sub=${[i.creator, t(`media.statuses.${i.status}`)].filter(Boolean).join(' · ')} onOpen=${() => nav.push('item', { id: i.id })} />`)}</div>
      ${!albums.length && html`<div class="empty"><div class="art" aria-hidden="true">💿</div><p>${t('media.empty.albums')}</p></div>`}`}
      ${tab === 'favourites' &&
      html`<div class="group">${favourites.map((i) => html`<${MediaRow} key=${i.id} item=${i} sub=${i.creator} onOpen=${() => nav.push('item', { id: i.id })} />`)}</div>
      ${!favourites.length && html`<div class="empty"><div class="art" aria-hidden="true">💛</div><p>${t('media.empty.favourites')}</p></div>`}`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${onAdd}>${icon('plus', { size: 20 })} ${t('media.add')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ id: string|null, nav: Nav }} props */
function PlaylistPage({ id, nav }) {
  const playlists = /** @type {Playlist[]} */ (/** @type {unknown} */ (useCollection('playlists')));
  const media = /** @type {MediaItem[]} */ (/** @type {unknown} */ (useCollection('media')));
  const existing = id ? playlists.find((p) => p.id === id) : undefined;
  const [form, update, markSaved] = useForm({
    name: existing?.name ?? '',
    itemIds: existing?.itemIds ?? /** @type {string[]} */ ([]),
    moodTags: existing?.moodTags ?? /** @type {string[]} */ ([]),
    notes: existing?.notes ?? '',
    link: existing?.link ?? '',
  });
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState({ title: '', creator: '' });
  const [tried, setTried] = useState(false);
  const ids = { name: useFieldId('pl-name'), notes: useFieldId('pl-notes'), link: useFieldId('pl-link'), search: useFieldId('pl-search'), tt: useFieldId('pl-tt'), ta: useFieldId('pl-ta') };
  const tracks = form.itemIds.map((x) => media.find((m) => m.id === x)).filter(Boolean);
  const candidates = media.filter((m) => m.kind === 'track' && !form.itemIds.includes(m.id) && (!query || matchesQuery(`${m.title} ${m.creator ?? ''}`, query))).slice(0, 8);
  const linkOk = isValidLink(form.link);

  /** @param {number} i @param {number} dir */
  const move = (i, dir) => {
    const list = [...form.itemIds];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    update({ itemIds: list });
  };
  const onNewTrack = async () => {
    if (!draft.title.trim()) return;
    const { result } = await addTrack(draft);
    update({ itemIds: [...form.itemIds, /** @type {any} */ (result).id] });
    setDraft({ title: '', creator: '' });
  };
  const onSave = async () => {
    setTried(true);
    if (!form.name.trim() || !linkOk) return;
    await savePlaylist({ ...form, link: form.link.trim() || null }, id);
    markSaved();
    toast(t('common.saved'));
    nav.pop();
  };
  const onDelete = async () => {
    if (!id) return;
    const ok = await confirmDialog({ title: t('media.deletePlaylist', { name: existing?.name ?? '' }), confirmLabel: t('common.delete'), destructive: true });
    if (!ok) return;
    const { token } = await deletePlaylist(id);
    markSaved();
    await nav.pop();
    undoToast(t('media.playlistDeleted'), token);
  };

  return html`
    <${SheetHeader} title=${id ? t('media.playlist') : t('media.newPlaylist')} back />
    <${SheetBody}>
      <${Field} label=${t('tasks.fields.name')} htmlFor=${ids.name} error=${tried && !form.name.trim() ? t('form.errors.required') : undefined}>
        <${TextInput} id=${ids.name} value=${form.name} maxLength=${80} onInput=${(/** @type {string} */ name) => update({ name })} autoFocus=${!id} />
      <//>
      <${Field} label=${t('media.moods')}>
        <${ChipSelect} label=${t('media.moods')} value=${form.moodTags} options=${MOODS.map((m) => ({ value: m, label: t(`media.moodNames.${m}`) }))} onChange=${(/** @type {string[]} */ moodTags) => update({ moodTags })} />
      <//>
      <section class="section">
        <h3 class="section-title">${t('media.tracksCount', { count: tracks.length })}</h3>
        <div class="group">
          ${tracks.map((m, i) => html`<div class="row step-row" key=${m?.id}>
            <span class="main"><span class="title">${i + 1}. ${m?.title}</span>${m?.creator && html`<span class="subtitle" style="display:block">${m.creator}</span>`}</span>
            <button type="button" class="icon-button" aria-label=${t('common.moveUp')} onClick=${() => move(i, -1)} disabled=${i === 0}>↑</button>
            <button type="button" class="icon-button" aria-label=${t('common.moveDown')} onClick=${() => move(i, 1)} disabled=${i === tracks.length - 1}>↓</button>
            <button type="button" class="icon-button" aria-label=${t('common.delete')} onClick=${() => update({ itemIds: form.itemIds.filter((x) => x !== m?.id) })}>${icon('close', { size: 18 })}</button>
          </div>`)}
        </div>
      </section>
      <section class="section">
        <h3 class="section-title">${t('media.addTracks')}</h3>
        <input id=${ids.search} class="input search" type="search" value=${query} placeholder=${t('media.searchTracks')} aria-label=${t('media.searchTracks')}
          onInput=${(/** @type {Event} */ e) => setQuery(/** @type {HTMLInputElement} */ (e.currentTarget).value)} />
        ${candidates.length > 0 &&
        html`<div class="group" style="margin-top:8px">${candidates.map((m) => html`<button type="button" class="row" key=${m.id} onClick=${() => update({ itemIds: [...form.itemIds, m.id] })}>
          <span class="main"><span class="title">${m.title}</span>${m.creator && html`<span class="subtitle" style="display:block">${m.creator}</span>`}</span>${icon('plus', { size: 20 })}</button>`)}</div>`}
        <div class="two-cols" style="margin-top:8px">
          <${TextInput} id=${ids.tt} value=${draft.title} maxLength=${120} placeholder=${t('media.newTrackTitle')} onInput=${(/** @type {string} */ title) => setDraft({ ...draft, title })} />
          <${TextInput} id=${ids.ta} value=${draft.creator} maxLength=${80} placeholder=${t('media.creator.track')} onInput=${(/** @type {string} */ creator) => setDraft({ ...draft, creator })} />
        </div>
        <button type="button" class="btn" style="margin-top:8px" disabled=${!draft.title.trim()} onClick=${onNewTrack}>${icon('plus', { size: 18 })} ${t('media.newTrack')}</button>
      </section>
      <${Field} label=${t('media.link')} htmlFor=${ids.link} error=${tried && !linkOk ? t('media.errors.link') : undefined} optional>
        <${TextInput} id=${ids.link} type="url" value=${form.link} placeholder="https://" onInput=${(/** @type {string} */ link) => update({ link })} />
      <//>
      ${existing?.link && html`<p><a class="link-button" href=${existing.link} target="_blank" rel="noopener noreferrer">${t('media.openLink')} ↗</a></p>`}
      <${Field} label=${t('tasks.fields.notes')} htmlFor=${ids.notes} optional>
        <${TextArea} id=${ids.notes} value=${form.notes} onInput=${(/** @type {string} */ notes) => update({ notes })} />
      <//>
    <//>
    <${SheetFooter}>
      ${id && html`<button type="button" class="btn btn-danger" onClick=${onDelete}>${t('common.delete')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}

