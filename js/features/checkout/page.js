// @ts-check
// Checkout page shared by the Grocery shop basket and "Finish shopping" on the board (docs/spec/rooms/town.md T1, F-1).

import { html, useState } from '../../ui/lib.js';
import { t, nameOf } from '../../core/i18n.js';
import { today } from '../../core/time.js';
import { appStore } from '../../core/store.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Select, DateTimeInput, useFieldId } from '../../ui/controls.js';
import { setDirty } from '../../ui/sheet.js';
import { undoToast } from '../../ui/toast.js';
import { icon } from '../../ui/icons.js';
import { money, MoneyInput } from '../../ui/money.js';
import { convert } from '../../core/units.js';
import { suggestedExpiry } from '../inventory/model.js';
import { linesTotal, validateCheckout, destinationCounts } from './model.js';
import { checkout } from './actions.js';

/** @typedef {import('./model.js').CheckoutLine} CheckoutLine */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

const DESTINATIONS = ['fridge', 'freezer', 'pantry', 'bathroom', 'none'];

/**
 * Builds a checkout line from a product and quantity (price estimated from the last purchase).
 * @param {any} product
 * @param {number} quantity
 * @param {string} unit
 * @param {string|null} [shoppingItemId]
 * @returns {CheckoutLine}
 */
export function lineFor(product, quantity, unit, shoppingItemId = null) {
  let priceMinor = 0;
  if (typeof product.lastPriceMinor === 'number') {
    const q = convert(quantity, /** @type {any} */ (unit), product.defaultUnit);
    if (q !== null && product.defaultQty) priceMinor = Math.round((product.lastPriceMinor * q) / product.defaultQty);
  }
  return {
    key: `${product.id}:${shoppingItemId ?? ''}`,
    name: nameOf(product),
    productId: product.id,
    quantity,
    unit,
    priceMinor,
    destination: product.defaultLocation ?? 'pantry',
    expiryDate: suggestedExpiry(today(), product.shelfLifeDays),
    category: product.category,
    financeCategoryId: product.financeCategoryId ?? 'cat-groceries',
    shoppingItemId,
  };
}

/**
 * @param {{ initialLines: CheckoutLine[], nav: Nav, onBought?: () => void }} props
 */
export function CheckoutPage({ initialLines, nav, onBought }) {
  const accounts = /** @type {any[]} */ (appStore.all('accounts')).filter((a) => !a.archived);
  const [lines, setLines] = useState(initialLines);
  const [actual, setActual] = useState(/** @type {number|null} */ (null));
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? 'acc-wallet');
  const [date, setDate] = useState(today());
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const [result, setResult] = useState(/** @type {{ total: number, counts: Record<string, number>, items: number }|null} */ (null));
  const ids = { account: useFieldId('co-acc'), date: useFieldId('co-date'), total: useFieldId('co-total') };
  const sum = linesTotal(lines);
  const total = actual ?? sum;

  /** @param {number} i @param {Partial<CheckoutLine>} patch */
  const change = (i, patch) => {
    setDirty(true);
    setLines((prev) => prev.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  };

  const buy = async () => {
    const found = validateCheckout(lines, total);
    setErrors(found);
    if (Object.keys(found).length) return;
    const { token } = await checkout({ lines, actualTotalMinor: total, accountId, date });
    setDirty(false);
    onBought?.();
    setResult({ total, counts: destinationCounts(lines), items: lines.length });
    undoToast(t('checkout.bought', { count: lines.length, total: money(total) }), token);
  };

  if (result) {
    return html`
      <${SheetHeader} title=${t('checkout.doneTitle')} />
      <${SheetBody}>
        <div class="hero">
          <div class="hero-big small">−${money(result.total)}</div>
          <div class="hero-sub">${t('checkout.boughtItems', { count: result.items })}</div>
        </div>
        <div class="group">
          ${Object.entries(result.counts).filter(([d]) => d !== 'none').map(
            ([d, n]) => html`<div class="row" key=${d}><span class="main title">${t(`checkout.destinations.${d}`)}</span><span class="meta">+${n}</span></div>`,
          )}
        </div>
      <//>
      <${SheetFooter}><span class="grow"></span><button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button><//>
    `;
  }

  return html`
    <${SheetHeader} title=${t('checkout.title')} back />
    <${SheetBody}>
      ${errors.lines && html`<p class="field-error">${t(errors.lines)}</p>`}
      <div class="group">
        ${lines.map(
          (line, i) => html`<div class="checkout-line" key=${line.key}>
            <div class="checkout-head">
              <span class="title">${line.name}</span>
              <button type="button" class="icon-button" aria-label=${t('checkout.remove', { name: line.name })} onClick=${() => { setDirty(true); setLines((prev) => prev.filter((_, k) => k !== i)); }}>
                ${icon('close', { size: 18 })}
              </button>
            </div>
            <div class="checkout-grid">
              <label class="mini-field"><span>${t('inventory.fields.quantity')}</span>
                <input class="input" type="number" min="0" step="any" inputmode="decimal" value=${line.quantity} aria-label=${t('inventory.quantityOf', { name: line.name })}
                  onInput=${(/** @type {Event} */ e) => change(i, { quantity: Number(/** @type {HTMLInputElement} */ (e.currentTarget).value) })} />
                <small>${t(`units.${line.unit}`)}</small></label>
              <label class="mini-field"><span>${t('checkout.price')}</span>
                <${MoneyInput} id=${`co-price-${i}`} valueMinor=${line.priceMinor || null} label=${t('checkout.priceOf', { name: line.name })}
                  onChange=${(/** @type {number|null} */ priceMinor) => change(i, { priceMinor: priceMinor ?? 0 })} /></label>
            </div>
            <div class="checkout-grid">
              <label class="mini-field"><span>${t('checkout.goesTo')}</span>
                <${Select} value=${line.destination} label=${t('checkout.goesTo')} options=${DESTINATIONS.map((d) => ({ value: d, label: t(`checkout.destinations.${d}`) }))}
                  onChange=${(/** @type {any} */ destination) => change(i, { destination })} /></label>
              ${line.destination !== 'none' &&
              html`<label class="mini-field"><span>${t('inventory.fields.expiry')}</span>
                <input class="input" type="date" value=${line.expiryDate ?? ''} aria-label=${t('inventory.fields.expiry')}
                  onInput=${(/** @type {Event} */ e) => change(i, { expiryDate: /** @type {HTMLInputElement} */ (e.currentTarget).value || null })} /></label>`}
            </div>
          </div>`,
        )}
      </div>
      ${!lines.length && html`<p class="empty small">${t('checkout.errors.empty')}</p>`}
      <div class="totals">
        <div class="row"><span class="main title">${t('checkout.itemsTotal')}</span><span class="meta">${money(sum)}</span></div>
      </div>
      <${Field} label=${t('checkout.actualTotal')} htmlFor=${ids.total} help=${t('checkout.actualHelp')} error=${errors.total && t(errors.total)}>
        <${MoneyInput} id=${ids.total} valueMinor=${actual} placeholder=${money(sum)} onChange=${setActual} />
      <//>
      <div class="two-cols">
        <${Field} label=${t('checkout.account')} htmlFor=${ids.account}>
          <${Select} id=${ids.account} value=${accountId} options=${accounts.map((a) => ({ value: a.id, label: nameOf(a) }))} onChange=${setAccountId} />
        <//>
        <${Field} label=${t('calendar.fields.date')} htmlFor=${ids.date}>
          <${DateTimeInput} id=${ids.date} type="date" value=${date} onInput=${setDate} />
        <//>
      </div>
    <//>
    <${SheetFooter}>
      <span class="total-label">${money(total)}</span>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" disabled=${!lines.length} onClick=${buy}>${t('checkout.buy')}</button>
    <//>
  `;
}

