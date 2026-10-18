// @ts-check
// Laundry basket window (docs/spec/rooms/bathroom.md BA5): dirty clothes and extras, grouped; add a selection to a load.

import { html, useState } from '../../ui/lib.js';
import { t, nameOf } from '../../core/i18n.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Segmented, TextInput, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection } from '../../ui/hooks.js';
import { toast, undoToast } from '../../ui/toast.js';
import { choiceDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { openObject } from '../../ui/navigation.js';
import { GarmentIcon } from '../../scene/character.js';
import { SLOTS } from '../wardrobe/catalog.js';
import { GROUPS, EXTRA_KINDS, basketSections, mixWarnings, queuedLoads } from './model.js';
import { addExtra, deleteExtra, markDirty, addToLoad } from './actions.js';

/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */
/**
 * @typedef {{ key: string, id: string, kind: 'item'|'extra', name: string, laundryGroup: any, slot?: string, care?: string, color?: string, template?: string }} Entry
 */

const session = { by: /** @type {'colour'|'type'} */ ('colour') };
const CARE_ICON = /** @type {Record<string, string>} */ ({ delicate: '🪶', wool: '🧶', hand_wash: '🖐️' });
const GROUP_SWATCH = /** @type {Record<string, string>} */ ({ whites: '#F4F1EC', lights: '#D8C3A0', darks: '#2E2B2A', colours: '#4A78B5' });

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function BasketWindow({ page, nav }) {
  if (page?.id === 'pick') return html`<${PickPage} nav=${nav} />`;
  if (page?.id === 'extra') return html`<${ExtraPage} nav=${nav} />`;
  return html`<${BasketRoot} nav=${nav} />`;
}

/** @returns {Entry[]} */
function useEntries() {
  const clothes = /** @type {any[]} */ (useCollection('clothingItems'));
  const extras = /** @type {any[]} */ (useCollection('laundryExtras'));
  return [
    ...clothes.filter((c) => c.status === 'dirty').map((c) => ({ key: `i:${c.id}`, id: c.id, kind: /** @type {const} */ ('item'), name: nameOf(c), laundryGroup: c.laundryGroup, slot: c.slot, care: c.care, color: c.color, template: c.template })),
    ...extras.filter((e) => e.status === 'dirty').map((e) => ({ key: `e:${e.id}`, id: e.id, kind: /** @type {const} */ ('extra'), name: nameOf(e), laundryGroup: e.laundryGroup })),
  ];
}

/** @param {{ nav: Nav }} props */
function BasketRoot({ nav }) {
  const entries = useEntries();
  const loads = /** @type {any[]} */ (useCollection('laundryLoads'));
  const [by, setBy] = useState(session.by);
  const [picked, setPicked] = useState(/** @type {Set<string>} */ (new Set()));
  const selected = entries.filter((e) => picked.has(e.key));
  const warnings = mixWarnings(selected);
  const sections = basketSections(entries, by, SLOTS);

  /** @param {string[]} keys @param {boolean} on */
  const setKeys = (keys, on) =>
    setPicked((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
      return next;
    });

  const onAddToLoad = async () => {
    const queue = queuedLoads(loads);
    let loadId = null;
    if (queue.length) {
      const choice = await choiceDialog({
        title: t('laundry.addToLoad'),
        choices: [
          { value: 'new', label: t('laundry.newLoad') },
          ...queue.map((l) => ({ value: l.id, label: t('laundry.existingLoad', { type: t(`laundry.loadTypes.${l.loadType}`), count: l.itemIds.length + l.extraIds.length }) })),
        ],
      });
      if (!choice) return;
      loadId = choice === 'new' ? null : choice;
    }
    const { result } = await addToLoad({
      itemIds: selected.filter((e) => e.kind === 'item').map((e) => e.id),
      extraIds: selected.filter((e) => e.kind === 'extra').map((e) => e.id),
      loadId,
    });
    setPicked(new Set());
    toast(t('laundry.addedToLoad', { count: selected.length, type: t(`laundry.loadTypes.${result.loadType}`) }), {
      actionLabel: t('laundry.openMachine'),
      onAction: () => openObject('bathroom.washing-machine'),
    });
  };

  const onExtra = async (/** @type {string} */ kind) => {
    if (kind === 'other') return nav.push('extra');
    const { token } = await addExtra({ kind });
    undoToast(t('laundry.extraAdded', { name: t(`laundry.extras.${kind}`) }), token);
  };

  return html`
    <${SheetHeader} title=${t('objects.bathroom.laundryBasket.name')}>
      ${entries.length > 0 &&
      html`<${Segmented} label=${t('laundry.groupBy')} value=${by}
        options=${[{ value: 'colour', label: t('laundry.byColour') }, { value: 'type', label: t('laundry.byType') }]}
        onChange=${(/** @type {any} */ v) => { session.by = v; setBy(v); }} />`}
    <//>
    <${SheetBody}>
      ${sections.map(
        (s) => {
          const keys = s.items.map((e) => e.key);
          const all = keys.every((k) => picked.has(k));
          return html`<section class="section" key=${s.key}>
            <div class="section-head">
              <h3 class="section-title">${by === 'colour' ? t(`wardrobe.groups.${s.key}`) : s.key === 'other' ? t('laundry.otherLaundry') : t(`wardrobe.filters.${s.key}`)} (${s.items.length})</h3>
              <button type="button" class="btn btn-small" onClick=${() => setKeys(keys, !all)}>${all ? t('laundry.selectNone') : t('laundry.selectAll')}</button>
            </div>
            <div class="group">
              ${s.items.map((e) => html`<div class="row check-row laundry-row" key=${e.key}>
                <button type="button" class="row-hit" role="checkbox" aria-checked=${picked.has(e.key) ? 'true' : 'false'} onClick=${() => setKeys([e.key], !picked.has(e.key))}>
                  <span class=${`check${picked.has(e.key) ? ' on' : ''}`} aria-hidden="true">${picked.has(e.key) ? '✓' : ''}</span>
                  ${e.kind === 'item'
                    ? html`<span class="laundry-icon"><${GarmentIcon} template=${e.template} color=${e.color} slot=${e.slot} /></span>`
                    : html`<span class="swatch-dot" style=${`background:${GROUP_SWATCH[e.laundryGroup]}`} aria-hidden="true"></span>`}
                  <span class="main"><span class="title">${e.name}</span>
                    ${e.care && CARE_ICON[e.care] && html`<span class="subtitle" style="display:block">${CARE_ICON[e.care]} ${t(`wardrobe.cares.${e.care}`)}</span>`}</span>
                </button>
                ${e.kind === 'extra' &&
                html`<button type="button" class="icon-button" aria-label=${t('common.delete')} onClick=${async () => { const { token } = await deleteExtra(e.id); undoToast(t('laundry.extraRemoved'), token); }}>${icon('close', { size: 18 })}</button>`}
              </div>`)}
            </div>
          </section>`;
        },
      )}
      ${!entries.length && html`<div class="empty"><div class="art" aria-hidden="true">🧺</div><p>${t('laundry.basketEmpty')}</p></div>`}
      ${warnings.map((w) => html`<p class="banner warn small" key=${w}>${t(`laundry.warnings.${w}`)}</p>`)}
      <section class="section">
        <h3 class="section-title">${t('laundry.addOther')}</h3>
        <div class="chips">
          ${[...EXTRA_KINDS, 'other'].map((k) => html`<button type="button" class="chip-btn" key=${k} onClick=${() => onExtra(k)}>+ ${k === 'other' ? t('laundry.otherEllipsis') : t(`laundry.extras.${k}`)}</button>`)}
        </div>
        <button type="button" class="btn" style="margin-top:12px" onClick=${() => nav.push('pick')}>${icon('plus', { size: 18 })} ${t('laundry.fromWardrobe')}</button>
      </section>
    <//>
    <${SheetFooter}>
      ${selected.length
        ? html`<span class="footer-note">${t('laundry.selected', { count: selected.length })}</span>
            <span class="grow"></span>
            <button type="button" class="btn btn-primary" onClick=${onAddToLoad}>${t('laundry.addToLoad')}</button>`
        : html`<button type="button" class="btn" onClick=${() => openObject('bathroom.washing-machine')}>🫧 ${t('laundry.openMachine')}</button>
            <span class="grow"></span>
            <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>`}
    <//>
  `;
}

/** Multi-select clean wardrobe items to put in the basket. @param {{ nav: Nav }} props */
function PickPage({ nav }) {
  const clothes = /** @type {any[]} */ (useCollection('clothingItems'));
  const clean = clothes.filter((c) => c.status === 'clean' && c.care !== 'no_wash').sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || nameOf(a).localeCompare(nameOf(b)));
  const [picked, setPicked] = useState(/** @type {Set<string>} */ (new Set()));
  const toggle = (/** @type {string} */ id) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const onAdd = async () => {
    const { token } = await markDirty([...picked]);
    await nav.pop();
    undoToast(t('laundry.toBasket', { count: picked.size }), token);
  };
  return html`
    <${SheetHeader} title=${t('laundry.fromWardrobe')} back />
    <${SheetBody}>
      <div class="wardrobe-grid">
        ${clean.map((c) => html`<div class=${`garment-card${picked.has(c.id) ? ' selected' : ''}`} key=${c.id}>
          <button type="button" class="garment-hit" aria-pressed=${picked.has(c.id) ? 'true' : 'false'} onClick=${() => toggle(c.id)}>
            <${GarmentIcon} template=${c.template} color=${c.color} slot=${c.slot} />
            <span class="garment-name">${nameOf(c)}</span>
          </button>
        </div>`)}
      </div>
      ${!clean.length && html`<div class="empty"><div class="art" aria-hidden="true">👕</div><p>${t('laundry.nothingClean')}</p></div>`}
    <//>
    <${SheetFooter}>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" disabled=${!picked.size} onClick=${onAdd}>${t('laundry.putInBasket', { count: picked.size })}</button>
    <//>
  `;
}

/** "Other…" laundry: free label and colour group. @param {{ nav: Nav }} props */
function ExtraPage({ nav }) {
  const [form, update, markSaved] = useForm({ label: '', laundryGroup: 'colours' });
  const labelId = useFieldId('x-label');
  const onSave = async () => {
    if (!form.label.trim()) return;
    await addExtra({ kind: 'other', label: form.label, laundryGroup: /** @type {any} */ (form.laundryGroup) });
    markSaved();
    toast(t('laundry.extraAdded', { name: form.label.trim() }));
    nav.pop();
  };
  return html`
    <${SheetHeader} title=${t('laundry.otherLaundry')} back />
    <${SheetBody}>
      <${Field} label=${t('tasks.fields.name')} htmlFor=${labelId}>
        <${TextInput} id=${labelId} value=${form.label} maxLength=${60} placeholder=${t('laundry.otherPlaceholder')} onInput=${(/** @type {string} */ label) => update({ label })} autoFocus />
      <//>
      <${Field} label=${t('wardrobe.laundryGroup')}>
        <${Segmented} label=${t('wardrobe.laundryGroup')} value=${form.laundryGroup}
          options=${GROUPS.map((g) => ({ value: g, label: t(`wardrobe.groups.${g}`) }))} onChange=${(/** @type {string} */ laundryGroup) => update({ laundryGroup })} />
      <//>
    <//>
    <${SheetFooter}>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" disabled=${!form.label.trim()} onClick=${onSave}>${t('laundry.addToBasket')}</button>
    <//>
  `;
}

