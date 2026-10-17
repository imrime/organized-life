// @ts-check
// Bottom sheets with a page stack, integrated with browser history so Back closes pages/sheets
// (docs/spec/03-ux-shell.md §5, docs/spec/02-architecture.md §8).

import { html, useEffect, useRef, useState, useErrorBoundary } from './lib.js';
import { getUi, setUi, useUi } from './ui-state.js';
import { windowEntry } from '../windows.js';
import { buildHash, systemTarget } from '../core/router.js';
import { objectById, slugOf } from '../world/objects.js';
import { confirmDiscard } from './dialog.js';
import { t } from '../core/i18n.js';
import { icon } from './icons.js';

/** @typedef {import('./ui-state.js').SheetState} SheetState */

/** Element to refocus when the sheet closes (normally the object's hit button). */
/** @type {HTMLElement|null} */
let returnFocus = null;
/** Set while we navigate history ourselves, so the dirty guard doesn't ask twice. */
let bypassGuard = false;
let sheetKey = 0;

/** @param {SheetState|null} sheet */
const depthOf = (sheet) => (sheet ? 1 + sheet.pages.length : 0);

/**
 * @param {string} locationId
 * @param {SheetState|null} sheet
 */
function hashFor(locationId, sheet) {
  if (!sheet) return buildHash({ locationId });
  const obj = sheet.sourceObjectId ? objectById(sheet.sourceObjectId) : undefined;
  const target = obj ? slugOf(obj) : systemTarget(sheet.windowId);
  const last = sheet.pages[sheet.pages.length - 1];
  return buildHash({ locationId, target, page: last?.id ?? null, pageId: last?.params?.id ?? null });
}

/** Call once at boot, after the initial location is known. */
export function initHistory() {
  history.replaceState({ depth: 0 }, '', hashFor(getUi().locationId, null));
  window.addEventListener('popstate', onPopState);
}

/** @param {PopStateEvent} event */
async function onPopState(event) {
  const target = event.state?.depth ?? 0;
  const { sheet, locationId } = getUi();
  const current = depthOf(sheet);
  if (target >= current) return;
  if (sheet?.dirty && !bypassGuard) {
    // The browser already went back: restore the entry, then ask before leaving unsaved changes.
    history.pushState({ depth: current }, '', hashFor(locationId, sheet));
    if (!(await confirmDiscard())) return;
    bypassGuard = true;
    history.go(target - current);
    return;
  }
  bypassGuard = false;
  applyDepth(target);
}

/** @param {number} depth */
function applyDepth(depth) {
  const { sheet } = getUi();
  if (!sheet) return;
  if (depth <= 0) {
    setUi({ sheet: null });
    const el = returnFocus;
    returnFocus = null;
    requestAnimationFrame(() => el?.isConnected && el.focus());
  } else {
    setUi({ sheet: { ...sheet, pages: sheet.pages.slice(0, depth - 1), dirty: false } });
  }
}

/**
 * Goes back `levels` history entries and resolves once the state is applied.
 * @param {number} levels
 * @returns {Promise<boolean>}
 */
function goBack(levels) {
  return new Promise((resolve) => {
    const before = depthOf(getUi().sheet);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener('popstate', finish);
      resolve(true);
    };
    bypassGuard = true;
    window.addEventListener('popstate', finish);
    history.go(-levels);
    // Fallback if the browser doesn't deliver popstate (e.g. history was cleared).
    setTimeout(() => {
      if (done) return;
      bypassGuard = false;
      applyDepth(before - levels);
      finish();
    }, 400);
  });
}

/**
 * Opens a window as a bottom sheet (closing any open sheet first).
 * @param {string} windowId
 * @param {{ props?: Record<string, any>, page?: string, params?: Record<string, any>, sourceObjectId?: string|null }} [options]
 */
export async function openWindow(windowId, { props = {}, page, params, sourceObjectId = null } = {}) {
  if (getUi().sheet && !(await closeSheet())) return;
  const active = document.activeElement;
  returnFocus = active instanceof HTMLElement && active !== document.body ? active : null;
  /** @type {SheetState} */
  const sheet = { windowId, props, pages: [], dirty: false, sourceObjectId, key: ++sheetKey };
  const { locationId } = getUi();
  history.pushState({ depth: 1 }, '', hashFor(locationId, sheet));
  setUi({ sheet });
  if (page) pushPage(page, params);
}

/**
 * Closes the open sheet. Asks first when the current page has unsaved changes (unless forced).
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<boolean>} false when the user chose to keep editing
 */
export async function closeSheet({ force = false } = {}) {
  const { sheet } = getUi();
  if (!sheet) return true;
  if (sheet.dirty && !force && !(await confirmDiscard())) return false;
  return goBack(depthOf(sheet));
}

/**
 * @param {string} id page id understood by the window
 * @param {Record<string, any>} [params]
 */
export function pushPage(id, params = {}) {
  const { sheet, locationId } = getUi();
  if (!sheet) return;
  const next = { ...sheet, pages: [...sheet.pages, { id, params }], dirty: false };
  history.pushState({ depth: depthOf(next) }, '', hashFor(locationId, next));
  setUi({ sheet: next });
}

/** Pops the top page (or closes the sheet at the root page). */
export async function popPage() {
  const { sheet } = getUi();
  if (!sheet) return true;
  if (!sheet.pages.length) return closeSheet();
  if (sheet.dirty && !(await confirmDiscard())) return false;
  return goBack(1);
}

/** @param {boolean} dirty */
export function setDirty(dirty) {
  const { sheet } = getUi();
  if (sheet && sheet.dirty !== dirty) setUi({ sheet: { ...sheet, dirty } });
}

/** Navigation helpers handed to every window component. */
export const nav = { open: openWindow, close: closeSheet, push: pushPage, pop: popPage, setDirty };

// ---------------------------------------------------------------------------
// Building blocks used by window modules

/**
 * @param {{ title: string, back?: boolean, children?: any }} props children = optional tabs row
 */
export function SheetHeader({ title, back = false, children }) {
  return html`
    <header class=${`sheet-header${back ? ' has-back' : ''}`}>
      ${back &&
      html`<button type="button" class="icon-button" onClick=${() => popPage()} aria-label=${t('common.back')}>${icon('back')}</button>`}
      <h2 id="sheet-title" class="sheet-title" tabindex="-1">${title}</h2>
      <button type="button" class="icon-button" onClick=${() => closeSheet()} aria-label=${t('common.close')}>${icon('close')}</button>
    </header>
    ${children && html`<div class="sheet-tabs">${children}</div>`}
  `;
}

/** @param {{ children?: any }} props */
export function SheetBody({ children }) {
  return html`<div class="sheet-body">${children}</div>`;
}

/** @param {{ children?: any }} props */
export function SheetFooter({ children }) {
  return html`<footer class="sheet-footer">${children}</footer>`;
}

/** Footer with a single Done button (root pages). */
export function DoneFooter() {
  return html`<${SheetFooter}><span class="grow"></span><button type="button" class="btn btn-primary" onClick=${() => closeSheet()}>
      ${t('common.done')}
    </button><//>`;
}

// ---------------------------------------------------------------------------
// Host

export function SheetHost() {
  const { sheet } = useUi();
  if (!sheet) return null;
  return html`<${SheetFrame} key=${sheet.key} sheet=${sheet} />`;
}

/** @param {{ sheet: SheetState }} props */
function SheetFrame({ sheet }) {
  const entry = windowEntry(sheet.windowId);
  const [Component, setComponent] = useState(/** @type {any} */ (null));
  const [loadError, setLoadError] = useState(/** @type {unknown} */ (null));
  const [dragY, setDragY] = useState(0);
  /** @type {{ current: HTMLElement|null }} */
  const panelRef = useRef(null);
  const drag = useRef(/** @type {{ startY: number, active: boolean }} */ ({ startY: 0, active: false }));
  const page = sheet.pages[sheet.pages.length - 1] ?? null;

  useEffect(() => {
    let alive = true;
    entry
      .load()
      .then((mod) => alive && setComponent(() => mod.default))
      .catch((err) => alive && setLoadError(err));
    return () => {
      alive = false;
    };
  }, [sheet.windowId]);

  // Focus the title when the window or page appears.
  useEffect(() => {
    if (!Component) return;
    requestAnimationFrame(() => panelRef.current?.querySelector('#sheet-title')?.focus?.());
  }, [Component, page?.id, sheet.pages.length]);

  // Escape closes the page/sheet; Tab is trapped inside the panel.
  useEffect(() => {
    /** @param {KeyboardEvent} event */
    const onKey = (event) => {
      if (getUi().dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        popPage();
      } else if (event.key === 'Tab' && panelRef.current) {
        const focusable = /** @type {HTMLElement[]} */ ([
          ...panelRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
        ]).filter((el) => !el.hasAttribute('disabled'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /** Drag to close works from the handle and the header only, so lists keep scrolling normally. */
  /** @param {PointerEvent} event */
  const onPointerDown = (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (target.closest('button, input, select, textarea') || !target.closest('.sheet-handle, .sheet-header')) return;
    drag.current = { startY: event.clientY, active: true };
    /** @type {HTMLElement} */ (event.currentTarget).setPointerCapture(event.pointerId);
  };
  /** @param {PointerEvent} event */
  const onPointerMove = (event) => {
    if (!drag.current.active) return;
    setDragY(Math.max(0, event.clientY - drag.current.startY));
  };
  const onPointerUp = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    if (dragY > 110) closeSheet().then((closed) => !closed && setDragY(0));
    else setDragY(0);
  };

  const props = { ...(entry.props ?? {}), ...sheet.props };

  return html`
    <div class="backdrop" onClick=${() => closeSheet()}></div>
    <section
      class="sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-title"
      data-size=${entry.size}
      ref=${panelRef}
      style=${dragY ? `transform: translateY(${dragY}px); transition: none` : ''}
      onPointerDown=${onPointerDown}
      onPointerMove=${onPointerMove}
      onPointerUp=${onPointerUp}
      onPointerCancel=${onPointerUp}
    >
      <div class="sheet-handle" aria-hidden="true"></div>
      ${loadError
        ? html`<${WindowError} error=${loadError} />`
        : Component
          ? html`<${WindowBoundary}><${Component} props=${props} page=${page} nav=${nav} sheet=${sheet} /><//>`
          : html`<${SheetHeader} title="" /><div class="sheet-skeleton" aria-busy="true"><div></div><div></div><div></div></div>`}
    </section>
  `;
}

/** @param {{ children?: any }} props */
function WindowBoundary({ children }) {
  const [error] = useErrorBoundary((/** @type {unknown} */ err) => console.error('Window crashed', err));
  if (error) return html`<${WindowError} error=${error} />`;
  return children;
}

/** @param {{ error: unknown }} props */
function WindowError({ error }) {
  const details = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  return html`
    <${SheetHeader} title=${t('errors.windowTitle')} />
    <${SheetBody}>
      <p>${t('errors.windowText')}</p>
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => navigator.clipboard?.writeText(details)}>${t('common.copyDetails')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => closeSheet({ force: true })}>${t('common.close')}</button>
    <//>
  `;
}
