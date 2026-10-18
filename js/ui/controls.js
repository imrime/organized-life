// @ts-check
// Form controls shared by windows (docs/spec/03-ux-shell.md §5.2).

import { html, useEffect, useRef, useState } from './lib.js';
import { setDirty } from './sheet.js';
import { t } from '../core/i18n.js';

let fieldSeq = 0;
/** Stable unique id for label/field pairs. */
export function useFieldId(/** @type {string} */ prefix = 'f') {
  const ref = useRef('');
  if (!ref.current) ref.current = `${prefix}-${++fieldSeq}`;
  return ref.current;
}

/**
 * Segmented control (single choice). Each option is { value, label }.
 * @param {{ value: any, options: { value: any, label: string }[], onChange: (value: any) => void, label: string, id?: string }} props
 */
export function Segmented({ value, options, onChange, label, id }) {
  return html`<div class="segmented" role="group" aria-label=${label} id=${id}>
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
    onClick=${(/** @type {MouseEvent} */ e) => {
      e.stopPropagation();
      onChange(!checked);
    }}
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

/**
 * Field wrapper for form pages: label above, control, help or error below.
 * @param {{ label: string, htmlFor?: string, error?: string|null, help?: string, children?: any, optional?: boolean }} props
 */
export function Field({ label, htmlFor, error, help, children, optional = false }) {
  return html`<div class=${`field${error ? ' has-error' : ''}`}>
    <label class="field-label" for=${htmlFor}>${label}${optional ? html` <span class="field-optional">${t('form.optional')}</span>` : ''}</label>
    ${children}
    ${error ? html`<div class="field-error" role="alert">${error}</div>` : help ? html`<div class="field-help">${help}</div>` : null}
  </div>`;
}

/**
 * @param {{ id: string, value: string, onInput: (value: string) => void, maxLength?: number, placeholder?: string, type?: string, invalid?: boolean, autoFocus?: boolean }} props
 */
export function TextInput({ id, value, onInput, maxLength, placeholder, type = 'text', invalid = false, autoFocus = false }) {
  /** @type {{ current: HTMLInputElement|null }} */
  const ref = useRef(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, []);
  return html`<input
    ref=${ref}
    id=${id}
    class="input"
    type=${type}
    value=${value}
    maxlength=${maxLength}
    placeholder=${placeholder}
    aria-invalid=${invalid ? 'true' : undefined}
    onInput=${(/** @type {Event} */ e) => onInput(/** @type {HTMLInputElement} */ (e.currentTarget).value)}
  />`;
}

/**
 * Auto-growing textarea.
 * @param {{ id: string, value: string, onInput: (value: string) => void, maxLength?: number, placeholder?: string, rows?: number }} props
 */
export function TextArea({ id, value, onInput, maxLength = 5000, placeholder, rows = 3 }) {
  /** @type {{ current: HTMLTextAreaElement|null }} */
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return html`<textarea
    ref=${ref}
    id=${id}
    class="input textarea"
    rows=${rows}
    value=${value}
    maxlength=${maxLength}
    placeholder=${placeholder}
    onInput=${(/** @type {Event} */ e) => onInput(/** @type {HTMLTextAreaElement} */ (e.currentTarget).value)}
  ></textarea>`;
}

/**
 * Native date/time input.
 * @param {{ id: string, type: 'date'|'time', value: string, onInput: (value: string) => void, invalid?: boolean, big?: boolean, min?: string }} props
 */
export function DateTimeInput({ id, type, value, onInput, invalid = false, big = false, min }) {
  return html`<input
    id=${id}
    class=${`input${big ? ' input-big' : ''}`}
    type=${type}
    value=${value}
    min=${min}
    aria-invalid=${invalid ? 'true' : undefined}
    onInput=${(/** @type {Event} */ e) => onInput(/** @type {HTMLInputElement} */ (e.currentTarget).value)}
    onChange=${(/** @type {Event} */ e) => onInput(/** @type {HTMLInputElement} */ (e.currentTarget).value)}
  />`;
}

/**
 * Seven round weekday toggles in the user's week order.
 * @param {{ value: number[], onChange: (days: number[]) => void, weekStart: 1|7, label: string, names: string[] }} props
 *   names: short weekday names indexed 1..7 (index 0 unused)
 */
export function DayToggles({ value, onChange, weekStart, label, names }) {
  const order = weekStart === 7 ? [7, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7];
  return html`<div class="day-toggles" role="group" aria-label=${label}>
    ${order.map(
      (day) => html`<button
        type="button"
        key=${day}
        aria-pressed=${value.includes(day) ? 'true' : 'false'}
        onClick=${() => onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b))}
      >
        ${names[day]}
      </button>`,
    )}
  </div>`;
}

/**
 * Local form state that marks the sheet page dirty when it differs from the initial value.
 * @template {Record<string, any>} T
 * @param {T} initial
 * @returns {[T, (patch: Partial<T>) => void, () => void]} [value, update, markSaved]
 */
export function useForm(initial) {
  const [value, setValue] = useState(initial);
  const initialJson = useRef(JSON.stringify(initial));
  useEffect(() => {
    setDirty(JSON.stringify(value) !== initialJson.current);
  }, [value]);
  useEffect(() => () => setDirty(false), []);
  const update = (/** @type {Partial<T>} */ patch) => setValue((prev) => ({ ...prev, ...patch }));
  const markSaved = () => {
    initialJson.current = JSON.stringify(value);
    setDirty(false);
  };
  return [value, update, markSaved];
}

/**
 * Full-row checkbox (tap anywhere on the row).
 * @param {{ checked: boolean, label: string, sub?: any, onToggle: () => void, trailing?: any }} props
 */
export function CheckRow({ checked, label, sub, onToggle, trailing }) {
  return html`<div class="row check-row">
    <button type="button" class="row-hit" role="checkbox" aria-checked=${checked ? 'true' : 'false'} onClick=${onToggle}>
      <span class=${`check${checked ? ' on' : ''}`} aria-hidden="true">${checked ? '✓' : ''}</span>
      <span class="main">
        <span class=${`title${checked ? ' done' : ''}`}>${label}</span>
        ${sub && html`<span class="subtitle" style="display:block">${sub}</span>`}
      </span>
    </button>
    ${trailing}
  </div>`;
}

/**
 * Up to 5 tap targets for a 1–5 rating, shown as faces or stars. Tapping the current value clears it.
 * @param {{ value: number|null, onChange: (v: number|null) => void, label: string, symbols?: string[] }} props
 */
export function Rating({ value, onChange, label, symbols = ['★', '★', '★', '★', '★'] }) {
  return html`<div class="rating" role="radiogroup" aria-label=${label}>
    ${symbols.map(
      (symbol, i) => html`<button
        type="button"
        key=${i}
        role="radio"
        aria-checked=${value === i + 1 ? 'true' : 'false'}
        aria-label=${`${i + 1}`}
        class=${value !== null && i < value ? 'on' : ''}
        onClick=${() => onChange(value === i + 1 ? null : i + 1)}
      >
        ${symbol}
      </button>`,
    )}
  </div>`;
}
