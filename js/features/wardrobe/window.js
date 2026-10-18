// @ts-check
// Wardrobe window (docs/spec/rooms/bedroom.md B4): drawings of the player's real clothes; change what the character wears.

import { html, useEffect, useState } from '../../ui/lib.js';
import { t, nameOf } from '../../core/i18n.js';
import { appStore } from '../../core/store.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Segmented, Select, TextInput, TextArea, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection, useProfile } from '../../ui/hooks.js';
import { PROFILE } from '../../core/schema.js';
import { undoToast, toast } from '../../ui/toast.js';
import { confirmDialog, choiceDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { CharacterFigure, GarmentIcon, outfitFrom } from '../../scene/character.js';
import { COLORS, TEMPLATES, SLOTS, slotOf, laundryGroupFor, defaultCare, wearInSlot } from './catalog.js';
import { saveClothing, deleteClothing, equip, markWorn, setFavorite, clearNew, saveOutfit, deleteOutfit } from './actions.js';

/** @typedef {{ id: string, name: string, seedKey?: string, slot: string, template: string, color: string, laundryGroup: string, care: string, season: string, status: string, favorite: boolean, isNew: boolean, notes?: string }} ClothingItem */
/** @typedef {{ id: string, name: string, items: Record<string, string|null>, tags: string[] }} Outfit */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

/** Preview selection survives page pushes while the window is open. */
const session = { selection: /** @type {Record<string, string|null|undefined>|null} */ (null), filter: 'all' };
const getItem = (/** @type {string} */ id) => appStore.get('clothingItems', id);

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function WardrobeWindow({ page, nav }) {
  if (page?.id === 'item') return html`<${ItemPage} id=${page.params?.id ?? null} slot=${page.params?.slot ?? 'top'} nav=${nav} />`;
  if (page?.id === 'outfit') return html`<${OutfitPage} id=${page.params?.id ?? null} nav=${nav} />`;
  return html`<${WardrobeRoot} nav=${nav} />`;
}

/** @param {{ nav: Nav }} props */
function WardrobeRoot({ nav }) {
  const items = /** @type {ClothingItem[]} */ (/** @type {unknown} */ (useCollection('clothingItems')));
  const outfits = /** @type {Outfit[]} */ (/** @type {unknown} */ (useCollection('outfits')));
  const character = useProfile(PROFILE.character);
  const [selection, setSelection] = useState(() => session.selection ?? { ...(character.equipped ?? {}) });
  const [filter, setFilter] = useState(session.filter);
  const select = (/** @type {Record<string, any>} */ next) => {
    session.selection = next;
    setSelection(next);
  };

  // Opening the wardrobe clears the "new" sparkle.
  useEffect(() => {
    clearNew(items.filter((i) => i.isNew).map((i) => i.id));
    return () => {
      session.selection = null;
    };
  }, []);

  const shown = filter === 'all' ? items : items.filter((i) => i.slot === filter);
  const sorted = [...shown].sort((a, b) => SLOTS.indexOf(/** @type {any} */ (a.slot)) - SLOTS.indexOf(/** @type {any} */ (b.slot)) || nameOf(a).localeCompare(nameOf(b)));
  const changed = JSON.stringify(normalize(selection)) !== JSON.stringify(normalize(character.equipped ?? {}));

  const toggle = (/** @type {ClothingItem} */ item) => {
    const slot = /** @type {any} */ (item.slot);
    select(wearInSlot(selection, slot, selection[slot] === item.id ? null : item.id));
  };
  const onEquip = async () => {
    const chosen = Object.values(selection).filter(Boolean).map((id) => getItem(/** @type {string} */ (id))).filter(Boolean);
    const dirty = chosen.find((i) => i.status === 'dirty');
    const washing = chosen.find((i) => i.status === 'in_load');
    if (dirty || washing) {
      const ok = await confirmDialog({ title: t(washing ? 'wardrobe.inWashTitle' : 'wardrobe.dirtyTitle', { name: nameOf(washing ?? dirty) }), confirmLabel: t('wardrobe.wearAnyway') });
      if (!ok) return;
    }
    await equip(selection);
    toast(t('wardrobe.equipped'));
  };
  const onMenu = async (/** @type {ClothingItem} */ item) => {
    const choice = await choiceDialog({
      title: nameOf(item),
      choices: [
        { value: 'edit', label: t('common.edit') },
        ...(item.status === 'clean' && item.care !== 'no_wash' ? [{ value: 'worn', label: t('wardrobe.markWorn') }] : []),
        { value: 'fav', label: t(item.favorite ? 'wardrobe.unfavorite' : 'wardrobe.favorite') },
        { value: 'delete', label: t('common.delete'), destructive: true },
      ],
    });
    if (choice === 'edit') nav.push('item', { id: item.id });
    if (choice === 'worn') {
      const { token } = await markWorn(item.id);
      undoToast(t('wardrobe.toBasket', { name: nameOf(item) }), token);
    }
    if (choice === 'fav') setFavorite(item.id, !item.favorite);
    if (choice === 'delete') {
      const { token } = await deleteClothing(item.id);
      undoToast(t('wardrobe.deleted'), token);
    }
  };

  return html`
    <${SheetHeader} title=${t('objects.bedroom.wardrobe.name')} />
    <${SheetBody}>
      <div class="preview">
        <div class="preview-figure"><${CharacterFigure} character=${character} outfit=${outfitFrom(selection, getItem)} /></div>
        <div class="preview-actions">
          <button type="button" class="btn btn-primary" disabled=${!changed} onClick=${onEquip}>${t('wardrobe.equip')}</button>
          <button type="button" class="btn" disabled=${!changed} onClick=${() => select({ ...(character.equipped ?? {}) })}>${t('wardrobe.reset')}</button>
          <button type="button" class="btn" onClick=${() => nav.push('outfit', { id: null })}>${t('wardrobe.saveOutfit')}</button>
        </div>
      </div>
      <div class="chips scroll">
        ${['all', ...SLOTS, 'outfits'].map(
          (f) => html`<button type="button" class="chip-btn" key=${f} aria-pressed=${filter === f ? 'true' : 'false'}
            onClick=${() => { session.filter = f; setFilter(f); }}>${t(`wardrobe.filters.${f}`)}</button>`,
        )}
      </div>
      ${filter === 'outfits'
        ? html`<${OutfitList} outfits=${outfits} character=${character} onLoad=${(/** @type {Outfit} */ o) => select({ ...o.items })} nav=${nav} />`
        : html`<div class="wardrobe-grid">
            ${sorted.map((item) => {
              const worn = Object.values(selection).includes(item.id);
              return html`<div class=${`garment-card${worn ? ' selected' : ''}`} key=${item.id}>
                <button type="button" class="garment-hit" aria-pressed=${worn ? 'true' : 'false'} onClick=${() => toggle(item)}>
                  <${GarmentIcon} template=${item.template} color=${item.color} slot=${item.slot} />
                  <span class="garment-name">${item.favorite ? '★ ' : ''}${nameOf(item)}</span>
                  ${item.status !== 'clean' && html`<span class=${`garment-status ${item.status}`}>${t(`wardrobe.status.${item.status}`)}</span>`}
                  ${item.isNew && html`<span class="garment-new">✨</span>`}
                </button>
                <button type="button" class="garment-menu" aria-label=${t('wardrobe.itemActions', { name: nameOf(item) })} onClick=${() => onMenu(item)}>⋯</button>
              </div>`;
            })}
          </div>
          ${!sorted.length && html`<div class="empty"><div class="art" aria-hidden="true">👕</div><p>${t('wardrobe.empty')}</p></div>`}`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('item', { id: null, slot: SLOTS.includes(/** @type {any} */ (filter)) ? filter : 'top' })}>${icon('plus', { size: 20 })} ${t('wardrobe.add')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** Drops empty slots for comparison. @param {Record<string, any>} sel */
function normalize(sel) {
  return Object.fromEntries(Object.entries(sel).filter(([, v]) => v).sort());
}

/** @param {{ outfits: Outfit[], character: Record<string, any>, onLoad: (o: Outfit) => void, nav: Nav }} props */
function OutfitList({ outfits, character, onLoad, nav }) {
  if (!outfits.length) return html`<div class="empty"><div class="art" aria-hidden="true">🧥</div><p>${t('wardrobe.noOutfits')}</p></div>`;
  return html`<div class="group">
    ${outfits.map(
      (o) => html`<div class="row outfit-row" key=${o.id}>
        <button type="button" class="row-hit" onClick=${() => onLoad(o)}>
          <span class="outfit-mini"><${CharacterFigure} character=${character} outfit=${outfitFrom(o.items, getItem)} /></span>
          <span class="main"><span class="title">${o.name}</span>
            <span class="subtitle" style="display:block">${o.tags.map((tag) => t(`wardrobe.tags.${tag}`)).join(' · ')}</span></span>
        </button>
        <button type="button" class="icon-button" aria-label=${t('common.edit')} onClick=${() => nav.push('outfit', { id: o.id })}>${icon('chevron')}</button>
      </div>`,
    )}
  </div>`;
}

const TAGS = ['work', 'casual', 'sport', 'evening', 'home'];

/** @param {{ id: string|null, nav: Nav }} props */
function OutfitPage({ id, nav }) {
  const outfits = /** @type {Outfit[]} */ (/** @type {unknown} */ (useCollection('outfits')));
  const character = useProfile(PROFILE.character);
  const existing = id ? outfits.find((o) => o.id === id) : undefined;
  const items = existing?.items ?? session.selection ?? character.equipped ?? {};
  const [form, update, markSaved] = useForm({ name: existing?.name ?? t('wardrobe.outfitN', { n: outfits.length + 1 }), tags: existing?.tags ?? [] });
  const nameId = useFieldId('o-name');

  const onSave = async () => {
    if (!form.name.trim()) return;
    // Editing an outfit can update it with the current preview.
    await saveOutfit(form, existing && session.selection ? session.selection : items, id);
    markSaved();
    toast(t('wardrobe.outfitSaved'));
    nav.pop();
  };
  const onDelete = async () => {
    if (!id) return;
    const { token } = await deleteOutfit(id);
    markSaved();
    await nav.pop();
    undoToast(t('wardrobe.outfitDeleted'), token);
  };
  return html`
    <${SheetHeader} title=${id ? t('wardrobe.editOutfit') : t('wardrobe.saveOutfit')} back />
    <${SheetBody}>
      <div class="preview small"><div class="preview-figure"><${CharacterFigure} character=${character} outfit=${outfitFrom(existing && session.selection ? session.selection : items, getItem)} /></div></div>
      <${Field} label=${t('tasks.fields.name')} htmlFor=${nameId}>
        <${TextInput} id=${nameId} value=${form.name} maxLength=${60} onInput=${(/** @type {string} */ name) => update({ name })} />
      <//>
      <${Field} label=${t('wardrobe.tagsLabel')}>
        <div class="chips">
          ${TAGS.map((tag) => html`<button type="button" class="chip-btn" key=${tag} aria-pressed=${form.tags.includes(tag) ? 'true' : 'false'}
            onClick=${() => update({ tags: form.tags.includes(tag) ? form.tags.filter((x) => x !== tag) : [...form.tags, tag] })}>${t(`wardrobe.tags.${tag}`)}</button>`)}
        </div>
      <//>
      ${existing && html`<p class="field-help">${t('wardrobe.outfitUpdateHint')}</p>`}
    <//>
    <${SheetFooter}>
      ${id && html`<button type="button" class="btn btn-danger" onClick=${onDelete}>${t('common.delete')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" disabled=${!form.name.trim()} onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}

/** @param {{ id: string|null, slot: string, nav: Nav }} props */
function ItemPage({ id, slot, nav }) {
  const items = /** @type {ClothingItem[]} */ (/** @type {unknown} */ (useCollection('clothingItems')));
  const existing = id ? items.find((i) => i.id === id) : undefined;
  const startSlot = /** @type {any} */ (existing?.slot ?? slot);
  const startTemplate = existing?.template ?? TEMPLATES[/** @type {keyof typeof TEMPLATES} */ (startSlot)][0];
  const [form, update, markSaved] = useForm({
    name: existing ? nameOf(existing) : '',
    slot: startSlot,
    template: startTemplate,
    color: existing?.color ?? 'blue',
    laundryGroup: existing?.laundryGroup ?? laundryGroupFor('blue'),
    care: existing?.care ?? defaultCare(startSlot),
    season: existing?.season ?? 'all',
    notes: existing?.notes ?? '',
  });
  const ids = { name: useFieldId('c-name'), care: useFieldId('c-care'), notes: useFieldId('c-notes') };
  const autoName = `${t(`colors.${form.color}`)} ${t(`wardrobe.templates.${form.template}`).toLowerCase()}`;

  const onSave = async () => {
    const keepSeed = existing?.seedKey && form.name.trim() === nameOf(existing);
    await saveClothing({ ...form, name: keepSeed ? '' : form.name.trim() || autoName }, id);
    markSaved();
    toast(t('common.saved'));
    nav.pop();
  };
  return html`
    <${SheetHeader} title=${id ? t('wardrobe.editItem') : t('wardrobe.add')} back />
    <${SheetBody}>
      <div class="garment-preview"><${GarmentIcon} template=${form.template} color=${form.color} slot=${form.slot} /></div>
      <${Field} label=${t('wardrobe.category')}>
        <${Select} value=${form.slot} label=${t('wardrobe.category')} options=${SLOTS.map((s) => ({ value: s, label: t(`wardrobe.filters.${s}`) }))}
          onChange=${(/** @type {any} */ s) => update({ slot: s, template: TEMPLATES[/** @type {keyof typeof TEMPLATES} */ (s)][0], care: defaultCare(s) })} />
      <//>
      <${Field} label=${t('wardrobe.template')}>
        <div class="template-grid" role="radiogroup" aria-label=${t('wardrobe.template')}>
          ${TEMPLATES[/** @type {keyof typeof TEMPLATES} */ (form.slot)].map(
            (tpl) => html`<button type="button" key=${tpl} role="radio" aria-checked=${form.template === tpl ? 'true' : 'false'} onClick=${() => update({ template: tpl, slot: slotOf(tpl) })}>
              <${GarmentIcon} template=${tpl} color=${form.color} slot=${form.slot} /><span>${t(`wardrobe.templates.${tpl}`)}</span>
            </button>`,
          )}
        </div>
      <//>
      <${Field} label=${t('wardrobe.color')}>
        <div class="swatches" role="radiogroup" aria-label=${t('wardrobe.color')}>
          ${Object.keys(COLORS).map((c) => html`<button type="button" key=${c} role="radio" aria-checked=${form.color === c ? 'true' : 'false'} aria-label=${t(`colors.${c}`)}
            style=${`background:${COLORS[c]}`} onClick=${() => update({ color: c, laundryGroup: laundryGroupFor(c) })}></button>`)}
        </div>
      <//>
      <${Field} label=${t('tasks.fields.name')} htmlFor=${ids.name} optional>
        <${TextInput} id=${ids.name} value=${form.name} maxLength=${60} placeholder=${autoName} onInput=${(/** @type {string} */ name) => update({ name })} />
      <//>
      <${Field} label=${t('wardrobe.laundryGroup')}>
        <${Segmented} label=${t('wardrobe.laundryGroup')} value=${form.laundryGroup}
          options=${['whites', 'lights', 'darks', 'colours'].map((g) => ({ value: g, label: t(`wardrobe.groups.${g}`) }))} onChange=${(/** @type {string} */ laundryGroup) => update({ laundryGroup })} />
      <//>
      <div class="two-cols">
        <${Field} label=${t('wardrobe.care')} htmlFor=${ids.care}>
          <${Select} id=${ids.care} value=${form.care} options=${['normal', 'delicate', 'wool', 'hand_wash', 'no_wash'].map((c) => ({ value: c, label: t(`wardrobe.cares.${c}`) }))} onChange=${(/** @type {string} */ care) => update({ care })} />
        <//>
        <${Field} label=${t('wardrobe.season')}>
          <${Select} value=${form.season} label=${t('wardrobe.season')} options=${['all', 'summer', 'mid', 'winter'].map((s) => ({ value: s, label: t(`wardrobe.seasons.${s}`) }))} onChange=${(/** @type {string} */ season) => update({ season })} />
        <//>
      </div>
      <${Field} label=${t('tasks.fields.notes')} htmlFor=${ids.notes} optional>
        <${TextArea} id=${ids.notes} value=${form.notes} onInput=${(/** @type {string} */ notes) => update({ notes })} />
      <//>
    <//>
    <${SheetFooter}>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}
