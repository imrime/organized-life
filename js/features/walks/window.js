// @ts-check
// Park window (docs/spec/rooms/town.md T4): Walk · History · Places. No GPS — steps and distance are manual.

import { html, useState } from '../../ui/lib.js';
import { t, nameOf, formatDate, formatNumber, formatTime } from '../../core/i18n.js';
import { today, nowTime, splitDuration } from '../../core/time.js';
import { appStore } from '../../core/store.js';
import { PROFILE } from '../../core/schema.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Segmented, Select, Switch, TextInput, TextArea, DateTimeInput, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection, useProfile, useNow } from '../../ui/hooks.js';
import { toast, undoToast } from '../../ui/toast.js';
import { confirmDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { runningWalk, elapsedMin, weekTotals, placeStats, lastPlaceId, validateWalk } from './model.js';
import { startWalk, saveWalk, deleteWalk, savePlace, deletePlace } from './actions.js';

/** @typedef {import('./model.js').Walk} Walk */
/** @typedef {import('./model.js').Place} Place */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

const session = { tab: 'walk' };

/** "1 h 05 min" / "25 min" @param {number} min */
export function durationText(min) {
  const { hours, minutes } = splitDuration(min);
  return hours ? t('time.duration', { hours, minutes: String(minutes).padStart(2, '0') }) : t('time.minutesShort', { minutes });
}

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function WalksWindow({ page, nav }) {
  if (page?.id === 'walk') return html`<${WalkPage} id=${page.params?.id ?? null} nav=${nav} />`;
  if (page?.id === 'place') return html`<${PlacePage} id=${page.params?.id ?? null} nav=${nav} />`;
  return html`<${WalksRoot} nav=${nav} />`;
}

/** @param {{ nav: Nav }} props */
function WalksRoot({ nav }) {
  const [tab, setTab] = useState(session.tab);
  return html`
    <${SheetHeader} title=${t('objects.town.park.name')}>
      <${Segmented} label=${t('walks.sections')} value=${tab}
        options=${[{ value: 'walk', label: t('walks.walk') }, { value: 'history', label: t('walks.history') }, { value: 'places', label: t('walks.places') }]}
        onChange=${(/** @type {string} */ v) => { session.tab = v; setTab(v); }} />
    <//>
    ${tab === 'walk' && html`<${WalkTab} nav=${nav} />`}
    ${tab === 'history' && html`<${HistoryTab} nav=${nav} />`}
    ${tab === 'places' && html`<${PlacesTab} nav=${nav} />`}
  `;
}

/** @param {{ nav: Nav }} props */
function WalkTab({ nav }) {
  const walks = /** @type {Walk[]} */ (/** @type {unknown} */ (useCollection('walks')));
  const places = /** @type {Place[]} */ (/** @type {unknown} */ (useCollection('places')));
  const settings = useProfile(PROFILE.settings);
  const now = useNow(30_000);
  const running = runningWalk(walks);
  const [placeId, setPlaceId] = useState(() => lastPlaceId(walks) ?? places[0]?.id ?? '');
  const week = weekTotals(walks, today(), settings.weekStart ?? 1);
  const placeOptions = [{ value: '', label: t('walks.noPlace') }, ...places.map((p) => ({ value: p.id, label: nameOf(p) }))];

  return html`
    <${SheetBody}>
      ${running
        ? html`<div class="hero">
            <div class="hero-sub">${t('walks.walking')}${running.placeId ? ` · ${nameOf(/** @type {any} */ (appStore.get('places', running.placeId)))}` : ''}</div>
            <div class="hero-big">${durationText(elapsedMin(running, now))}</div>
            <div class="hero-sub">${t('walks.startedAt', { time: formatTime(nowTime(new Date(/** @type {string} */ (running.startedAt)))) })}</div>
          </div>
          <button type="button" class="btn btn-primary wide" onClick=${() => nav.push('walk', { id: running.id })}>${t('walks.finish')}</button>`
        : html`<div class="hero"><div class="hero-art" aria-hidden="true">🌳</div></div>
          <${Field} label=${t('walks.place')}>
            <${Select} value=${placeId} label=${t('walks.place')} options=${placeOptions} onChange=${setPlaceId} />
          <//>
          <button type="button" class="btn btn-primary wide" onClick=${async () => { await startWalk(placeId || null); toast(t('walks.started')); }}>🚶 ${t('walks.start')}</button>`}
      <div class="stat-row" style="margin-top:16px">
        <div class="stat"><span>${t('walks.thisWeek')}</span><b>${durationText(week.minutes)}</b></div>
        <div class="stat"><span>${t('walks.steps')}</span><b>${formatNumber(week.steps)}</b></div>
        <div class="stat"><span>${t('walks.count')}</span><b>${week.count}</b></div>
      </div>
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('walk', { id: null })}>${icon('plus', { size: 20 })} ${t('walks.logPast')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ walk: Walk, onOpen: () => void }} props */
function WalkRow({ walk, onOpen }) {
  const place = walk.placeId ? /** @type {any} */ (appStore.get('places', walk.placeId)) : null;
  const extra = [walk.steps ? t('walks.stepsN', { count: walk.steps }) : '', walk.distanceKm ? `${formatNumber(walk.distanceKm)} km` : ''].filter(Boolean).join(' · ');
  return html`<button type="button" class="row" onClick=${onOpen}>
    <span class="lead" aria-hidden="true">🚶</span>
    <span class="main"><span class="title">${place ? nameOf(place) : t('walks.walk')}</span>
      <span class="subtitle" style="display:block">${formatDate(walk.date, { weekday: 'short', day: 'numeric', month: 'short' })}${extra ? ` · ${extra}` : ''}</span></span>
    <span class="meta">${durationText(walk.durationMin)}</span>
  </button>`;
}

/** @param {{ nav: Nav }} props */
function HistoryTab({ nav }) {
  const walks = /** @type {Walk[]} */ (/** @type {unknown} */ (useCollection('walks')));
  const settings = useProfile(PROFILE.settings);
  const done = walks.filter((w) => w.status === 'done').sort((a, b) => b.date.localeCompare(a.date) || String(b.startedAt).localeCompare(String(a.startedAt)));
  const week = weekTotals(walks, today(), settings.weekStart ?? 1);
  return html`
    <${SheetBody}>
      <p class="summary-line"><b>${t('walks.weekLine', { duration: durationText(week.minutes), steps: formatNumber(week.steps) })}</b></p>
      <div class="group">${done.map((w) => html`<${WalkRow} key=${w.id} walk=${w} onOpen=${() => nav.push('walk', { id: w.id })} />`)}</div>
      ${!done.length && html`<div class="empty"><div class="art" aria-hidden="true">👟</div><p>${t('walks.noWalks')}</p></div>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('walk', { id: null })}>${icon('plus', { size: 20 })} ${t('walks.logPast')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ nav: Nav }} props */
function PlacesTab({ nav }) {
  const places = /** @type {Place[]} */ (/** @type {unknown} */ (useCollection('places')));
  const walks = /** @type {Walk[]} */ (/** @type {unknown} */ (useCollection('walks')));
  const stats = placeStats(walks);
  const sorted = [...places].sort((a, b) => Number(b.favorite) - Number(a.favorite) || (stats.get(b.id)?.visits ?? 0) - (stats.get(a.id)?.visits ?? 0) || nameOf(a).localeCompare(nameOf(b)));
  return html`
    <${SheetBody}>
      <div class="group">
        ${sorted.map((p) => {
          const s = stats.get(p.id);
          return html`<button type="button" class="row" key=${p.id} onClick=${() => nav.push('place', { id: p.id })}>
            <span class="lead" aria-hidden="true">${p.favorite ? '⭐' : '📍'}</span>
            <span class="main"><span class="title">${nameOf(p)}</span>
              <span class="subtitle" style="display:block">${t('walks.visits', { count: s?.visits ?? 0 })}${s?.last ? ` · ${t('walks.lastVisit', { date: formatDate(s.last, { day: 'numeric', month: 'short' }) })}` : ''}</span></span>
            ${icon('chevron')}
          </button>`;
        })}
      </div>
      ${!places.length && html`<div class="empty"><div class="art" aria-hidden="true">📍</div><p>${t('walks.noPlaces')}</p></div>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('place', { id: null })}>${icon('plus', { size: 20 })} ${t('walks.addPlace')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** Finish a running walk, log a past one, or edit a saved one. @param {{ id: string|null, nav: Nav }} props */
function WalkPage({ id, nav }) {
  const walks = /** @type {Walk[]} */ (/** @type {unknown} */ (useCollection('walks')));
  const places = /** @type {Place[]} */ (/** @type {unknown} */ (useCollection('places')));
  const existing = id ? walks.find((w) => w.id === id) : undefined;
  const finishing = existing?.status === 'running';
  const [form, update, markSaved] = useForm({
    date: existing?.date ?? today(),
    startTime: '',
    durationMin: String(existing ? (finishing ? Math.max(1, elapsedMin(existing, new Date())) : existing.durationMin) : 30),
    steps: existing?.steps ?? '',
    distanceKm: existing?.distanceKm ?? '',
    placeId: existing?.placeId ?? lastPlaceId(walks) ?? '',
    notes: existing?.notes ?? '',
  });
  const [tried, setTried] = useState(false);
  const errors = validateWalk(form);
  const ids = { date: useFieldId('w-date'), time: useFieldId('w-time'), dur: useFieldId('w-dur'), steps: useFieldId('w-steps'), km: useFieldId('w-km'), notes: useFieldId('w-notes') };
  const title = finishing ? t('walks.finishTitle') : existing ? t('walks.editWalk') : t('walks.logPast');

  const onSave = async () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    await saveWalk(/** @type {any} */ (form), id);
    markSaved();
    toast(finishing ? t('walks.saved', { duration: durationText(Number(form.durationMin)) }) : t('common.saved'));
    nav.pop();
  };
  const onDelete = async () => {
    if (!id) return;
    const ok = await confirmDialog({ title: t(finishing ? 'walks.discardWalk' : 'walks.deleteWalk'), confirmLabel: t('common.delete'), destructive: true });
    if (!ok) return;
    const { token } = await deleteWalk(id);
    markSaved();
    await nav.pop();
    undoToast(t('walks.deleted'), token);
  };
  const err = (/** @type {string} */ key) => (tried && errors[key] ? t(errors[key]) : undefined);

  return html`
    <${SheetHeader} title=${title} back />
    <${SheetBody}>
      ${!finishing &&
      html`<div class="two-cols">
        <${Field} label=${t('walks.date')} htmlFor=${ids.date} error=${err('date')}>
          <${DateTimeInput} id=${ids.date} type="date" value=${form.date} onInput=${(/** @type {string} */ date) => update({ date })} />
        <//>
        ${!existing && html`<${Field} label=${t('walks.startTime')} htmlFor=${ids.time} optional>
          <${DateTimeInput} id=${ids.time} type="time" value=${form.startTime} onInput=${(/** @type {string} */ startTime) => update({ startTime })} />
        <//>`}
      </div>`}
      <${Field} label=${t('walks.durationMin')} htmlFor=${ids.dur} error=${err('duration')}>
        <${TextInput} id=${ids.dur} type="number" value=${form.durationMin} invalid=${Boolean(err('duration'))} onInput=${(/** @type {string} */ durationMin) => update({ durationMin })} />
      <//>
      <div class="two-cols">
        <${Field} label=${t('walks.steps')} htmlFor=${ids.steps} error=${err('steps')} optional>
          <${TextInput} id=${ids.steps} type="number" value=${String(form.steps ?? '')} onInput=${(/** @type {string} */ steps) => update({ steps })} />
        <//>
        <${Field} label=${t('walks.distance')} htmlFor=${ids.km} error=${err('distance')} optional>
          <${TextInput} id=${ids.km} type="number" value=${String(form.distanceKm ?? '')} onInput=${(/** @type {string} */ distanceKm) => update({ distanceKm })} />
        <//>
      </div>
      <${Field} label=${t('walks.place')}>
        <${Select} value=${form.placeId ?? ''} label=${t('walks.place')} options=${[{ value: '', label: t('walks.noPlace') }, ...places.map((p) => ({ value: p.id, label: nameOf(p) }))]}
          onChange=${(/** @type {string} */ placeId) => update({ placeId })} />
      <//>
      <${Field} label=${t('tasks.fields.notes')} htmlFor=${ids.notes} optional>
        <${TextArea} id=${ids.notes} value=${form.notes} onInput=${(/** @type {string} */ notes) => update({ notes })} />
      <//>
    <//>
    <${SheetFooter}>
      ${id && html`<button type="button" class="btn btn-danger" onClick=${onDelete}>${t('common.delete')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}

/** @param {{ id: string|null, nav: Nav }} props */
function PlacePage({ id, nav }) {
  const places = /** @type {Place[]} */ (/** @type {unknown} */ (useCollection('places')));
  const walks = /** @type {Walk[]} */ (/** @type {unknown} */ (useCollection('walks')));
  const existing = id ? places.find((p) => p.id === id) : undefined;
  const [form, update, markSaved] = useForm({ name: existing ? nameOf(existing) : '', notes: existing?.notes ?? '', favorite: existing?.favorite ?? false });
  const ids = { name: useFieldId('p-name'), notes: useFieldId('p-notes') };
  const here = id ? walks.filter((w) => w.placeId === id && w.status === 'done').sort((a, b) => b.date.localeCompare(a.date)) : [];

  const onSave = async () => {
    if (!form.name.trim()) return;
    const keepSeed = existing?.seedKey && form.name.trim() === nameOf(existing);
    await savePlace({ ...form, name: keepSeed ? '' : form.name }, id);
    markSaved();
    toast(t('common.saved'));
    nav.pop();
  };
  const onDelete = async () => {
    if (!id) return;
    const ok = await confirmDialog({ title: t('walks.deletePlace', { name: nameOf(existing) }), message: t('walks.deletePlaceText'), confirmLabel: t('common.delete'), destructive: true });
    if (!ok) return;
    const { token } = await deletePlace(id);
    markSaved();
    await nav.pop();
    undoToast(t('walks.placeDeleted'), token);
  };
  return html`
    <${SheetHeader} title=${id ? t('walks.editPlace') : t('walks.addPlace')} back />
    <${SheetBody}>
      <${Field} label=${t('tasks.fields.name')} htmlFor=${ids.name}>
        <${TextInput} id=${ids.name} value=${form.name} maxLength=${60} onInput=${(/** @type {string} */ name) => update({ name })} />
      <//>
      <${Field} label=${t('tasks.fields.notes')} htmlFor=${ids.notes} optional>
        <${TextArea} id=${ids.notes} value=${form.notes} onInput=${(/** @type {string} */ notes) => update({ notes })} />
      <//>
      <div class="group"><div class="row"><span class="main title">${t('walks.favorite')}</span>
        <${Switch} label=${t('walks.favorite')} checked=${form.favorite} onChange=${(/** @type {boolean} */ favorite) => update({ favorite })} /></div></div>
      ${here.length > 0 &&
      html`<section class="section"><h3 class="section-title">${t('walks.walksHere', { count: here.length })}</h3>
        <div class="group">${here.map((w) => html`<${WalkRow} key=${w.id} walk=${w} onOpen=${() => nav.push('walk', { id: w.id })} />`)}</div></section>`}
    <//>
    <${SheetFooter}>
      ${id && html`<button type="button" class="btn btn-danger" onClick=${onDelete}>${t('common.delete')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" disabled=${!form.name.trim()} onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}
