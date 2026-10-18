// @ts-check
// Grocery shop (docs/spec/rooms/town.md T1): your list, catalogue by aisle, basket → checkout.

import { html, useState } from '../../ui/lib.js';
import { t, nameOf } from '../../core/i18n.js';
import { appStore } from '../../core/store.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Select, useForm, useFieldId, TextInput } from '../../ui/controls.js';
import { useCollection } from '../../ui/hooks.js';
import { toast } from '../../ui/toast.js';
import { icon } from '../../ui/icons.js';
import { money, MoneyInput } from '../../ui/money.js';
import { SHOP_CATEGORIES, FOOD_CATEGORIES, BATH_CATEGORIES, shopCategoryFor, financeCategoryFor, locationFor, shelfLifeFor } from '../products/catalog.js';
import { searchProducts } from '../products/model.js';
import { UnitSelect, qtyText } from '../products/ui.js';
import { stepFor, roundQty } from '../inventory/model.js';
import { CheckoutPage, lineFor } from '../checkout/page.js';
import { linesTotal } from '../checkout/model.js';

/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */
/** @typedef {{ productId: string, quantity: number, unit: string, shoppingItemId: string|null }} BasketEntry */

/** Basket lives for the session (survives page pushes, cleared after buying). */
/** @type {Map<string, BasketEntry>} */
const basket = new Map();
const session = { aisle: 'all' };

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function GroceryWindow({ page, nav }) {
  if (page?.id === 'checkout') return html`<${BasketCheckout} nav=${nav} />`;
  if (page?.id === 'product') return html`<${NewProductPage} name=${page.params?.name ?? ''} nav=${nav} />`;
  return html`<${ShopRoot} nav=${nav} />`;
}

function useBasket() {
  const [, setVersion] = useState(0);
  /** @param {string} productId @param {number} quantity @param {string} unit @param {string|null} [shoppingItemId] */
  const set = (productId, quantity, unit, shoppingItemId = null) => {
    if (quantity <= 0) basket.delete(productId);
    else basket.set(productId, { productId, quantity: roundQty(quantity), unit, shoppingItemId: shoppingItemId ?? basket.get(productId)?.shoppingItemId ?? null });
    setVersion((v) => v + 1);
  };
  return set;
}

function basketLines() {
  return [...basket.values()]
    .map((e) => {
      const product = appStore.get('products', e.productId);
      return product ? lineFor(product, e.quantity, e.unit, e.shoppingItemId) : null;
    })
    .filter(Boolean);
}

/** @param {{ nav: Nav }} props */
function ShopRoot({ nav }) {
  const products = /** @type {any[]} */ (useCollection('products'));
  const list = /** @type {any[]} */ (useCollection('shoppingItems')).filter((i) => !i.checked);
  const setBasket = useBasket();
  const [query, setQuery] = useState('');
  const [aisle, setAisle] = useState(session.aisle);
  const [listOpen, setListOpen] = useState(true);

  const shown = searchProducts(
    aisle === 'fav' ? products.filter((p) => p.favorite) : aisle === 'all' ? products : products.filter((p) => p.shopCategory === aisle),
    query,
    nameOf,
    query ? 30 : 200,
  );
  const lines = basketLines();
  const total = linesTotal(/** @type {any[]} */ (lines));
  const fromList = (/** @type {any} */ item) => item.productId && setBasket(item.productId, item.quantity, item.unit, item.id);

  return html`
    <${SheetHeader} title=${t('objects.town.groceryShop.name')} />
    <${SheetBody}>
      ${list.length > 0 &&
      html`<section class="section">
        <div class="section-head">
          <button type="button" class="link-button" aria-expanded=${listOpen ? 'true' : 'false'} onClick=${() => setListOpen(!listOpen)}>${listOpen ? '▾' : '▸'} ${t('grocery.fromList', { count: list.length })}</button>
          <button type="button" class="btn btn-small" onClick=${() => list.forEach(fromList)}>${t('shopping.addAll')}</button>
        </div>
        ${listOpen &&
        html`<div class="group">${list.map((item) => {
          const inBasket = item.productId && basket.has(item.productId);
          return html`<div class="row" key=${item.id}>
            <span class="main"><span class="title">${item.name}</span><span class="subtitle" style="display:block">${qtyText(item.quantity, item.unit)}</span></span>
            ${inBasket ? html`<span class="meta">✓ ${t('grocery.inBasket')}</span>` : html`<button type="button" class="icon-button" aria-label=${t('grocery.addToBasket', { name: item.name })} onClick=${() => fromList(item)}>${icon('plus')}</button>`}
          </div>`;
        })}</div>`}
      </section>`}
      <input class="search" type="search" value=${query} placeholder=${t('grocery.search')} aria-label=${t('grocery.search')}
        onInput=${(/** @type {Event} */ e) => setQuery(/** @type {HTMLInputElement} */ (e.currentTarget).value)} />
      <div class="chips scroll">
        ${['all', 'fav', ...SHOP_CATEGORIES].map(
          (a) => html`<button type="button" class="chip-btn" key=${a} aria-pressed=${aisle === a ? 'true' : 'false'} onClick=${() => { session.aisle = a; setAisle(a); }}>
            ${a === 'all' ? t('tasks.filters.all') : a === 'fav' ? `★ ${t('grocery.favourites')}` : t(`shopping.aisles.${a}`)}</button>`,
        )}
      </div>
      <div class="group" style="margin-top:8px">
        ${shown.map((p) => {
          const entry = basket.get(p.id);
          const step = stepFor(p.defaultUnit) === 1 ? 1 : p.defaultQty;
          return html`<div class="row" key=${p.id}>
            <span class="main"><span class="title">${nameOf(p)}</span>
              <span class="subtitle" style="display:block">${typeof p.lastPriceMinor === 'number' ? `${money(p.lastPriceMinor)} / ${qtyText(p.defaultQty, p.defaultUnit)}` : qtyText(p.defaultQty, p.defaultUnit)}</span></span>
            ${entry
              ? html`<div class="stepper">
                  <button type="button" aria-label=${t('inventory.less')} onClick=${() => setBasket(p.id, entry.quantity - step, entry.unit)}>−</button>
                  <span class="stepper-value">${qtyText(entry.quantity, entry.unit)}</span>
                  <button type="button" aria-label=${t('inventory.more')} onClick=${() => setBasket(p.id, entry.quantity + step, entry.unit)}>+</button>
                </div>`
              : html`<button type="button" class="icon-button" aria-label=${t('grocery.addToBasket', { name: nameOf(p) })} onClick=${() => setBasket(p.id, p.defaultQty, p.defaultUnit)}>${icon('plus')}</button>`}
          </div>`;
        })}
      </div>
      ${query && !shown.length && html`<button type="button" class="btn wide" style="margin-top:12px" onClick=${() => nav.push('product', { name: query })}>+ ${t('grocery.newProduct', { name: query })}</button>`}
    <//>
    <${SheetFooter}>
      ${lines.length
        ? html`<button type="button" class="btn btn-primary wide basket-bar" onClick=${() => nav.push('checkout')}>🧺 ${t('grocery.basket', { count: lines.length })} · ${money(total)} — ${t('grocery.checkout')}</button>`
        : html`<span class="field-help">${t('grocery.emptyBasket')}</span><span class="grow"></span><button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>`}
    <//>
  `;
}

/** @param {{ nav: Nav }} props */
function BasketCheckout({ nav }) {
  const [lines] = useState(() => /** @type {any[]} */ (basketLines()));
  return html`<${CheckoutPage} initialLines=${lines} nav=${nav} onBought=${() => basket.clear()} />`;
}

/** @param {{ name: string, nav: Nav }} props */
function NewProductPage({ name, nav }) {
  const setBasket = useBasket();
  const categories = [...FOOD_CATEGORIES, ...BATH_CATEGORIES, 'household'];
  const [form, update, markSaved] = useForm({ name, category: 'other_food', unit: 'pcs', quantity: 1, priceMinor: /** @type {number|null} */ (null) });
  const ids = { name: useFieldId('np-name'), cat: useFieldId('np-cat'), unit: useFieldId('np-unit'), qty: useFieldId('np-qty'), price: useFieldId('np-price') };
  const onSave = async () => {
    if (!form.name.trim()) return;
    const shopCategory = shopCategoryFor(form.category);
    const { result } = await appStore.mutate('products.add', (tx) =>
      tx.insert('products', {
        name: form.name.trim(), category: form.category, shopCategory, financeCategoryId: financeCategoryFor(shopCategory),
        defaultUnit: form.unit, defaultQty: Number(form.quantity) || 1, defaultLocation: locationFor(form.category), shelfLifeDays: shelfLifeFor(form.category),
        lastPriceMinor: form.priceMinor, favorite: false,
      }),
    );
    markSaved();
    setBasket(result.id, result.defaultQty, result.defaultUnit);
    toast(t('grocery.productAdded'));
    nav.pop();
  };
  return html`
    <${SheetHeader} title=${t('grocery.newProductTitle')} back />
    <${SheetBody}>
      <${Field} label=${t('inventory.fields.name')} htmlFor=${ids.name}>
        <${TextInput} id=${ids.name} value=${form.name} maxLength=${80} onInput=${(/** @type {string} */ v) => update({ name: v })} />
      <//>
      <${Field} label=${t('inventory.fields.category')} htmlFor=${ids.cat}>
        <${Select} id=${ids.cat} value=${form.category} options=${categories.map((c) => ({ value: c, label: t(`inventory.categories.${c}`) }))} onChange=${(/** @type {string} */ category) => update({ category })} />
      <//>
      <div class="two-cols">
        <${Field} label=${t('inventory.fields.quantity')} htmlFor=${ids.qty}>
          <input id=${ids.qty} class="input" type="number" min="0" step="any" value=${form.quantity} onInput=${(/** @type {Event} */ e) => update({ quantity: /** @type {HTMLInputElement} */ (e.currentTarget).value })} />
        <//>
        <${Field} label=${t('inventory.fields.unit')} htmlFor=${ids.unit}>
          <${UnitSelect} id=${ids.unit} value=${form.unit} onChange=${(/** @type {string} */ unit) => update({ unit })} />
        <//>
      </div>
      <${Field} label=${t('checkout.price')} htmlFor=${ids.price} optional>
        <${MoneyInput} id=${ids.price} valueMinor=${form.priceMinor} onChange=${(/** @type {number|null} */ priceMinor) => update({ priceMinor })} />
      <//>
    <//>
    <${SheetFooter}><span class="grow"></span><button type="button" class="btn btn-primary" onClick=${onSave}>${t('grocery.addToBasketShort')}</button><//>
  `;
}
