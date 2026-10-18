// @ts-check
// Washing machine window (docs/spec/rooms/bathroom.md BA4): running/done card, queue, start page.

import { html, useEffect } from '../../ui/lib.js';
import { t, nameOf, formatTime } from '../../core/i18n.js';
import { nowTime } from '../../core/time.js';
import { appStore } from '../../core/store.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Segmented, Select, ProgressRing, useForm } from '../../ui/controls.js';
import { useCollection, useNow } from '../../ui/hooks.js';
import { toast, undoToast } from '../../ui/toast.js';
import { confirmDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { openObject } from '../../ui/navigation.js';
import { CYCLES, LOAD_TYPES, TEMPERATURES, cycleFor, loadStatus, minutesLeft, loadProgress, activeLoad, queuedLoads, laundrySummary } from './model.js';
import { settleLoads, saveLoad, finishNow, cancelLoad, unloadLoad, removeFromLoad } from './actions.js';

/** @typedef {import('./model.js').LaundryLoad} LaundryLoad */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function MachineWindow({ page, nav }) {
  if (page?.id === 'start') return html`<${StartPage} id=${page.params?.id} nav=${nav} />`;
  return html`<${MachineRoot} nav=${nav} />`;
}

/** Clock time of an ISO timestamp in the user's format. @param {string|null|undefined} iso */
const clock = (iso) => (iso ? formatTime(nowTime(new Date(iso))) : '');

/** Names of everything in a load. @param {LaundryLoad} load */
function loadNames(load) {
  return [
    ...load.itemIds.map((id) => ({ id, kind: /** @type {const} */ ('item'), name: nameOf(/** @type {any} */ (appStore.get('clothingItems', id))) })),
    ...load.extraIds.map((id) => ({ id, kind: /** @type {const} */ ('extra'), name: nameOf(/** @type {any} */ (appStore.get('laundryExtras', id))) })),
  ].filter((e) => e.name);
}

/** @param {LaundryLoad} load */
const loadLine = (load) =>
  `${t(`laundry.loadTypes.${load.loadType}`)} · ${t(`laundry.cycles.${load.cycle}`)} · ${load.temperatureC} °C`;

/** @param {{ nav: Nav }} props */
function MachineRoot({ nav }) {
  const loads = /** @type {LaundryLoad[]} */ (/** @type {unknown} */ (useCollection('laundryLoads')));
  const clothes = /** @type {any[]} */ (useCollection('clothingItems'));
  const extras = /** @type {any[]} */ (useCollection('laundryExtras'));
  const now = useNow(15_000);
  useEffect(() => {
    settleLoads();
  }, []);

  const active = activeLoad(loads);
  const state = active ? loadStatus(active, now) : null;
  const queue = queuedLoads(loads);
  const summary = laundrySummary(clothes, extras);

  const onCancel = async (/** @type {LaundryLoad} */ load) => {
    const ok = await confirmDialog({ title: t('laundry.cancelTitle'), message: t('laundry.cancelText'), confirmLabel: t('laundry.cancelLoad'), destructive: true });
    if (!ok) return;
    const { token } = await cancelLoad(load.id);
    undoToast(t('laundry.cancelled'), token);
  };
  const onUnload = async (/** @type {LaundryLoad} */ load) => {
    const { token, result } = await unloadLoad(load.id);
    undoToast(t('laundry.unloaded', { count: /** @type {number} */ (result) }), token);
  };

  return html`
    <${SheetHeader} title=${t('objects.bathroom.washingMachine.name')} />
    <${SheetBody}>
      <p class="field-help summary-line">${t('laundry.summary', summary)}</p>
      ${active && state === 'running' &&
      html`<div class="card machine-card">
        <${ProgressRing} value=${loadProgress(active, now)} label=${t('laundry.progress')}>
          <b>${minutesLeft(active, now)}</b><span>${t('laundry.minShort')}</span>
        <//>
        <div class="machine-info">
          <div class="title">${t('laundry.running')}</div>
          <div class="subtitle">${loadLine(active)}</div>
          <div class="subtitle">${t('laundry.endsAt', { time: clock(active.finishesAt) })} · ${t('laundry.itemsCount', { count: active.itemIds.length + active.extraIds.length })}</div>
        </div>
      </div>
      <div class="inline" style="margin:12px 0">
        <button type="button" class="btn wide" onClick=${() => finishNow(active.id)}>${t('laundry.finishNow')}</button>
        <button type="button" class="btn wide btn-danger-text" onClick=${() => onCancel(active)}>${t('laundry.cancelLoad')}</button>
      </div>`}
      ${active && state === 'done' &&
      html`<div class="card machine-card done">
        <div class="done-mark" aria-hidden="true">✓</div>
        <div class="machine-info">
          <div class="title">${t('laundry.finishedAt', { time: clock(active.finishedAt ?? active.finishesAt) })}</div>
          <div class="subtitle">${loadNames(active).map((e) => e.name).join(', ')}</div>
        </div>
      </div>
      <button type="button" class="btn btn-primary wide" style="margin:12px 0" onClick=${() => onUnload(active)}>${t('laundry.unload')}</button>`}

      ${queue.length > 0 &&
      html`<section class="section">
        <h3 class="section-title">${t('laundry.queue')}</h3>
        <div class="group">
          ${queue.map((l) => html`<button type="button" class="row" key=${l.id} onClick=${() => nav.push('start', { id: l.id })}>
            <span class="lead" aria-hidden="true">🧺</span>
            <span class="main"><span class="title">${t(`laundry.loadTypes.${l.loadType}`)}</span>
              <span class="subtitle" style="display:block">${t('laundry.itemsCount', { count: l.itemIds.length + l.extraIds.length })} · ${t(`laundry.cycles.${l.cycle}`)}</span></span>
            ${icon('chevron')}
          </button>`)}
        </div>
      </section>`}

      ${!active && !queue.length &&
      html`<div class="empty"><div class="art" aria-hidden="true">🫧</div><p>${t('laundry.machineEmpty')}</p>
        <button type="button" class="btn" onClick=${() => openObject('bathroom.laundry-basket')}>${t('laundry.openBasket')}</button></div>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => openObject('bathroom.laundry-basket')}>🧺 ${t('laundry.openBasket')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ id: string, nav: Nav }} props */
function StartPage({ id, nav }) {
  const loads = /** @type {LaundryLoad[]} */ (/** @type {unknown} */ (useCollection('laundryLoads')));
  useCollection('clothingItems');
  const load = loads.find((l) => l.id === id);
  const [form, update, markSaved] = useForm({
    loadType: load?.loadType ?? 'mixed',
    cycle: load?.cycle ?? 'cotton',
    temperatureC: load?.temperatureC ?? 40,
    durationMin: load?.durationMin ?? 150,
  });
  if (!load || load.status !== 'queued') return html`<${SheetHeader} title=${t('laundry.startTitle')} back /><${SheetBody}><p class="empty">${t('laundry.loadGone')}</p><//>`;
  const busy = Boolean(activeLoad(loads));
  const entries = loadNames(load);

  const onSave = async (/** @type {boolean} */ start) => {
    const settings = { ...form, loadType: /** @type {any} */ (form.loadType), cycle: /** @type {any} */ (form.cycle) };
    const { result } = await saveLoad(load.id, settings, start);
    markSaved();
    if (result === 'busy') toast(t('laundry.busy'));
    else if (result === 'started') toast(t('laundry.started', { time: clock(new Date(Date.now() + form.durationMin * 60_000).toISOString()) }));
    else toast(t('common.saved'));
    nav.pop();
  };
  const onDelete = async () => {
    const { token } = await cancelLoad(load.id);
    markSaved();
    await nav.pop();
    undoToast(t('laundry.cancelled'), token);
  };

  return html`
    <${SheetHeader} title=${t('laundry.startTitle')} back />
    <${SheetBody}>
      <${Field} label=${t('laundry.loadType')}>
        <${Select} value=${form.loadType} label=${t('laundry.loadType')} options=${LOAD_TYPES.map((v) => ({ value: v, label: t(`laundry.loadTypes.${v}`) }))}
          onChange=${(/** @type {any} */ loadType) => { const cycle = cycleFor(loadType); update({ loadType, cycle, ...CYCLES[cycle] }); }} />
      <//>
      <${Field} label=${t('laundry.cycle')}>
        <${Select} value=${form.cycle} label=${t('laundry.cycle')} options=${Object.keys(CYCLES).map((v) => ({ value: v, label: t(`laundry.cycles.${v}`) }))}
          onChange=${(/** @type {any} */ cycle) => update({ cycle, ...CYCLES[/** @type {keyof typeof CYCLES} */ (cycle)] })} />
      <//>
      <${Field} label=${t('laundry.temperature')}>
        <${Segmented} label=${t('laundry.temperature')} value=${form.temperatureC} options=${TEMPERATURES.map((v) => ({ value: v, label: `${v}°` }))}
          onChange=${(/** @type {number} */ temperatureC) => update({ temperatureC })} />
      <//>
      <${Field} label=${t('laundry.duration')}>
        <div class="stepper big" role="group" aria-label=${t('laundry.duration')}>
          <button type="button" aria-label=${t('inventory.less')} onClick=${() => update({ durationMin: Math.max(5, form.durationMin - 5) })}>−</button>
          <span class="stepper-value">${t('time.minutesShort', { minutes: form.durationMin })}</span>
          <button type="button" aria-label=${t('inventory.more')} onClick=${() => update({ durationMin: Math.min(300, form.durationMin + 5) })}>+</button>
        </div>
      <//>
      <section class="section">
        <h3 class="section-title">${t('laundry.items')} (${entries.length})</h3>
        <div class="group">
          ${entries.map((e) => html`<div class="row" key=${e.id}>
            <span class="main"><span class="title">${e.name}</span></span>
            <button type="button" class="icon-button" aria-label=${t('laundry.backToBasket', { name: e.name })} onClick=${() => removeFromLoad(load.id, e.id, e.kind)}>${icon('close', { size: 18 })}</button>
          </div>`)}
        </div>
      </section>
      ${busy && html`<p class="banner warn small">${t('laundry.busy')}</p>`}
      <button type="button" class="btn btn-danger-text" onClick=${onDelete}>${t('laundry.cancelLoad')}</button>
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => onSave(false)}>${t('laundry.keepQueued')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" disabled=${busy} onClick=${() => onSave(true)}>${t('laundry.startNow')}</button>
    <//>
  `;
}
