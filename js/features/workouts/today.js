// @ts-check
// Workout bench / mat window (docs/spec/rooms/gym.md G1): Today (plan → live session with rest timer) · Plans.

import { html, useEffect, useState } from '../../ui/lib.js';
import { t, nameOf, weekdayNames } from '../../core/i18n.js';
import { today } from '../../core/time.js';
import { matchesQuery } from '../../core/text.js';
import { PROFILE } from '../../core/schema.js';
import { playChime } from '../../core/sound.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Segmented, TextInput, TextArea, DayToggles, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection, useProfile, useNow } from '../../ui/hooks.js';
import { toast, undoToast } from '../../ui/toast.js';
import { confirmDialog, choiceDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { NumberStepper } from '../media/item-page.js';
import { durationText } from '../walks/window.js';
import { plansFor, inProgress, lastSets, defaultRest, substitutes, sessionStats, newRecords, displayWeight, toKg } from './model.js';
import {
  savePlan, setPlanArchived, startSession, updateSet, addSet, removeSet, addExerciseToSession, removeEntry, replaceEntry, saveSessionNotes, finishSession, abandonSession,
} from './actions.js';

/** @typedef {import('./model.js').Exercise} Exercise */
/** @typedef {import('./model.js').WorkoutPlan} WorkoutPlan */
/** @typedef {import('./model.js').WorkoutSession} WorkoutSession */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

const session = { tab: 'today' };

/** Rest timer shared by the session view (ms timestamp when it ends). */
const rest = { until: 0, total: 0, chimed: true };

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function TodayWindow({ page, nav }) {
  if (page?.id === 'plan') return html`<${PlanPage} id=${page.params?.id ?? null} nav=${nav} />`;
  if (page?.id === 'summary') return html`<${SummaryPage} id=${page.params?.id} nav=${nav} />`;
  return html`<${TodayRoot} nav=${nav} />`;
}

/** @param {Exercise|undefined} ex */
export const exName = (ex) => (ex ? nameOf(ex) : '');

/** Weight with unit in the user's system. @param {number|null|undefined} kg @param {'metric'|'imperial'} units */
export function weightText(kg, units) {
  if (!kg) return '';
  return `${displayWeight(kg, units)} ${units === 'imperial' ? 'lb' : 'kg'}`;
}

/** "3 × 10 @ 20 kg · rest 90 s" @param {{ sets: number, reps?: number|null, durationSec?: number|null, weightKg?: number|null, restSec: number }} item @param {'metric'|'imperial'} units */
export function targetText(item, units) {
  const each = item.reps ? `${item.sets} × ${item.reps}` : item.durationSec ? `${item.sets} × ${item.durationSec} s` : `${item.sets} ×`;
  return [each + (item.weightKg ? ` @ ${weightText(item.weightKg, units)}` : ''), t('workouts.restN', { seconds: item.restSec })].join(' · ');
}

/** @param {{ nav: Nav }} props */
function TodayRoot({ nav }) {
  const [tab, setTab] = useState(session.tab);
  return html`
    <${SheetHeader} title=${t('objects.gym.benchMat.name')}>
      <${Segmented} label=${t('workouts.sections')} value=${tab}
        options=${[{ value: 'today', label: t('workouts.today') }, { value: 'plans', label: t('workouts.plans') }]}
        onChange=${(/** @type {string} */ v) => { session.tab = v; setTab(v); }} />
    <//>
    ${tab === 'today' ? html`<${TodayTab} nav=${nav} />` : html`<${PlansTab} nav=${nav} />`}
  `;
}

/** @param {{ nav: Nav }} props */
function TodayTab({ nav }) {
  const sessions = /** @type {WorkoutSession[]} */ (/** @type {unknown} */ (useCollection('workoutSessions')));
  const plans = /** @type {WorkoutPlan[]} */ (/** @type {unknown} */ (useCollection('workoutPlans')));
  const exercises = /** @type {Exercise[]} */ (/** @type {unknown} */ (useCollection('exercises')));
  const settings = useProfile(PROFILE.settings);
  const units = settings.units === 'imperial' ? 'imperial' : 'metric';
  const live = inProgress(sessions);
  if (live) return html`<${SessionView} s=${live} exercises=${exercises} units=${units} nav=${nav} />`;

  const day = today();
  const todays = plansFor(plans, day);
  const done = sessions.find((s) => s.status === 'completed' && s.date === day);
  const byId = (/** @type {string} */ id) => exercises.find((e) => e.id === id);

  const onStart = async (/** @type {string|null} */ planId) => {
    await startSession(planId);
    toast(t('workouts.started'));
  };
  const onChoose = async () => {
    const choice = await choiceDialog({
      title: t('workouts.choosePlan'),
      choices: [...plans.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name })), { value: '__empty', label: t('workouts.emptyWorkout') }],
    });
    if (choice) onStart(choice === '__empty' ? null : choice);
  };

  return html`
    <${SheetBody}>
      ${done && html`<div class="banner ok">✓ ${t('workouts.doneToday', { minutes: sessionStats(done).minutes })}</div>`}
      ${todays.map((p) => html`<section class="card plan-card" key=${p.id}>
        <span class="title">${p.name}</span>
        <div class="group">
          ${p.items.map((item) => {
            const last = lastSets(sessions, item.exerciseId);
            const best = last.length ? last.reduce((a, b) => ((b.weightKg ?? 0) > (a.weightKg ?? 0) ? b : a)) : null;
            return html`<div class="row" key=${item.id}>
              <span class="main"><span class="title">${exName(byId(item.exerciseId))}</span>
                <span class="subtitle" style="display:block">${targetText(item, units)}</span>
                ${best && html`<span class="subtitle" style="display:block">${t('workouts.lastTime', { sets: `${last.length} × ${best.reps ?? best.durationSec ?? ''}${best.weightKg ? ` @ ${weightText(best.weightKg, units)}` : ''}` })}</span>`}</span>
            </div>`;
          })}
        </div>
        <button type="button" class="btn btn-primary wide" style="margin-top:12px" onClick=${() => onStart(p.id)}>▶ ${t('workouts.start')}</button>
      </section>`)}
      ${!todays.length &&
      html`<div class="empty"><div class="art" aria-hidden="true">🧘</div><p>${t('workouts.noPlanToday')}</p>
        <div class="inline">
          ${plans.some((p) => !p.archived) && html`<button type="button" class="btn" onClick=${onChoose}>${t('workouts.choosePlan')}</button>`}
          <button type="button" class="btn" onClick=${() => onStart(null)}>${t('workouts.emptyWorkout')}</button>
        </div></div>`}
    <//>
    <${SheetFooter}>
      ${todays.length > 0 && html`<button type="button" class="btn" onClick=${() => onStart(null)}>${t('workouts.emptyWorkout')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** Sticky rest timer: "Rest 1:24" [−15 s] [+15 s] [Skip]; chimes once at the end. */
function RestBar() {
  const now = useNow(1000);
  const settings = useProfile(PROFILE.settings);
  const left = Math.max(0, Math.ceil((rest.until - now.getTime()) / 1000));
  useEffect(() => {
    if (!left && !rest.chimed) {
      rest.chimed = true;
      playChime(/** @type {number} */ (settings.alarmVolume ?? 0.6));
    }
  }, [left]);
  if (!left) return null;
  const adjust = (/** @type {number} */ sec) => {
    rest.until = Math.max(Date.now(), rest.until + sec * 1000);
  };
  return html`<div class="rest-bar" role="timer" aria-live="off">
    <span class="rest-time">${t('workouts.rest')} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</span>
    <button type="button" class="btn btn-small" onClick=${() => adjust(-15)}>−15 s</button>
    <button type="button" class="btn btn-small" onClick=${() => adjust(15)}>+15 s</button>
    <button type="button" class="btn btn-small" onClick=${() => { rest.until = 0; rest.chimed = true; }}>${t('workouts.skip')}</button>
  </div>`;
}

/** Number input that saves on change (blur / enter). @param {{ value: number|null|undefined, label: string, onSave: (v: number|null) => void, step?: string }} props */
function NumInput({ value, label, onSave, step = 'any' }) {
  return html`<input class="input set-input" type="number" inputmode="decimal" step=${step} min="0" value=${value ?? ''} aria-label=${label} placeholder="–"
    onChange=${(/** @type {Event} */ e) => { const v = /** @type {HTMLInputElement} */ (e.currentTarget).value; onSave(v === '' ? null : Number(v)); }} />`;
}

/** @param {{ s: WorkoutSession, exercises: Exercise[], units: 'metric'|'imperial', nav: Nav }} props */
function SessionView({ s, exercises, units, nav }) {
  const fitness = useProfile(PROFILE.fitness);
  const now = useNow(30_000);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState(s.notes ?? '');
  const byId = (/** @type {string} */ id) => exercises.find((e) => e.id === id);
  const elapsed = sessionStats(s, now).minutes;
  const stale = s.date < today();

  /** @param {import('./model.js').Entry} entry @param {import('./model.js').WorkoutSet} set */
  const toggle = async (entry, set) => {
    await updateSet(s.id, entry.id, set.id, { done: !set.done });
    if (!set.done && entry.restSec) {
      rest.until = Date.now() + entry.restSec * 1000;
      rest.total = entry.restSec;
      rest.chimed = false;
    }
  };
  const onEntryMenu = async (/** @type {import('./model.js').Entry} */ entry) => {
    const ex = byId(entry.exerciseId);
    const subs = ex ? substitutes(ex, exercises, fitness.equipment ?? ['none']) : [];
    const choice = await choiceDialog({
      title: exName(ex),
      choices: [...subs.slice(0, 5).map((x) => ({ value: `sub:${x.id}`, label: t('workouts.replaceWith', { name: exName(x) }) })), { value: 'remove', label: t('workouts.removeExercise'), destructive: true }],
    });
    if (choice === 'remove') removeEntry(s.id, entry.id);
    else if (choice?.startsWith('sub:')) replaceEntry(s.id, entry.id, choice.slice(4));
  };
  const onFinish = async () => {
    await saveSessionNotes(s.id, notes);
    await finishSession(s.id);
    rest.until = 0;
    nav.push('summary', { id: s.id });
  };
  const onAbandon = async () => {
    const ok = await confirmDialog({ title: t('workouts.abandonTitle'), message: t('workouts.abandonText'), confirmLabel: t('workouts.abandon'), destructive: true });
    if (!ok) return;
    const { token } = await abandonSession(s.id);
    rest.until = 0;
    undoToast(t('workouts.abandoned'), token);
  };
  const candidates = exercises.filter((e) => !e.hidden && matchesQuery(exName(e), query)).sort((a, b) => exName(a).localeCompare(exName(b))).slice(0, 12);

  return html`
    <${SheetBody}>
      ${stale && html`<div class="banner warn"><span>${t('workouts.staleSession')}</span></div>`}
      <p class="summary-line"><span>⏱ ${durationText(elapsed)}</span><span>${t('workouts.setsDone', { count: sessionStats(s).sets })}</span></p>
      ${s.entries.map((entry) => {
        const ex = byId(entry.exerciseId);
        const metric = ex?.metric ?? 'reps';
        return html`<section class="card entry-card" key=${entry.id}>
          <div class="section-head"><span class="title">${exName(ex)}</span>
            <button type="button" class="icon-button" aria-label=${t('workouts.exerciseActions', { name: exName(ex) })} onClick=${() => onEntryMenu(entry)}>⋯</button></div>
          <div class="set-grid">
            <span class="set-head">#</span>
            ${metric === 'reps' && html`<span class="set-head">${t('workouts.reps')}</span><span class="set-head">${units === 'imperial' ? 'lb' : 'kg'}</span>`}
            ${metric === 'time' && html`<span class="set-head">${t('workouts.seconds')}</span><span class="set-head"></span>`}
            ${metric === 'distance' && html`<span class="set-head">km</span><span class="set-head">${t('workouts.minutes')}</span>`}
            <span class="set-head">✓</span>
            ${entry.sets.map((set, i) => html`
              <span class="set-n" key=${`n${set.id}`}>${i + 1}</span>
              ${metric === 'reps' && html`<${NumInput} key=${`r${set.id}`} value=${set.reps} step="1" label=${t('workouts.repsOfSet', { n: i + 1 })} onSave=${(/** @type {number|null} */ reps) => updateSet(s.id, entry.id, set.id, { reps })} />
                <${NumInput} key=${`w${set.id}`} value=${set.weightKg ? displayWeight(set.weightKg, units) : null} label=${t('workouts.weightOfSet', { n: i + 1 })} onSave=${(/** @type {number|null} */ v) => updateSet(s.id, entry.id, set.id, { weightKg: v === null ? null : toKg(v, units) })} />`}
              ${metric === 'time' && html`<${NumInput} key=${`d${set.id}`} value=${set.durationSec} step="1" label=${t('workouts.secondsOfSet', { n: i + 1 })} onSave=${(/** @type {number|null} */ durationSec) => updateSet(s.id, entry.id, set.id, { durationSec })} /><span></span>`}
              ${metric === 'distance' && html`<${NumInput} key=${`k${set.id}`} value=${set.distanceM ? set.distanceM / 1000 : null} label=${t('workouts.kmOfSet', { n: i + 1 })} onSave=${(/** @type {number|null} */ v) => updateSet(s.id, entry.id, set.id, { distanceM: v === null ? null : Math.round(v * 1000) })} />
                <${NumInput} key=${`m${set.id}`} value=${set.durationSec ? Math.round(set.durationSec / 60) : null} step="1" label=${t('workouts.minutesOfSet', { n: i + 1 })} onSave=${(/** @type {number|null} */ v) => updateSet(s.id, entry.id, set.id, { durationSec: v === null ? null : v * 60 })} />`}
              <button type="button" key=${`c${set.id}`} class=${`check${set.done ? ' on' : ''}`} role="checkbox" aria-checked=${set.done ? 'true' : 'false'} aria-label=${t('workouts.setDone', { n: i + 1 })} onClick=${() => toggle(entry, set)}>${set.done ? '✓' : ''}</button>
            `)}
          </div>
          <div class="inline" style="margin-top:8px">
            <button type="button" class="btn btn-small" onClick=${() => addSet(s.id, entry.id)}>${icon('plus', { size: 16 })} ${t('workouts.addSet')}</button>
            ${entry.sets.length > 1 && html`<button type="button" class="btn btn-small btn-ghost" onClick=${() => removeSet(s.id, entry.id, entry.sets[entry.sets.length - 1].id)}>− ${t('workouts.removeSet')}</button>`}
            <span class="field-help">${t('workouts.restN', { seconds: entry.restSec })}</span>
          </div>
        </section>`;
      })}
      ${!s.entries.length && html`<p class="empty small">${t('workouts.noExercisesYet')}</p>`}
      ${picking
        ? html`<section class="section">
            <input class="input search" type="search" value=${query} placeholder=${t('workouts.searchExercises')} aria-label=${t('workouts.searchExercises')}
              onInput=${(/** @type {Event} */ e) => setQuery(/** @type {HTMLInputElement} */ (e.currentTarget).value)} />
            <div class="group" style="margin-top:8px">${candidates.map((e) => html`<button type="button" class="row" key=${e.id} onClick=${async () => { await addExerciseToSession(e.id); setPicking(false); setQuery(''); }}>
              <span class="main"><span class="title">${exName(e)}</span></span>${icon('plus', { size: 20 })}</button>`)}</div>
          </section>`
        : html`<button type="button" class="btn" onClick=${() => setPicking(true)}>${icon('plus', { size: 18 })} ${t('workouts.addExercise')}</button>`}
      <${Field} label=${t('tasks.fields.notes')} optional>
        <${TextArea} value=${notes} rows=${2} onInput=${setNotes} />
      <//>
    <//>
    <${RestBar} />
    <${SheetFooter}>
      <button type="button" class="btn btn-danger" onClick=${onAbandon}>${t('workouts.abandon')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${onFinish}>${t('workouts.finish')}</button>
    <//>
  `;
}

/** @param {{ id: string, nav: Nav }} props */
function SummaryPage({ id, nav }) {
  const sessions = /** @type {WorkoutSession[]} */ (/** @type {unknown} */ (useCollection('workoutSessions')));
  const exercises = /** @type {Exercise[]} */ (/** @type {unknown} */ (useCollection('exercises')));
  const settings = useProfile(PROFILE.settings);
  const units = settings.units === 'imperial' ? 'imperial' : 'metric';
  const s = sessions.find((x) => x.id === id);
  if (!s) return null;
  const stats = sessionStats(s);
  const prs = newRecords(s, sessions);
  const ex = (/** @type {string} */ exId) => exName(exercises.find((e) => e.id === exId));
  /** @param {{ kind: string, value: number }} r */
  const valueText = (r) => (r.kind === 'maxReps' ? t('workouts.repsN', { count: r.value }) : r.kind === 'maxDuration' ? `${r.value} s` : weightText(r.value, units));
  return html`
    <${SheetHeader} title=${t('workouts.summary')} />
    <${SheetBody}>
      <div class="hero"><div class="hero-art" aria-hidden="true">💪</div><div class="hero-sub">${t('workouts.wellDone')}</div></div>
      <div class="stat-row">
        <div class="stat"><span>${t('workouts.duration')}</span><b>${durationText(stats.minutes)}</b></div>
        <div class="stat"><span>${t('workouts.sets')}</span><b>${stats.sets}</b></div>
        <div class="stat"><span>${t('workouts.volume')}</span><b>${weightText(stats.volume, units) || '—'}</b></div>
      </div>
      ${prs.length > 0 &&
      html`<section class="section"><h3 class="section-title">🎉 ${t('workouts.newRecords')}</h3>
        <div class="group">${prs.map((r) => html`<div class="row" key=${`${r.exerciseId}${r.kind}`}><span class="main"><span class="title">${ex(r.exerciseId)}</span>
          <span class="subtitle" style="display:block">${t(`workouts.recordKinds.${r.kind}`)}</span></span><span class="meta">${valueText(r)}</span></div>`)}</div></section>`}
    <//>
    <${SheetFooter}><span class="grow"></span><button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button><//>
  `;
}

/** @param {{ nav: Nav }} props */
function PlansTab({ nav }) {
  const plans = /** @type {WorkoutPlan[]} */ (/** @type {unknown} */ (useCollection('workoutPlans')));
  const [archived, setArchived] = useState(false);
  const names = weekdayNames('short');
  const list = plans.filter((p) => p.archived === archived).sort((a, b) => a.name.localeCompare(b.name));
  return html`
    <${SheetBody}>
      <div class="group">
        ${list.map((p) => html`<button type="button" class="row" key=${p.id} onClick=${() => nav.push('plan', { id: p.id })}>
          <span class="lead" aria-hidden="true">🏋️</span>
          <span class="main"><span class="title">${p.name}</span>
            <span class="subtitle" style="display:block">${[p.days.map((d) => names[d]).join(', ') || t('workouts.anyDay'), t('workouts.exercisesN', { count: p.items.length })].join(' · ')}</span></span>
          ${icon('chevron')}
        </button>`)}
      </div>
      ${!list.length && html`<div class="empty"><div class="art" aria-hidden="true">📋</div><p>${t(archived ? 'workouts.noArchived' : 'workouts.noPlans')}</p></div>`}
      ${(archived || plans.some((p) => p.archived)) && html`<button type="button" class="btn btn-ghost" onClick=${() => setArchived(!archived)}>${t(archived ? 'tasks.showActive' : 'tasks.showArchived')}</button>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('plan', { id: null })}>${icon('plus', { size: 20 })} ${t('workouts.newPlan')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ id: string|null, nav: Nav }} props */
function PlanPage({ id, nav }) {
  const plans = /** @type {WorkoutPlan[]} */ (/** @type {unknown} */ (useCollection('workoutPlans')));
  const exercises = /** @type {Exercise[]} */ (/** @type {unknown} */ (useCollection('exercises')));
  const settings = useProfile(PROFILE.settings);
  const units = settings.units === 'imperial' ? 'imperial' : 'metric';
  const existing = id ? plans.find((p) => p.id === id) : undefined;
  const [form, update, markSaved] = useForm({ name: existing?.name ?? '', days: existing?.days ?? /** @type {number[]} */ ([]), items: (existing?.items ?? []).map((i) => ({ ...i })), notes: existing?.notes ?? '' });
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const ids = { name: useFieldId('pl-name'), notes: useFieldId('pl-notes') };
  const byId = (/** @type {string} */ x) => exercises.find((e) => e.id === x);

  /** @param {number} i @param {Record<string, any>} patch */
  const change = (i, patch) => update({ items: form.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });
  /** @param {number} i @param {number} dir */
  const move = (i, dir) => {
    const items = [...form.items];
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    update({ items });
  };
  const add = (/** @type {Exercise} */ ex) => {
    update({ items: [...form.items, { id: `new-${Date.now()}`, exerciseId: ex.id, sets: 3, reps: ex.metric === 'reps' ? 10 : null, durationSec: ex.metric === 'time' ? 60 : null, weightKg: null, restSec: defaultRest(ex) }] });
    setPicking(false);
    setQuery('');
  };
  const onSave = async () => {
    if (!form.name.trim()) return;
    await savePlan({ ...form, items: form.items.map((i) => ({ ...i, id: String(i.id).startsWith('new-') ? /** @type {any} */ (undefined) : i.id })) }, id);
    markSaved();
    toast(t('common.saved'));
    nav.pop();
  };
  const onArchive = async () => {
    if (!id || !existing) return;
    await setPlanArchived(id, !existing.archived);
    markSaved();
    nav.pop();
  };
  const candidates = exercises.filter((e) => !e.hidden && matchesQuery(exName(e), query)).sort((a, b) => exName(a).localeCompare(exName(b))).slice(0, 12);

  return html`
    <${SheetHeader} title=${id ? existing?.name ?? '' : t('workouts.newPlan')} back />
    <${SheetBody}>
      <${Field} label=${t('tasks.fields.name')} htmlFor=${ids.name}>
        <${TextInput} id=${ids.name} value=${form.name} maxLength=${60} placeholder=${t('workouts.planPlaceholder')} onInput=${(/** @type {string} */ name) => update({ name })} autoFocus=${!id} />
      <//>
      <${Field} label=${t('workouts.scheduledDays')} optional>
        <${DayToggles} label=${t('workouts.scheduledDays')} value=${form.days} weekStart=${settings.weekStart ?? 1} names=${weekdayNames('short')} onChange=${(/** @type {number[]} */ days) => update({ days })} />
      <//>
      <section class="section">
        <h3 class="section-title">${t('workouts.exercisesN', { count: form.items.length })}</h3>
        ${form.items.map((it, i) => {
          const ex = byId(it.exerciseId);
          return html`<div class="card plan-item" key=${it.id}>
            <div class="section-head"><span class="title">${exName(ex)}</span>
              <span>
                <button type="button" class="icon-button" aria-label=${t('common.moveUp')} disabled=${i === 0} onClick=${() => move(i, -1)}>↑</button>
                <button type="button" class="icon-button" aria-label=${t('common.moveDown')} disabled=${i === form.items.length - 1} onClick=${() => move(i, 1)}>↓</button>
                <button type="button" class="icon-button" aria-label=${t('common.delete')} onClick=${() => update({ items: form.items.filter((_, k) => k !== i) })}>${icon('close', { size: 18 })}</button>
              </span></div>
            <div class="plan-fields">
              <label>${t('workouts.sets')}<${NumberStepper} label=${t('workouts.sets')} value=${it.sets} min=${1} onChange=${(/** @type {number} */ sets) => change(i, { sets: Math.min(20, sets) })} /></label>
              ${ex?.metric === 'time'
                ? html`<label>${t('workouts.seconds')}<input class="input set-input" type="number" min="0" value=${it.durationSec ?? ''} onChange=${(/** @type {Event} */ e) => change(i, { durationSec: Number(/** @type {HTMLInputElement} */ (e.currentTarget).value) || null })} /></label>`
                : ex?.metric === 'reps' && html`<label>${t('workouts.reps')}<input class="input set-input" type="number" min="0" value=${it.reps ?? ''} onChange=${(/** @type {Event} */ e) => change(i, { reps: Number(/** @type {HTMLInputElement} */ (e.currentTarget).value) || null })} /></label>`}
              ${ex?.type === 'strength' && ex.metric === 'reps' &&
              html`<label>${units === 'imperial' ? 'lb' : 'kg'}<input class="input set-input" type="number" min="0" step="any" value=${it.weightKg ? displayWeight(it.weightKg, units) : ''}
                onChange=${(/** @type {Event} */ e) => { const v = /** @type {HTMLInputElement} */ (e.currentTarget).value; change(i, { weightKg: v ? toKg(Number(v), units) : null }); }} /></label>`}
              <label>${t('workouts.restSec')}<input class="input set-input" type="number" min="0" step="15" value=${it.restSec} onChange=${(/** @type {Event} */ e) => change(i, { restSec: Number(/** @type {HTMLInputElement} */ (e.currentTarget).value) || 0 })} /></label>
            </div>
          </div>`;
        })}
        ${picking
          ? html`<input class="input search" type="search" value=${query} placeholder=${t('workouts.searchExercises')} aria-label=${t('workouts.searchExercises')}
              onInput=${(/** @type {Event} */ e) => setQuery(/** @type {HTMLInputElement} */ (e.currentTarget).value)} />
            <div class="group" style="margin-top:8px">${candidates.map((e) => html`<button type="button" class="row" key=${e.id} onClick=${() => add(e)}>
              <span class="main"><span class="title">${exName(e)}</span></span>${icon('plus', { size: 20 })}</button>`)}</div>`
          : html`<button type="button" class="btn" onClick=${() => setPicking(true)}>${icon('plus', { size: 18 })} ${t('workouts.addExercise')}</button>`}
      </section>
      <${Field} label=${t('tasks.fields.notes')} htmlFor=${ids.notes} optional><${TextArea} id=${ids.notes} value=${form.notes} onInput=${(/** @type {string} */ notes) => update({ notes })} /><//>
    <//>
    <${SheetFooter}>
      ${id && html`<button type="button" class="btn" onClick=${onArchive}>${existing?.archived ? t('study.restore') : t('study.archive')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" disabled=${!form.name.trim()} onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}
