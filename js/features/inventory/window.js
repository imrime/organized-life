// @ts-check
// Inventory windows (docs/spec/rooms/kitchen.md K1, K5; bathroom BA2): fridge/freezer, pantry, bathroom cabinet.

import { html, useState } from '../../ui/lib.js';
import { t, formatDate } from '../../core/i18n.js';
import { today, addDays, addMonths } from '../../core/time.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Segmented, Select, TextInput, TextArea, DateTimeInput, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection } from '../../ui/hooks.js';
import { undoToast, toast } from '../../ui/toast.js';
import { choiceDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { FOOD_CATEGORIES, PANTRY_CATEGORIES, BATH_CATEGORIES } from '../products/catalog.js';
import { ProductInput, UnitSelect, qtyText } from '../products/ui.js';
import { sortItems, expiryState, daysToExpiry, stockLevel, isLow, stepFor, roundQty, suggestedExpiry, effectiveExpiry } from './model.js';
import { saveInventoryItem, setQuantity, moveItem, deleteInventoryItem, addLowToShopping } from './actions.js';

/** @typedef {import('./model.js').InventoryItem} InventoryItem */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */
/** @typedef {'fridge'|'pantry'|'bathroom'} Scope */

const TITLES = { fridge: 'objects.kitchen.refrigerator.name', pantry: 'objects.kitchen.cabinets.name', bathroom: 'objects.bathroom.cabinet.name' };
const session = { fridgeTab: /** @type {'fridge'|'freezer'} */ ('fridge'), sort: /** @type {'expiry'|'name'|'category'} */ ('expiry'), pantryGroup: /** @type {'spot'|'category'} */ ('spot'), bathCategory: 'all' };

/** @param {Scope} scope */
const categoriesFor = (scope) => (scope === 'bathroom' ? BATH_CATEGORIES : scope === 'pantry' ? PANTRY_CATEGORIES : FOOD_CATEGORIES);

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav, props: { scope: Scope } }} args */
export default function InventoryWindow({ page, nav, props }) {
  const scope = props.scope ?? 'fridge';
  if (page?.id === 'item') return html`<${ItemPage} id=${page.params?.id ?? null} scope=${scope} nav=${nav} />`;
  if (page?.id === 'used') return html`<${UsedPage} id=${page.params?.id} nav=${nav} />`;
  return html`<${InventoryRoot} scope=${scope} nav=${nav} />`;
}

/** @param {InventoryItem} item */
function ExpiryChip({ item }) {
  const state = expiryState(item, today());
  if (state === 'none') return null;
  const days = daysToExpiry(item, today()) ?? 0;
  const text = state === 'expired' ? t('inventory.expired') : state === 'today' ? t('calendar.today') : state === 'tomorrow' ? t('calendar.tomorrow') : t('inventory.inDays', { count: days });
  return html`<span class=${`exp-chip ${state}`}>${text}</span>`;
}

/** @param {{ item: InventoryItem, nav: Nav, showStock?: boolean }} props */
function ItemRow({ item, nav, showStock = false }) {
  const level = stockLevel(item);
  const step = stepFor(item.unit);
  const menu = async () => {
    const other = item.location === 'fridge' ? 'freezer' : item.location === 'freezer' ? 'fridge' : null;
    const choice = await choiceDialog({
      title: item.name,
      choices: [
        { value: 'used', label: t('inventory.markUsed') },
        { value: 'edit', label: t('common.edit') },
        ...(other ? [{ value: 'move', label: t(`inventory.moveTo.${other}`) }] : []),
        { value: 'delete', label: t('common.delete'), destructive: true },
      ],
    });
    if (choice === 'used') nav.push('used', { id: item.id });
    if (choice === 'edit') nav.push('item', { id: item.id });
    if (choice === 'move' && other) moveItem(item.id, other);
    if (choice === 'delete') {
      const { token } = await deleteInventoryItem(item.id);
      undoToast(t('inventory.deleted', { name: item.name }), token);
    }
  };
  return html`<div class="row inv-row">
    <button type="button" class="row-hit" onClick=${menu} aria-label=${t('inventory.actionsFor', { name: item.name })}>
      <span class="main">
        <span class="title">${item.name}</span>
        <span class="subtitle meta-line">
          <${ExpiryChip} item=${item} />
          ${showStock && level && html`<span class=${`stock-pill ${level}`}>${t(`inventory.levels.${level}`)}</span>`}
          ${item.spot && html`<span>${item.spot}</span>`}
        </span>
      </span>
    </button>
    <div class="stepper" role="group" aria-label=${t('inventory.quantityOf', { name: item.name })}>
      <button type="button" aria-label=${t('inventory.less')} onClick=${() => setQuantity(item.id, roundQty(item.quantity - step))}>−</button>
      <span class="stepper-value">${qtyText(item.quantity, item.unit)}</span>
      <button type="button" aria-label=${t('inventory.more')} onClick=${() => setQuantity(item.id, roundQty(item.quantity + step))}>+</button>
    </div>
  </div>`;
}

/** @param {{ scope: Scope, nav: Nav }} props */
function InventoryRoot({ scope, nav }) {
  const all = /** @type {InventoryItem[]} */ (/** @type {unknown} */ (useCollection('inventoryItems')));
  const [fridgeTab, setFridgeTab] = useState(session.fridgeTab);
  const [sort, setSort] = useState(session.sort);
  const [group, setGroup] = useState(session.pantryGroup);
  const [bathCat, setBathCat] = useState(session.bathCategory);
  const day = today();
  const location = scope === 'fridge' ? fridgeTab : scope;
  const items = all.filter((i) => i.location === location);
  const low = items.filter(isLow);

  /** @type {{ key: string, title: string, items: InventoryItem[] }[]} */
  let sections;
  if (scope === 'fridge') {
    const sorted = sortItems(items, sort, day);
    const soon = sorted.filter((i) => ['expired', 'today', 'tomorrow', 'soon'].includes(expiryState(i, day)));
    sections = [
      { key: 'soon', title: t('inventory.expiringSoon'), items: soon },
      { key: 'rest', title: soon.length ? t('inventory.everythingElse') : '', items: sorted.filter((i) => !soon.includes(i)) },
    ];
  } else if (scope === 'pantry') {
    const keyOf = (/** @type {InventoryItem} */ i) => (group === 'spot' ? i.spot || '' : i.category);
    const keys = [...new Set(items.map(keyOf))].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
    sections = keys.map((k) => ({
      key: k || '-',
      title: group === 'spot' ? k || t('inventory.noPlace') : t(`inventory.categories.${k}`),
      items: sortItems(items.filter((i) => keyOf(i) === k), 'name', day),
    }));
  } else {
    const shown = bathCat === 'all' ? items : items.filter((i) => i.category === bathCat);
    sections = [{ key: 'all', title: '', items: sortItems(shown, 'expiry', day) }];
  }
  sections = sections.filter((s) => s.items.length);

  return html`
    <${SheetHeader} title=${t(TITLES[scope])}>
      ${scope === 'fridge' &&
      html`<${Segmented} label=${t('inventory.place')} value=${fridgeTab}
        options=${[{ value: 'fridge', label: t('inventory.places.fridge') }, { value: 'freezer', label: t('inventory.places.freezer') }]}
        onChange=${(/** @type {any} */ v) => { session.fridgeTab = v; setFridgeTab(v); }} />`}
    <//>
    <${SheetBody}>
      ${low.length > 0 &&
      html`<div class="banner warn">
        <span>${t('inventory.lowBanner', { count: low.length })}</span>
        <button type="button" class="btn btn-small" onClick=${async () => { const { token } = await addLowToShopping(low); undoToast(t('inventory.addedToList', { count: low.length }), token); }}>
          ${t('inventory.addToList')}
        </button>
      </div>`}
      ${scope === 'fridge' && items.length > 1 &&
      html`<div class="inline toolbar"><span class="field-help">${t('inventory.sortBy')}</span>
        <${Select} value=${sort} label=${t('inventory.sortBy')} options=${['expiry', 'name', 'category'].map((v) => ({ value: v, label: t(`inventory.sorts.${v}`) }))}
          onChange=${(/** @type {any} */ v) => { session.sort = v; setSort(v); }} /></div>`}
      ${scope === 'pantry' && items.length > 0 &&
      html`<${Segmented} label=${t('inventory.groupBy')} value=${group}
        options=${[{ value: 'spot', label: t('inventory.byPlace') }, { value: 'category', label: t('inventory.byCategory') }]}
        onChange=${(/** @type {any} */ v) => { session.pantryGroup = v; setGroup(v); }} />`}
      ${scope === 'bathroom' && items.length > 0 &&
      html`<div class="chips scroll">${['all', ...BATH_CATEGORIES].map((c) => html`<button type="button" class="chip-btn" key=${c} aria-pressed=${bathCat === c ? 'true' : 'false'}
        onClick=${() => { session.bathCategory = c; setBathCat(c); }}>${c === 'all' ? t('tasks.filters.all') : t(`inventory.categories.${c}`)}</button>`)}</div>`}
      ${sections.map(
        (s) => html`<section class="section" key=${s.key}>
          ${s.title && html`<h3 class="section-title">${s.title}</h3>`}
          <div class="group">${s.items.map((item) => html`<${ItemRow} key=${item.id} item=${item} nav=${nav} showStock=${scope !== 'fridge'} />`)}</div>
        </section>`,
      )}
      ${!items.length && html`<div class="empty"><div class="art" aria-hidden="true">${scope === 'bathroom' ? '🧴' : scope === 'pantry' ? '🥫' : fridgeTab === 'freezer' ? '🧊' : '🥛'}</div><p>${t(`inventory.empty.${location}`)}</p></div>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('item', { id: null })}>${icon('plus', { size: 20 })} ${t('inventory.add')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ id: string|null, scope: Scope, nav: Nav }} props */
function ItemPage({ id, scope, nav }) {
  const all = /** @type {InventoryItem[]} */ (/** @type {unknown} */ (useCollection('inventoryItems')));
  const existing = id ? all.find((i) => i.id === id) : undefined;
  const defaultLocation = scope === 'fridge' ? session.fridgeTab : scope;
  const cats = categoriesFor(scope);
  const [form, update, markSaved] = useForm({
    name: existing?.name ?? '',
    quantity: existing?.quantity ?? 1,
    unit: existing?.unit ?? 'pcs',
    location: existing?.location ?? defaultLocation,
    category: existing?.category ?? (scope === 'fridge' ? (defaultLocation === 'freezer' ? 'frozen' : 'dairy') : cats[0]),
    expiryDate: existing?.expiryDate ?? '',
    openedAt: existing?.openedAt ?? '',
    useWithinMonths: existing?.useWithinMonths ?? '',
    lowStockAt: existing?.lowStockAt ?? (scope === 'fridge' ? '' : 1),
    spot: existing?.spot ?? '',
    notes: existing?.notes ?? '',
  });
  const [error, setError] = useState('');
  const ids = { name: useFieldId('i-name'), qty: useFieldId('i-qty'), unit: useFieldId('i-unit'), cat: useFieldId('i-cat'), exp: useFieldId('i-exp'), open: useFieldId('i-open'), pao: useFieldId('i-pao'), low: useFieldId('i-low'), spot: useFieldId('i-spot'), notes: useFieldId('i-notes') };
  const spots = [...new Set(all.filter((i) => i.location === 'pantry' && i.spot).map((i) => i.spot))];

  const pick = (/** @type {any} */ product) => {
    if (existing) return;
    update({
      unit: product.defaultUnit,
      quantity: product.defaultQty,
      category: cats.includes(product.category) ? product.category : form.category,
      ...(scope === 'fridge' && ['fridge', 'freezer'].includes(product.defaultLocation) ? { location: product.defaultLocation } : {}),
      expiryDate: suggestedExpiry(today(), product.shelfLifeDays) ?? '',
    });
  };
  const onSave = async () => {
    if (!form.name.trim()) return setError(t('form.errors.required'));
    if (!(Number(form.quantity) > 0)) return setError(t('inventory.errors.quantity'));
    const { result } = await saveInventoryItem(form, id);
    markSaved();
    toast(result.merged ? t('inventory.merged', { name: form.name.trim(), qty: qtyText(result.quantity, form.unit) }) : t('inventory.saved'));
    nav.pop();
  };

  return html`
    <${SheetHeader} title=${id ? t('inventory.editItem') : t('inventory.add')} back />
    <${SheetBody}>
      <${Field} label=${t('inventory.fields.name')} htmlFor=${ids.name} error=${error || null}>
        <${ProductInput} id=${ids.name} value=${form.name} autoFocus=${!id} onInput=${(/** @type {string} */ name) => update({ name })} onPick=${pick} />
      <//>
      <div class="two-cols">
        <${Field} label=${t('inventory.fields.quantity')} htmlFor=${ids.qty}>
          <input id=${ids.qty} class="input" type="number" min="0" step="any" inputmode="decimal" value=${form.quantity}
            onInput=${(/** @type {Event} */ e) => update({ quantity: /** @type {HTMLInputElement} */ (e.currentTarget).value })} />
        <//>
        <${Field} label=${t('inventory.fields.unit')} htmlFor=${ids.unit}>
          <${UnitSelect} id=${ids.unit} value=${form.unit} onChange=${(/** @type {string} */ unit) => update({ unit })} />
        <//>
      </div>
      ${scope === 'fridge' &&
      html`<${Field} label=${t('inventory.place')}>
        <${Segmented} label=${t('inventory.place')} value=${form.location}
          options=${[{ value: 'fridge', label: t('inventory.places.fridge') }, { value: 'freezer', label: t('inventory.places.freezer') }]}
          onChange=${(/** @type {any} */ location) => update({ location })} />
      <//>`}
      <${Field} label=${t('inventory.fields.category')} htmlFor=${ids.cat}>
        <${Select} id=${ids.cat} value=${form.category} options=${cats.map((c) => ({ value: c, label: t(`inventory.categories.${c}`) }))} onChange=${(/** @type {string} */ category) => update({ category })} />
      <//>
      <${Field} label=${t('inventory.fields.expiry')} htmlFor=${ids.exp} optional>
        <${DateTimeInput} id=${ids.exp} type="date" value=${form.expiryDate} onInput=${(/** @type {string} */ expiryDate) => update({ expiryDate })} />
        <div class="chips">
          <button type="button" class="chip-btn" onClick=${() => update({ expiryDate: addDays(today(), 3) })}>+3 ${t('inventory.daysShort')}</button>
          <button type="button" class="chip-btn" onClick=${() => update({ expiryDate: addDays(today(), 7) })}>+1 ${t('inventory.weekShort')}</button>
          <button type="button" class="chip-btn" onClick=${() => update({ expiryDate: addMonths(today(), 1) })}>+1 ${t('inventory.monthShort')}</button>
          ${form.expiryDate && html`<button type="button" class="chip-btn" onClick=${() => update({ expiryDate: '' })}>${t('inventory.noExpiry')}</button>`}
        </div>
      <//>
      <div class="two-cols">
        <${Field} label=${t('inventory.fields.openedAt')} htmlFor=${ids.open} optional>
          <${DateTimeInput} id=${ids.open} type="date" value=${form.openedAt} onInput=${(/** @type {string} */ openedAt) => update({ openedAt })} />
        <//>
        ${scope === 'bathroom'
          ? html`<${Field} label=${t('inventory.fields.useWithin')} htmlFor=${ids.pao} optional>
              <input id=${ids.pao} class="input" type="number" min="1" max="60" inputmode="numeric" value=${form.useWithinMonths} placeholder="12"
                onInput=${(/** @type {Event} */ e) => update({ useWithinMonths: /** @type {HTMLInputElement} */ (e.currentTarget).value })} />
            <//>`
          : html`<${Field} label=${t('inventory.fields.lowStockAt')} htmlFor=${ids.low} optional>
              <input id=${ids.low} class="input" type="number" min="0" step="any" inputmode="decimal" value=${form.lowStockAt}
                onInput=${(/** @type {Event} */ e) => update({ lowStockAt: /** @type {HTMLInputElement} */ (e.currentTarget).value })} />
            <//>`}
      </div>
      ${scope === 'bathroom' &&
      html`<${Field} label=${t('inventory.fields.lowStockAt')} htmlFor=${ids.low} optional>
        <input id=${ids.low} class="input" type="number" min="0" step="any" inputmode="decimal" value=${form.lowStockAt}
          onInput=${(/** @type {Event} */ e) => update({ lowStockAt: /** @type {HTMLInputElement} */ (e.currentTarget).value })} />
      <//>`}
      ${scope === 'pantry' &&
      html`<${Field} label=${t('inventory.fields.spot')} htmlFor=${ids.spot} optional>
        <input id=${ids.spot} class="input" list=${`${ids.spot}-list`} value=${form.spot} maxlength="40" placeholder=${t('inventory.spotPlaceholder')}
          onInput=${(/** @type {Event} */ e) => update({ spot: /** @type {HTMLInputElement} */ (e.currentTarget).value })} />
        <datalist id=${`${ids.spot}-list`}>${spots.map((s) => html`<option key=${s} value=${s} />`)}</datalist>
      <//>`}
      ${existing && effectiveExpiry(existing) && scope === 'bathroom' && html`<p class="field-help">${t('inventory.useBy', { date: formatDate(/** @type {string} */ (effectiveExpiry(existing)), { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>`}
      <${Field} label=${t('tasks.fields.notes')} htmlFor=${ids.notes} optional>
        <${TextArea} id=${ids.notes} value=${form.notes} rows=${2} onInput=${(/** @type {string} */ notes) => update({ notes })} />
      <//>
    <//>
    <${SheetFooter}>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}

/** "Mark used": all, or an amount. @param {{ id: string, nav: Nav }} props */
function UsedPage({ id, nav }) {
  const all = /** @type {InventoryItem[]} */ (/** @type {unknown} */ (useCollection('inventoryItems')));
  const item = all.find((i) => i.id === id);
  const [amount, setAmount] = useState(item ? Math.min(item.quantity, stepFor(item.unit)) : 1);
  if (!item) return html`<${SheetHeader} title="" back /><${SheetBody} />`;
  const apply = async (/** @type {number} */ used) => {
    const { token } = await setQuantity(item.id, roundQty(item.quantity - used));
    await nav.pop();
    undoToast(t('inventory.usedToast', { name: item.name }), token);
  };
  const step = stepFor(item.unit);
  return html`
    <${SheetHeader} title=${t('inventory.markUsed')} back />
    <${SheetBody}>
      <p class="goal">${item.name} · ${qtyText(item.quantity, item.unit)}</p>
      <button type="button" class="btn btn-primary wide" style="margin-top:16px" onClick=${() => apply(item.quantity)}>${t('inventory.usedAll')}</button>
      <p class="field-help" style="margin:16px 0 8px">${t('inventory.usedSome')}</p>
      <div class="stepper big">
        <button type="button" aria-label=${t('inventory.less')} onClick=${() => setAmount(Math.max(step, roundQty(amount - step)))}>−</button>
        <span class="stepper-value">${qtyText(amount, item.unit)}</span>
        <button type="button" aria-label=${t('inventory.more')} onClick=${() => setAmount(Math.min(item.quantity, roundQty(amount + step)))}>+</button>
      </div>
    <//>
    <${SheetFooter}>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => apply(amount)}>${t('common.save')}</button>
    <//>
  `;
}


