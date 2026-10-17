// @ts-check
// Small form controls shared by windows (docs/spec/03-ux-shell.md §5.2).

import { html } from './lib.js';

/**
 * Segmented control (single choice). Each option is { value, label }.
 * @param {{ value: any, options: { value: any, label: string }[], onChange: (value: any) => void, label: string }} props
 */
export function Segmented({ value, options, onChange, label }) {
  return html`<div class="segmented" role="group" aria-label=${label}>
    ${options.map(
      (opt) => html`<button
        type="button"
        key=${String(opt.value)}
        aria-pressed=${opt.value === value ? 'true' : 'false'}
        onClick=${() => opt.value !== value && onChange(opt.value)}
      >
        ${opt.label}
      </button>`,
    )}
  </div>`;
}

/**
 * Switch (toggle) with role="switch".
 * @param {{ checked: boolean, onChange: (checked: boolean) => void, label: string, id?: string }} props
 */
export function Switch({ checked, onChange, label, id }) {
  return html`<button
    type="button"
    id=${id}
    class="switch"
    role="switch"
    aria-checked=${checked ? 'true' : 'false'}
    aria-label=${label}
    onClick=${() => onChange(!checked)}
  ></button>`;
}

/**
 * Native select.
 * @param {{ value: string, options: { value: string, label: string }[], onChange: (value: string) => void, id?: string, label?: string }} props
 */
export function Select({ value, options, onChange, id, label }) {
  return html`<select
    class="select"
    id=${id}
    aria-label=${label}
    value=${value}
    onChange=${(/** @type {Event} */ e) => onChange(/** @type {HTMLSelectElement} */ (e.currentTarget).value)}
  >
    ${options.map((opt) => html`<option key=${opt.value} value=${opt.value}>${opt.label}</option>`)}
  </select>`;
}

/**
 * Labelled settings-style row with a control on the right (or below when `stacked`).
 * @param {{ label: string, htmlFor?: string, help?: string, stacked?: boolean, children?: any }} props
 */
export function FieldRow({ label, htmlFor, help, stacked = false, children }) {
  return html`<div class="row" style=${stacked ? 'flex-direction: column; align-items: stretch' : ''}>
    <div class="main">
      <label class="title" for=${htmlFor}>${label}</label>
      ${help && html`<div class="subtitle">${help}</div>`}
    </div>
    ${children}
  </div>`;
}
