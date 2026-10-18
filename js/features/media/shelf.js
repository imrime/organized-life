// @ts-check
// Bookshelf window (docs/spec/rooms/entertainment.md E5): Books · Collections · Favourites · Achievements.

import { html, useEffect, useState } from '../../ui/lib.js';
import { t, formatDate } from '../../core/i18n.js';
import { toLocalDate } from '../../core/time.js';
import { appStore } from '../../core/store.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Segmented, TextInput, TextArea, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection } from '../../ui/hooks.js';
import { toast, undoToast } from '../../ui/toast.js';
import { confirmDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { matchesQuery } from '../../core/text.js';
import { COLORS } from '../wardrobe/catalog.js';
import { favouriteGroup } from './model.js';
import { setMediaStatus, saveCollection, deleteCollection, setCollectionItems } from './actions.js';
import { MediaItemPage, KIND_ICON } from './item-page.js';
import { MediaRow } from './ui.js';
import { ProjectPage } from '../creative/window.js';
import { ACHIEVEMENTS } from '../achievements/model.js';
import { markAchievementsSeen, snapshot as achievementData } from '../achievements/register.js';

/** @typedef {import('./model.js').MediaItem} MediaItem */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

const session = { tab: 'books', bookStatus: 'reading' };

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function ShelfWindow({ page, nav }) {
  if (page?.id === 'item') return html`<${MediaItemPage} kind=${page.params?.kind ?? 'book'} id=${page.params?.id ?? null} defaults=${{ status: session.bookStatus }} nav=${nav} />`;
  if (page?.id === 'project') return html`<${ProjectPage} id=${page.params?.id ?? null} nav=${nav} />`;
  if (page?.id === 'collection') return html`<${CollectionPage} id=${page.params?.id ?? null} nav=${nav} />`;
  if (page?.id === 'pick') return html`<${PickPage} id=${page.params?.id} nav=${nav} />`;
  if (page?.id === 'achievements') session.tab = 'achievements';
  return html`<${ShelfRoot} nav=${nav} />`;
}

/** Any collectable entry: media item or creative project. @param {string} id */
function entryOf(id) {
  const media = /** @type {any} */ (appStore.get('media', id));
  if (media) return { id, kind: media.kind, title: media.title, item: media };
  const project = /** @type {any} */ (appStore.get('creativeProjects', id));
  if (project) return { id, kind: 'project', title: project.title, item: project };
  return null;
}

/** @param {Nav} nav @param {{ id: string, kind: string }} entry */
const openEntry = (nav, entry) => (entry.kind === 'project' ? nav.push('project', { id: entry.id }) : nav.push('item', { id: entry.id, kind: entry.kind }));

/** @param {{ nav: Nav }} props */
function ShelfRoot({ nav }) {
  const [tab, setTab] = useState(session.tab);
  return html`
    <${SheetHeader} title=${t('objects.entertainment.bookshelf.name')}>
      <${Segmented} label=${t('media.lists')} value=${tab}
        options=${['books', 'collections', 'favourites', 'achievements'].map((v) => ({ value: v, label: t(`shelf.tabs.${v}`) }))}
        onChange=${(/** @type {string} */ v) => { session.tab = v; setTab(v); }} />
    <//>
    ${tab === 'books' && html`<${BooksTab} nav=${nav} />`}
    ${tab === 'collections' && html`<${CollectionsTab} nav=${nav} />`}
    ${tab === 'favourites' && html`<${FavouritesTab} nav=${nav} />`}
    ${tab === 'achievements' && html`<${AchievementsTab} nav=${nav} />`}
  `;
}

/** @param {{ nav: Nav }} props */
function BooksTab({ nav }) {
  const media = /** @type {MediaItem[]} */ (/** @type {unknown} */ (useCollection('media')));
  const [status, setStatus] = useState(session.bookStatus);
  const books = media.filter((m) => m.kind === 'book' && (status === 'read' ? ['read', 'dropped'].includes(m.status) : m.status === status)).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  /** @param {MediaItem} b */
  const actionsFor = (b) =>
    b.status === 'to_read' ? [{ label: t('shelf.startReading'), onClick: () => setMediaStatus(b.id, 'reading') }]
    : b.status === 'reading' ? [{ label: t('shelf.markRead'), onClick: () => setMediaStatus(b.id, 'read') }]
    : [];
  return html`
    <${SheetBody}>
      <${Segmented} label=${t('media.status')} value=${status} options=${['to_read', 'reading', 'read'].map((v) => ({ value: v, label: t(`media.statuses.${v}`) }))}
        onChange=${(/** @type {string} */ v) => { session.bookStatus = v; setStatus(v); }} />
      <div class="group" style="margin-top:12px">
        ${books.map((b) => html`<${MediaRow} key=${b.id} item=${b} sub=${b.status === 'dropped' ? t('media.statuses.dropped') : b.creator} actions=${actionsFor(b)} onOpen=${() => nav.push('item', { id: b.id, kind: 'book' })} />`)}
      </div>
      ${!books.length && html`<div class="empty"><div class="art" aria-hidden="true">📚</div><p>${t(`shelf.empty.${status}`)}</p></div>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('item', { id: null, kind: 'book' })}>${icon('plus', { size: 20 })} ${t('shelf.addBook')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ nav: Nav }} props */
function CollectionsTab({ nav }) {
  const collections = /** @type {any[]} */ (useCollection('mediaCollections'));
  return html`
    <${SheetBody}>
      <div class="group">
        ${collections.map((c) => html`<button type="button" class="row" key=${c.id} onClick=${() => nav.push('collection', { id: c.id })}>
          <span class="lead" aria-hidden="true" style=${`background:${COLORS[c.color] ?? COLORS.grey}`}></span>
          <span class="main"><span class="title">${c.name}</span><span class="subtitle" style="display:block">${t('shelf.itemsCount', { count: c.itemIds.length })}</span></span>
          ${icon('chevron')}
        </button>`)}
      </div>
      ${!collections.length && html`<div class="empty"><div class="art" aria-hidden="true">🗃️</div><p>${t('shelf.empty.collections')}</p></div>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('collection', { id: null })}>${icon('plus', { size: 20 })} ${t('shelf.newCollection')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

const FAV_GROUPS = ['screen', 'games', 'music', 'books', 'projects'];

/** @param {{ nav: Nav }} props */
function FavouritesTab({ nav }) {
  const media = /** @type {any[]} */ (useCollection('media'));
  const projects = /** @type {any[]} */ (useCollection('creativeProjects'));
  const favs = [...media.filter((m) => m.favorite).map((m) => ({ id: m.id, kind: m.kind, title: m.title, item: m })), ...projects.filter((p) => p.favorite).map((p) => ({ id: p.id, kind: 'project', title: p.title, item: p }))];
  return html`
    <${SheetBody}>
      ${FAV_GROUPS.map((g) => {
        const list = favs.filter((f) => favouriteGroup(f.kind) === g).sort((a, b) => a.title.localeCompare(b.title));
        return list.length > 0 && html`<section class="section" key=${g}>
          <h3 class="section-title">${t(`shelf.groups.${g}`)}</h3>
          <div class="group">${list.map((f) => html`<button type="button" class="row" key=${f.id} onClick=${() => openEntry(nav, f)}>
            <span class="lead" aria-hidden="true">${KIND_ICON[f.kind]}</span><span class="main"><span class="title">${f.title}</span></span>${icon('chevron')}</button>`)}</div>
        </section>`;
      })}
      ${!favs.length && html`<div class="empty"><div class="art" aria-hidden="true">💛</div><p>${t('shelf.empty.favourites')}</p></div>`}
    <//>
    <${SheetFooter}><span class="grow"></span><button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button><//>
  `;
}

/** @param {{ nav: Nav }} props */
function AchievementsTab({ nav }) {
  const unlocked = /** @type {any[]} */ (useCollection('achievementUnlocks'));
  // Re-render on any data change so locked hints stay current.
  useCollection('media');
  useEffect(() => {
    markAchievementsSeen();
  }, [unlocked.length]);
  const byId = new Map(unlocked.map((u) => [u.id, u]));
  const snapshot = achievementData();
  return html`
    <${SheetBody}>
      <p class="field-help">${t('achievements.count', { count: unlocked.length, total: ACHIEVEMENTS.length })}</p>
      <div class="achievement-grid">
        ${ACHIEVEMENTS.map((a) => {
          const u = byId.get(a.id);
          let hint = '';
          if (!u) {
            try {
              const [n, target] = a.progress(snapshot);
              hint = target > 1 && n > 0 ? ` · ${n}/${target}` : '';
            } catch {
              hint = '';
            }
          }
          return html`<div class=${`achievement${u ? ' on' : ''}`} key=${a.id}>
            <span class="achievement-icon" aria-hidden="true">${a.icon}</span>
            <span class="title">${t(`achievements.items.${a.id}.name`)}</span>
            <span class="subtitle">${u ? formatDate(toLocalDate(new Date(u.unlockedAt)), { day: 'numeric', month: 'short', year: 'numeric' }) : `${t(`achievements.items.${a.id}.hint`)}${hint}`}</span>
          </div>`;
        })}
      </div>
    <//>
    <${SheetFooter}><span class="grow"></span><button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button><//>
  `;
}

/** @param {{ id: string|null, nav: Nav }} props */
function CollectionPage({ id, nav }) {
  const collections = /** @type {any[]} */ (useCollection('mediaCollections'));
  useCollection('media');
  useCollection('creativeProjects');
  const existing = id ? collections.find((c) => c.id === id) : undefined;
  const [form, update, markSaved] = useForm({ name: existing?.name ?? '', description: existing?.description ?? '', color: existing?.color ?? 'purple' });
  const ids = { name: useFieldId('co-name'), desc: useFieldId('co-desc') };
  const entries = (existing?.itemIds ?? []).map(entryOf).filter(Boolean);

  const onSave = async () => {
    if (!form.name.trim()) return;
    const { result } = await saveCollection(form, id);
    markSaved();
    toast(t('common.saved'));
    if (!id) nav.push('pick', { id: /** @type {any} */ (result).id });
    else nav.pop();
  };
  const onDelete = async () => {
    if (!id) return;
    const ok = await confirmDialog({ title: t('shelf.deleteCollection', { name: existing?.name ?? '' }), message: t('shelf.deleteCollectionText'), confirmLabel: t('common.delete'), destructive: true });
    if (!ok) return;
    const { token } = await deleteCollection(id);
    markSaved();
    await nav.pop();
    undoToast(t('shelf.collectionDeleted'), token);
  };
  return html`
    <${SheetHeader} title=${id ? existing?.name ?? '' : t('shelf.newCollection')} back />
    <${SheetBody}>
      <${Field} label=${t('tasks.fields.name')} htmlFor=${ids.name}>
        <${TextInput} id=${ids.name} value=${form.name} maxLength=${60} onInput=${(/** @type {string} */ name) => update({ name })} autoFocus=${!id} />
      <//>
      <${Field} label=${t('shelf.description')} htmlFor=${ids.desc} optional>
        <${TextArea} id=${ids.desc} value=${form.description} rows=${2} onInput=${(/** @type {string} */ description) => update({ description })} />
      <//>
      <${Field} label=${t('wardrobe.color')}>
        <div class="swatches" role="radiogroup" aria-label=${t('wardrobe.color')}>
          ${Object.keys(COLORS).map((c) => html`<button type="button" key=${c} role="radio" aria-checked=${form.color === c ? 'true' : 'false'} aria-label=${t(`colors.${c}`)}
            style=${`background:${COLORS[c]}`} onClick=${() => update({ color: c })}></button>`)}
        </div>
      <//>
      ${id &&
      html`<section class="section">
        <div class="section-head"><h3 class="section-title">${t('shelf.itemsCount', { count: entries.length })}</h3>
          <button type="button" class="btn btn-small" onClick=${() => nav.push('pick', { id })}>${icon('plus', { size: 16 })} ${t('shelf.addItems')}</button></div>
        <div class="group">
          ${entries.map((e) => html`<div class="row" key=${e?.id}>
            <button type="button" class="row-hit" onClick=${() => e && openEntry(nav, e)}>
              <span class="lead" aria-hidden="true">${KIND_ICON[e?.kind ?? 'project']}</span><span class="main"><span class="title">${e?.title}</span></span>
            </button>
            <button type="button" class="icon-button" aria-label=${t('shelf.removeFrom', { title: e?.title ?? '' })}
              onClick=${() => setCollectionItems(/** @type {string} */ (id), existing.itemIds.filter((/** @type {string} */ x) => x !== e?.id))}>${icon('close', { size: 18 })}</button>
          </div>`)}
        </div>
        ${!entries.length && html`<p class="empty small">${t('shelf.collectionEmpty')}</p>`}
      </section>`}
    <//>
    <${SheetFooter}>
      ${id && html`<button type="button" class="btn btn-danger" onClick=${onDelete}>${t('common.delete')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" disabled=${!form.name.trim()} onClick=${onSave}>${id ? t('common.save') : t('shelf.createAndAdd')}</button>
    <//>
  `;
}

/** Search across all media and projects; toggles membership. @param {{ id: string, nav: Nav }} props */
function PickPage({ id, nav }) {
  const collections = /** @type {any[]} */ (useCollection('mediaCollections'));
  const media = /** @type {any[]} */ (useCollection('media'));
  const projects = /** @type {any[]} */ (useCollection('creativeProjects'));
  const collection = collections.find((c) => c.id === id);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState(/** @type {string[]} */ (collection?.itemIds ?? []));
  const all = [...media.map((m) => ({ id: m.id, kind: m.kind, title: m.title, sub: m.creator })), ...projects.map((p) => ({ id: p.id, kind: 'project', title: p.title, sub: '' }))]
    .filter((e) => matchesQuery(`${e.title} ${e.sub ?? ''}`, query))
    .sort((a, b) => a.title.localeCompare(b.title));
  const toggle = (/** @type {string} */ x) => setChosen((prev) => (prev.includes(x) ? prev.filter((y) => y !== x) : [...prev, x]));
  const onDone = async () => {
    await setCollectionItems(id, chosen);
    nav.pop();
  };
  return html`
    <${SheetHeader} title=${t('shelf.addItems')} back />
    <${SheetBody}>
      <input class="input search" type="search" value=${query} placeholder=${t('shelf.searchAll')} aria-label=${t('shelf.searchAll')}
        onInput=${(/** @type {Event} */ e) => setQuery(/** @type {HTMLInputElement} */ (e.currentTarget).value)} />
      <div class="group" style="margin-top:8px">
        ${all.map((e) => html`<div class="row check-row" key=${e.id}>
          <button type="button" class="row-hit" role="checkbox" aria-checked=${chosen.includes(e.id) ? 'true' : 'false'} onClick=${() => toggle(e.id)}>
            <span class=${`check${chosen.includes(e.id) ? ' on' : ''}`} aria-hidden="true">${chosen.includes(e.id) ? '✓' : ''}</span>
            <span class="lead" aria-hidden="true">${KIND_ICON[e.kind]}</span>
            <span class="main"><span class="title">${e.title}</span>${e.sub && html`<span class="subtitle" style="display:block">${e.sub}</span>`}</span>
          </button>
        </div>`)}
      </div>
      ${!all.length && html`<p class="empty small">${t('shelf.nothingToAdd')}</p>`}
    <//>
    <${SheetFooter}><span class="grow"></span><button type="button" class="btn btn-primary" onClick=${onDone}>${t('common.done')}</button><//>
  `;
}
