// @ts-check
// Money display and input in the user's currency (Settings → Currency).

import { html, useState } from './lib.js';
import { appStore } from '../core/store.js';
import { PROFILE } from '../core/schema.js';
import { formatMoney, parseMoney, fractionDigits } from '../core/money.js';
import { intlLocale } from '../core/i18n.js';

export function currency() {
  return /** @type {string} */ (appStore.profile(PROFILE.settings)?.currency ?? 'EUR');
}

/** @param {number|null|undefined} minor */
export function money(minor) {
  return minor === null || minor === undefined ? '—' : formatMoney(minor, currency(), intlLocale());
}

/** Plain number text for editing (no currency sign). @param {number|null|undefined} minor */
export function minorToText(minor) {
  if (minor === null || minor === undefined) return '';
  const digits = fractionDigits(currency());
  return (minor / 10 ** digits).toFixed(digits).replace(/\.0+$/, '');
}

/**
 * Text field for an amount; reports minor units (null when empty/invalid).
 * @param {{ id: string, valueMinor: number|null, onChange: (minor: number|null) => void, placeholder?: string, invalid?: boolean, label?: string }} props
 */
export function MoneyInput({ id, valueMinor, onChange, placeholder, invalid = false, label }) {
  const [text, setText] = useState(minorToText(valueMinor));
  const symbol = new Intl.NumberFormat(intlLocale(), { style: 'currency', currency: currency() }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? '';
  return html`<div class="money-input">
    <span class="money-symbol" aria-hidden="true">${symbol}</span>
    <input
      id=${id}
      class="input"
      inputmode="decimal"
      autocomplete="off"
      value=${text}
      placeholder=${placeholder}
      aria-label=${label}
      aria-invalid=${invalid ? 'true' : undefined}
      onInput=${(/** @type {Event} */ e) => {
        const value = /** @type {HTMLInputElement} */ (e.currentTarget).value;
        setText(value);
        onChange(value.trim() ? parseMoney(value, currency()) : null);
      }}
    />
  </div>`;
}
