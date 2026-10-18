// @ts-check
// Shared media item page (E1–E3, E5): one form whose fields depend on the kind.

import { html, useState } from '../../ui/lib.js';
import { t, formatDate } from '../../core/i18n.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Segmented, Select, Switch, TextInput, TextArea, Rating, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection } from '../../ui/hooks.js';
import { toast, undoToast } from '../../ui/toast.js';
import { confirmDialog } from '../../ui/dialog.js';
import { STATUSES, PLATFORMS, MOODS, defaultStatus, validateMedia } from './model.js';
import { saveMedia, deleteMedia } from './actions.js';

/** @typedef {import('./model.js').MediaItem} MediaItem */
/** @typedef {import('./model.js').MediaKind} MediaKind */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

export const KIND_ICON = /** @type {Record<string, string>} */ ({ film: '🎬', series: '📺', game: '🎮', track: '🎵', album: '💿', book: '📖', project: '🎨' });

/** Kind switch offered on the page (film ↔ series, track ↔ album). @param {MediaKind} kind */
const siblingKinds = (kind) => (kind === 'film' || kind === 'series' ? ['film', 'series'] : kind === 'track' || kind === 'album' ? ['track', 'album'] : [kind]);

/** Chip multi-select. @param {{ label: string, options: { value: string, label: string }[], value: string[], onChange: (v: string[]) => void }} props */
export function ChipSelect({ label, options, value, onChange }) {
  return html`<div class="chips" role="group" aria-label=${label}>
    ${options.map((o) => html`<button type="button" class="chip-btn" key=${o.value} aria-pressed=${value.includes(o.value) ? 'true' : 'false'}
      onClick=${() => onChange(value.includes(o.value) ? value.filter((x) => x !== o.value) : [...value, o.value])}>${o.label}</button>`)}
  </div>`;
}

/** Number stepper used for season/episode. @param {{ label: string, value: number, min?: number, onChange: (n: number) => void }} props */
export function NumberStepper({ label, value, min = 0, onChange }) {
  return html`<div class="stepper" role="group" aria-label=${label}>
    <button type="button" aria-label=${t('inventory.less')} onClick=${() => onChange(Math.max(min, value - 1))}>−</button>
    <span class="stepper-value">${value}</span>
    <button type="button" aria-label=${t('inventory.more')} onClick=${() => onChange(value + 1)}>+</button>
  </div>`;
}

/**
 * @param {{ kind: MediaKind, id: string|null, nav: Nav, defaults?: Record<string, any> }} props
 */
export function MediaItemPage({ kind: startKind, id, nav, defaults = {} }) {
  const items = /** @type {MediaItem[]} */ (/** @type {unknown} */ (useCollection('media')));
  const collections = /** @type {any[]} */ (useCollection('mediaCollections'));
  const existing = id ? items.find((i) => i.id === id) : undefined;
  const kind0 = /** @type {MediaKind} */ (existing?.kind ?? startKind);
  const p = existing?.progress ?? {};
  const [form, update, markSaved] = useForm({
    kind: kind0,
    title: existing?.title ?? '',
    status: existing?.status ?? defaults.status ?? defaultStatus(kind0),
    creator: existing?.creator ?? '',
    year: existing?.year ? String(existing.year) : '',
    rating: existing?.rating ?? null,
    favorite: existing?.favorite ?? false,
    notes: existing?.notes ?? '',
    link: existing?.link ?? '',
    tags: existing?.tags ?? [],
    platform: existing?.platform ?? defaults.platform ?? 'pc',
    whereToWatch: existing?.whereToWatch ?? '',
    album: existing?.album ?? '',
    season: p.season ?? 1,
    episode: p.episode ?? 0,
    page: p.page ? String(p.page) : '',
    totalPages: p.totalPages ? String(p.totalPages) : '',
    hours: p.hours ? String(p.hours) : '',
    collectionIds: collections.filter((c) => id && c.itemIds.includes(id)).map((c) => c.id),
  });
  const [tried, setTried] = useState(false);
  const kind = /** @type {MediaKind} */ (form.kind);
  const errors = validateMedia(form, new Date().getFullYear());
  const ids = { title: useFieldId('m-title'), creator: useFieldId('m-creator'), year: useFieldId('m-year'), where: useFieldId('m-where'), album: useFieldId('m-album'),
    page: useFieldId('m-page'), total: useFieldId('m-total'), hours: useFieldId('m-hours'), link: useFieldId('m-link'), notes: useFieldId('m-notes') };
  const err = (/** @type {string} */ key) => (tried && errors[key] ? t(errors[key]) : undefined);
  const num = (/** @type {string} */ v) => (v === '' ? undefined : Number(v));

  const onSave = async () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    /** @type {Record<string, any>} */
    const progress =
      kind === 'series' ? { season: form.season, episode: form.episode }
      : kind === 'book' ? { page: num(form.page), totalPages: num(form.totalPages) }
      : kind === 'game' ? { hours: num(form.hours) }
      : {};
    const fields = {
      kind,
      title: form.title,
      status: STATUSES[kind].includes(form.status) ? form.status : defaultStatus(kind),
      creator: form.creator.trim(),
      year: form.year ? Number(form.year) : null,
      rating: form.rating,
      favorite: form.favorite,
      notes: form.notes,
      link: form.link.trim() || null,
      tags: form.tags,
      platform: kind === 'game' ? form.platform : null,
      whereToWatch: kind === 'film' || kind === 'series' ? form.whereToWatch.trim() : '',
      album: kind === 'track' ? form.album.trim() : '',
      progress: Object.values(progress).some((v) => v !== undefined) ? progress : null,
    };
    await saveMedia(fields, id, form.collectionIds);
    markSaved();
    toast(t('common.saved'));
    nav.pop();
  };
  const onDelete = async () => {
    if (!id) return;
    const ok = await confirmDialog({ title: t('media.deleteTitle', { title: existing?.title ?? '' }), confirmLabel: t('common.delete'), destructive: true });
    if (!ok) return;
    const { token } = await deleteMedia(id);
    markSaved();
    await nav.pop();
    undoToast(t('media.deleted'), token);
  };

  const creatorLabel = t(`media.creator.${kind}`);
  return html`
    <${SheetHeader} title=${id ? t(`media.kinds.${kind}`) : t('media.addKind', { kind: t(`media.kinds.${kind}`).toLowerCase() })} back />
    <${SheetBody}>
      ${siblingKinds(kind0).length > 1 &&
      html`<${Field} label=${t('media.type')}>
        <${Segmented} label=${t('media.type')} value=${kind} options=${siblingKinds(kind0).map((k) => ({ value: k, label: t(`media.kinds.${k}`) }))}
          onChange=${(/** @type {MediaKind} */ k) => update({ kind: k, status: STATUSES[k].includes(form.status) ? form.status : defaultStatus(k) })} />
      <//>`}
      <${Field} label=${t('media.title')} htmlFor=${ids.title} error=${err('title')}>
        <${TextInput} id=${ids.title} value=${form.title} maxLength=${120} invalid=${Boolean(err('title'))} onInput=${(/** @type {string} */ title) => update({ title })} autoFocus=${!id} />
      <//>
      <${Field} label=${t('media.status')}>
        ${STATUSES[kind].length <= 4
          ? html`<${Segmented} label=${t('media.status')} value=${form.status} options=${STATUSES[kind].map((s) => ({ value: s, label: t(`media.statuses.${s}`) }))} onChange=${(/** @type {string} */ status) => update({ status })} />`
          : html`<${Select} label=${t('media.status')} value=${form.status} options=${STATUSES[kind].map((s) => ({ value: s, label: t(`media.statuses.${s}`) }))} onChange=${(/** @type {string} */ status) => update({ status })} />`}
      <//>
      ${kind === 'game' &&
      html`<${Field} label=${t('media.platform')}>
        <${Select} label=${t('media.platform')} value=${form.platform} options=${PLATFORMS.map((v) => ({ value: v, label: t(`media.platforms.${v}`) }))} onChange=${(/** @type {string} */ platform) => update({ platform })} />
      <//>`}
      ${kind === 'series' &&
      html`<div class="two-cols">
        <${Field} label=${t('media.season')}><${NumberStepper} label=${t('media.season')} value=${form.season} min=${1} onChange=${(/** @type {number} */ season) => update({ season })} /><//>
        <${Field} label=${t('media.episode')}><${NumberStepper} label=${t('media.episode')} value=${form.episode} onChange=${(/** @type {number} */ episode) => update({ episode })} /><//>
      </div>`}
      ${kind === 'book' &&
      html`<div class="two-cols">
        <${Field} label=${t('media.page')} htmlFor=${ids.page} optional><${TextInput} id=${ids.page} type="number" value=${form.page} onInput=${(/** @type {string} */ page) => update({ page })} /><//>
        <${Field} label=${t('media.totalPages')} htmlFor=${ids.total} optional><${TextInput} id=${ids.total} type="number" value=${form.totalPages} onInput=${(/** @type {string} */ totalPages) => update({ totalPages })} /><//>
      </div>`}
      <div class="two-cols">
        <${Field} label=${creatorLabel} htmlFor=${ids.creator} optional>
          <${TextInput} id=${ids.creator} value=${form.creator} maxLength=${80} onInput=${(/** @type {string} */ creator) => update({ creator })} />
        <//>
        <${Field} label=${t('media.year')} htmlFor=${ids.year} error=${err('year')} optional>
          <${TextInput} id=${ids.year} type="number" value=${form.year} invalid=${Boolean(err('year'))} onInput=${(/** @type {string} */ year) => update({ year })} />
        <//>
      </div>
      ${kind === 'track' &&
      html`<${Field} label=${t('media.album')} htmlFor=${ids.album} optional><${TextInput} id=${ids.album} value=${form.album} maxLength=${120} onInput=${(/** @type {string} */ album) => update({ album })} /><//>`}
      ${(kind === 'film' || kind === 'series') &&
      html`<${Field} label=${t('media.whereToWatch')} htmlFor=${ids.where} optional><${TextInput} id=${ids.where} value=${form.whereToWatch} maxLength=${60} onInput=${(/** @type {string} */ whereToWatch) => update({ whereToWatch })} /><//>`}
      ${kind === 'game' &&
      html`<${Field} label=${t('media.hours')} htmlFor=${ids.hours} optional><${TextInput} id=${ids.hours} type="number" value=${form.hours} onInput=${(/** @type {string} */ hours) => update({ hours })} /><//>`}
      ${(kind === 'track' || kind === 'album') &&
      html`<${Field} label=${t('media.moods')}>
        <${ChipSelect} label=${t('media.moods')} value=${form.tags} options=${MOODS.map((m) => ({ value: m, label: t(`media.moodNames.${m}`) }))} onChange=${(/** @type {string[]} */ tags) => update({ tags })} />
      <//>`}
      <${Field} label=${t('media.rating')}>
        <${Rating} label=${t('media.rating')} value=${form.rating} onChange=${(/** @type {number|null} */ rating) => update({ rating })} />
      <//>
      <div class="group"><div class="row"><span class="main title">${t('media.favorite')}</span>
        <${Switch} label=${t('media.favorite')} checked=${form.favorite} onChange=${(/** @type {boolean} */ favorite) => update({ favorite })} /></div></div>
      ${collections.length > 0 &&
      html`<${Field} label=${t('media.collections')}>
        <${ChipSelect} label=${t('media.collections')} value=${form.collectionIds} options=${collections.map((c) => ({ value: c.id, label: c.name }))} onChange=${(/** @type {string[]} */ collectionIds) => update({ collectionIds })} />
      <//>`}
      <${Field} label=${t('media.link')} htmlFor=${ids.link} error=${err('link')} optional>
        <${TextInput} id=${ids.link} type="url" value=${form.link} placeholder="https://" invalid=${Boolean(err('link'))} onInput=${(/** @type {string} */ link) => update({ link })} />
      <//>
      ${existing?.link && html`<p><a class="link-button" href=${existing.link} target="_blank" rel="noopener noreferrer">${t('media.openLink')} ↗</a></p>`}
      <${Field} label=${t('tasks.fields.notes')} htmlFor=${ids.notes} optional>
        <${TextArea} id=${ids.notes} value=${form.notes} onInput=${(/** @type {string} */ notes) => update({ notes })} />
      <//>
      ${existing && (existing.startedAt || existing.finishedAt) &&
      html`<p class="field-help">${[existing.startedAt ? t('media.startedOn', { date: formatDate(existing.startedAt, { day: 'numeric', month: 'short', year: 'numeric' }) }) : '', existing.finishedAt ? t('media.finishedOn', { date: formatDate(existing.finishedAt, { day: 'numeric', month: 'short', year: 'numeric' }) }) : ''].filter(Boolean).join(' · ')}</p>`}
    <//>
    <${SheetFooter}>
      ${id && html`<button type="button" class="btn btn-danger" onClick=${onDelete}>${t('common.delete')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}
