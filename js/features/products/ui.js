// @ts-check
// Shared inputs for food/product forms: product name with autocomplete, unit select, quantity text.

import { html } from '../../ui/lib.js';
import { t, nameOf, formatNumber } from '../../core/i18n.js';
import { appStore } from '../../core/store.js';
import { UNITS } from '../../core/units.js';
import { Select } from '../../ui/controls.js';
import { findProduct } from './model.js';

/** "2 kg", "1.5 l", "6 pcs". @param {number} quantity @param {string} unit */
export function qtyText(quantity, unit) {
  return `${formatNumber(quantity, { maximumFractionDigits: 2 })} ${t(`units.${unit}`)}`;
}

/** @param {{ id: string, value: string, onChange: (unit: string) => void }} props */
export function UnitSelect({ id, value, onChange }) {
  return html`<${Select} id=${id} label=${t('inventory.fields.unit')} value=${value} options=${UNITS.map((u) => ({ value: u, label: t(`units.${u}`) }))} onChange=${onChange} />`;
}

/**
 * Name field with product suggestions (native datalist). Picking a known product calls onPick with it.
 * @param {{ id: string, value: string, onInput: (v: string) => void, onPick?: (product: any) => void, invalid?: boolean, autoFocus?: boolean, placeholder?: string }} props
 */
export function ProductInput({ id, value, onInput, onPick, invalid = false, autoFocus = false, placeholder }) {
  const products = /** @type {any[]} */ (appStore.all('products'));
  return html`
    <input
      id=${id}
      class="input"
      list=${`${id}-list`}
      value=${value}
      maxlength="80"
      autocomplete="off"
      placeholder=${placeholder}
      aria-invalid=${invalid ? 'true' : undefined}
      ref=${(/** @type {HTMLInputElement|null} */ el) => autoFocus && el && !el.dataset.focused && ((el.dataset.focused = '1'), el.focus())}
      onInput=${(/** @type {Event} */ e) => {
        const v = /** @type {HTMLInputElement} */ (e.currentTarget).value;
        onInput(v);
        const product = findProduct(products, v, nameOf);
        if (product && onPick) onPick(product);
      }}
    />
    <datalist id=${`${id}-list`}>${products.map((p) => html`<option key=${p.id} value=${nameOf(p)} />`)}</datalist>
  `;
}
