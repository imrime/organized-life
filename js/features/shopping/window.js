// @ts-check
// Shopping board (docs/spec/rooms/kitchen.md K3): list by aisle, suggestions, Finish shopping → checkout.

import { html, useState } from '../../ui/lib.js';
import { t, nameOf } from '../../core/i18n.js';
import { appStore } from '../../core/store.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Segmented, Select, TextInput, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection } from '../../ui/hooks.js';
import { undoToast, toast } from '../../ui/toast.js';
import { choiceDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { money, MoneyInput } from '../../ui/money.js';
import { openObject } from '../../ui/navigation.js';
import { SHOP_CATEGORIES } from '../products/catalog.js';
import { ProductInput, UnitSelect, qtyText } from '../products/ui.js';
import { CheckoutPage, lineFor } from '../checkout/page.js';
import { aisles, estimateTotal, lineEstimate, suggestions } from './model.js';
import { quickAddShopping, setChecked, saveShoppingItem, deleteShoppingItem, clearChecked, uncheckAll, addShoppingEntries } from './actions.js';

/** @typedef {import('./model.js').ShoppingItem} ShoppingItem */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

const productOf = (/** @type {string} */ id) => appStore.get('products', id);

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function ShoppingWindow({ page, nav }) {
  if (page?.id === 'item') return html`<${ItemPage} id=${page.params?.id ?? null} nav=${nav} />`;
  if (page?.id === 'checkout') return html`<${FinishShopping} nav=${nav} />`;
  return html`<${BoardRoot} nav=${nav} />`;
}

/** @param {{ item: ShoppingItem, nav: Nav }} props */
function ShopRow({ item, nav }) {
  const { minor, approx } = lineEstimate(item, productOf);
  return html`<div class="row shop-row">
    <button type="button" class=${`check${item.checked ? ' on' : ''}`} role="checkbox" aria-checked=${item.checked ? 'true' : 'false'} aria-label=${item.name}
      onClick=${() => setChecked(item.id, !item.checked)}>${item.checked && icon('check', { size: 18 })}</button>
    <button type="button" class="row-hit" onClick=${() => nav.push('item', { id: item.id })}>
      <span class="main">
        <span class=${`title${item.checked ? ' done' : ''}`}>${item.priority === 'high' ? '❗ ' : ''}${item.name}</span>
        <span class="subtitle" style="display:block">${qtyText(item.quantity, item.unit)}${item.note ? ` · ${item.note}` : ''}</span>
      </span>
      ${minor !== null && html`<span class="meta">${approx ? '≈ ' : ''}${money(minor)}</span>`}
    </button>
  </div>`;
}

/** @param {{ nav: Nav }} props */
function BoardRoot({ nav }) {
  const items = /** @type {ShoppingItem[]} */ (/** @type {unknown} */ (useCollection('shoppingItems')));
  const inventory = /** @type {any[]} */ (useCollection('inventoryItems'));
  const meds = /** @type {any[]} */ (useCollection('medications'));
  const [draft, setDraft] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const open = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);
  const estimate = estimateTotal(open, productOf);
  const ideas = suggestions({ inventory, meds, shopping: items, productOf });

  const add = async (/** @type {Event} */ e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    await quickAddShopping(draft);
    setDraft('');
  };
  const menu = async () => {
    const choice = await choiceDialog({
      title: t('shopping.listActions'),
      choices: [
        { value: 'uncheck', label: t('shopping.uncheckAll') },
        { value: 'clear', label: t('shopping.clearChecked'), destructive: true },
      ],
    });
    if (choice === 'clear') {
      const { token } = await clearChecked();
      undoToast(t('shopping.cleared'), token);
    }
    if (choice === 'uncheck') uncheckAll();
  };

  return html`
    <${SheetHeader} title=${t('objects.kitchen.shoppingBoard.name')} />
    <${SheetBody}>
      <div class="summary-line">
        <span>${t('shopping.count', { count: open.length })}</span>
        ${estimate.known > 0 && html`<span>${estimate.approx ? '≈ ' : ''}${money(estimate.total)}</span>`}
        ${checked.length > 0 && html`<button type="button" class="icon-button" aria-label=${t('shopping.listActions')} onClick=${menu}>⋯</button>`}
      </div>
      <form class="quick-add" onSubmit=${add}>
        <input class="input" value=${draft} maxlength="80" placeholder=${t('shopping.quickAdd')} aria-label=${t('shopping.quickAdd')} list="shop-products"
          onInput=${(/** @type {Event} */ e) => setDraft(/** @type {HTMLInputElement} */ (e.currentTarget).value)} />
        <datalist id="shop-products">${/** @type {any[]} */ (appStore.all('products')).map((p) => html`<option key=${p.id} value=${nameOf(p)} />`)}</datalist>
        <button type="submit" class="btn" disabled=${!draft.trim()} aria-label=${t('tasks.add')}>${icon('plus', { size: 20 })}</button>
      </form>
      ${ideas.length > 0 &&
      html`<section class="section suggestions">
        <div class="section-head">
          <button type="button" class="link-button" aria-expanded=${showSuggestions ? 'true' : 'false'} onClick=${() => setShowSuggestions(!showSuggestions)}>
            ${showSuggestions ? '▾' : '▸'} ${t('shopping.suggestions', { count: ideas.length })}
          </button>
          <button type="button" class="btn btn-small" onClick=${async () => { const { token } = await addShoppingEntries(ideas); undoToast(t('shopping.added', { count: ideas.length }), token); }}>${t('shopping.addAll')}</button>
        </div>
        ${showSuggestions &&
        html`<div class="group">${ideas.map(
          (s) => html`<div class="row" key=${s.key}>
            <span class="main"><span class="title">${s.name}</span><span class="subtitle" style="display:block">${t(`shopping.sources.${s.source}`)}</span></span>
            <button type="button" class="icon-button" aria-label=${t('shopping.addOne', { name: s.name })} onClick=${() => addShoppingEntries([s])}>${icon('plus')}</button>
          </div>`,
        )}</div>`}
      </section>`}
      ${aisles(items).map(
        (g) => html`<section class="section" key=${g.key}>
          <h3 class="section-title">${t(`shopping.aisles.${g.key}`)}</h3>
          <div class="group">${g.items.map((item) => html`<${ShopRow} key=${item.id} item=${item} nav=${nav} />`)}</div>
        </section>`,
      )}
      ${checked.length > 0 &&
      html`<section class="section">
        <h3 class="section-title">🛒 ${t('shopping.inCart', { count: checked.length })}</h3>
        <div class="group">${checked.map((item) => html`<${ShopRow} key=${item.id} item=${item} nav=${nav} />`)}</div>
      </section>`}
      ${!items.length && html`<div class="empty"><div class="art" aria-hidden="true">📝</div><p>${t('shopping.empty')}</p></div>`}
    <//>
    <${SheetFooter}>
      ${checked.length
        ? html`<button type="button" class="btn btn-primary" onClick=${() => nav.push('checkout')}>${t('shopping.finish', { count: checked.length })}</button>`
        : html`<button type="button" class="btn" onClick=${async () => { if (await nav.close()) openObject('town.grocery-shop'); }}>🏪 ${t('shopping.goShopping')}</button>`}
      <span class="grow"></span>
      <button type="button" class=${checked.length ? 'btn' : 'btn btn-primary'} onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ nav: Nav }} props */
function FinishShopping({ nav }) {
  const items = /** @type {ShoppingItem[]} */ (/** @type {unknown} */ (appStore.all('shoppingItems'))).filter((i) => i.checked);
  const [lines] = useState(() =>
    items.map((item) => {
      const product = item.productId ? productOf(item.productId) : null;
      return product ? lineFor(product, item.quantity, item.unit, item.id) : lineFor({ id: item.id, name: item.name, category: 'other_food', defaultUnit: item.unit, defaultQty: 1, defaultLocation: 'pantry', financeCategoryId: 'cat-groceries' }, item.quantity, item.unit, item.id);
    }),
  );
  return html`<${CheckoutPage} initialLines=${lines} nav=${nav} />`;
}

/** @param {{ id: string|null, nav: Nav }} props */
function ItemPage({ id, nav }) {
  const items = /** @type {ShoppingItem[]} */ (/** @type {unknown} */ (useCollection('shoppingItems')));
  const existing = id ? items.find((i) => i.id === id) : undefined;
  const [form, update, markSaved] = useForm({
    name: existing?.name ?? '',
    quantity: existing?.quantity ?? 1,
    unit: existing?.unit ?? 'pcs',
    shopCategory: existing?.shopCategory ?? 'other',
    priority: existing?.priority ?? 'normal',
    estPriceMinor: existing?.estPriceMinor ?? null,
    note: existing?.note ?? '',
  });
  const [error, setError] = useState('');
  const ids = { name: useFieldId('s-name'), qty: useFieldId('s-qty'), unit: useFieldId('s-unit'), cat: useFieldId('s-cat'), price: useFieldId('s-price'), note: useFieldId('s-note') };
  const onSave = async () => {
    if (!form.name.trim()) return setError(t('form.errors.required'));
    await saveShoppingItem(form, id);
    markSaved();
    toast(t('common.saved'));
    nav.pop();
  };
  const onDelete = async () => {
    if (!id) return;
    const { token } = await deleteShoppingItem(id);
    markSaved();
    await nav.pop();
    undoToast(t('shopping.deleted'), token);
  };
  return html`
    <${SheetHeader} title=${id ? t('shopping.editItem') : t('shopping.newItem')} back />
    <${SheetBody}>
      <${Field} label=${t('inventory.fields.name')} htmlFor=${ids.name} error=${error || null}>
        <${ProductInput} id=${ids.name} value=${form.name} autoFocus=${!id} onInput=${(/** @type {string} */ name) => update({ name })}
          onPick=${(/** @type {any} */ p) => !existing && update({ unit: p.defaultUnit, quantity: p.defaultQty, shopCategory: p.shopCategory })} />
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
      <${Field} label=${t('shopping.aisle')} htmlFor=${ids.cat}>
        <${Select} id=${ids.cat} value=${form.shopCategory} options=${SHOP_CATEGORIES.map((c) => ({ value: c, label: t(`shopping.aisles.${c}`) }))} onChange=${(/** @type {string} */ shopCategory) => update({ shopCategory })} />
      <//>
      <${Field} label=${t('tasks.fields.priority')}>
        <${Segmented} label=${t('tasks.fields.priority')} value=${form.priority} options=${['low', 'normal', 'high'].map((v) => ({ value: v, label: t(`tasks.priority.${v}`) }))}
          onChange=${(/** @type {any} */ priority) => update({ priority })} />
      <//>
      <${Field} label=${t('shopping.estimate')} htmlFor=${ids.price} optional>
        <${MoneyInput} id=${ids.price} valueMinor=${form.estPriceMinor} onChange=${(/** @type {number|null} */ estPriceMinor) => update({ estPriceMinor })} />
      <//>
      <${Field} label=${t('shopping.note')} htmlFor=${ids.note} optional>
        <${TextInput} id=${ids.note} value=${form.note} maxLength=${80} onInput=${(/** @type {string} */ note) => update({ note })} />
      <//>
    <//>
    <${SheetFooter}>
      ${id && html`<button type="button" class="btn btn-danger" onClick=${onDelete}>${t('common.delete')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}
