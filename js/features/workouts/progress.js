// @ts-check
// Progress board window (docs/spec/rooms/gym.md G3): Consistency · History · Records · Trends.

import { html, useState } from '../../ui/lib.js';
import { t, formatDate, weekdayNames } from '../../core/i18n.js';
import { today, addDays } from '../../core/time.js';
import { PROFILE } from '../../core/schema.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Segmented, Select, ProgressRing } from '../../ui/controls.js';
import { useCollection, useProfile } from '../../ui/hooks.js';
import { undoToast } from '../../ui/toast.js';
import { confirmDialog } from '../../ui/dialog.js';
import { LineChart, BarChart } from '../../ui/charts.js';
import { NumberStepper } from '../media/item-page.js';
import { durationText } from '../walks/window.js';
import { goalWeeks } from '../achievements/model.js';
import { completed, records, sessionStats, weeklyCounts, weeklyVolume, heatmap, trend, displayWeight, toKg } from './model.js';
import { setWeeklyGoal, deleteSession, updateSet } from './actions.js';
import { exName, weightText } from './today.js';

/** @typedef {import('./model.js').WorkoutSession} WorkoutSession */
/** @typedef {import('./model.js').Exercise} Exercise */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

const session = { tab: 'consistency', exerciseId: '', mode: /** @type {'top'|'1rm'} */ ('1rm') };

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function ProgressWindow({ page, nav }) {
  if (page?.id === 'session') return html`<${SessionDetail} id=${page.params?.id} nav=${nav} />`;
  return html`<${ProgressRoot} nav=${nav} />`;
}

/** @param {{ nav: Nav }} props */
function ProgressRoot({ nav }) {
  const [tab, setTab] = useState(session.tab);
  return html`
    <${SheetHeader} title=${t('objects.gym.progressBoard.name')}>
      <${Segmented} label=${t('workouts.sections')} value=${tab}
        options=${['consistency', 'history', 'records', 'trends'].map((v) => ({ value: v, label: t(`workouts.progressTabs.${v}`) }))}
        onChange=${(/** @type {string} */ v) => { session.tab = v; setTab(v); }} />
    <//>
    <${SheetBody}>
      ${tab === 'consistency' && html`<${Consistency} />`}
      ${tab === 'history' && html`<${History} nav=${nav} />`}
      ${tab === 'records' && html`<${RecordsTab} />`}
      ${tab === 'trends' && html`<${Trends} />`}
    <//>
    <${SheetFooter}><span class="grow"></span><button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button><//>
  `;
}

function Consistency() {
  const sessions = /** @type {WorkoutSession[]} */ (/** @type {unknown} */ (useCollection('workoutSessions')));
  const walks = /** @type {any[]} */ (useCollection('walks'));
  const fitness = useProfile(PROFILE.fitness);
  const settings = useProfile(PROFILE.settings);
  const weekStart = settings.weekStart ?? 1;
  const goal = fitness.weeklyGoal ?? 3;
  const day = today();
  const thisWeek = weeklyCounts(sessions, day, weekStart, 1)[0].count;
  const streak = goalWeeks(completed(sessions).map((s) => s.date), goal, day, weekStart);
  const grid = heatmap(sessions, walks, day, weekStart);
  const names = weekdayNames('narrow');
  const rowDays = Array.from({ length: 7 }, (_, i) => ((weekStart === 7 ? 6 : 0) + i) % 7 + 1);
  return html`
    <div class="consistency">
      <${ProgressRing} value=${thisWeek / goal} size=${140} label=${t('workouts.thisWeekOf', { count: thisWeek, goal })}>
        <b>${thisWeek}/${goal}</b><span>${t('workouts.thisWeek')}</span>
      <//>
      <div>
        <p class="title">${t('workouts.thisWeekOf', { count: thisWeek, goal })}</p>
        <p class="field-help">${streak ? t('workouts.weeksInARow', { count: streak }) : t('workouts.startStreak')}</p>
        <div class="inline"><span class="field-help">${t('workouts.weeklyGoal')}</span>
          <${NumberStepper} label=${t('workouts.weeklyGoal')} value=${goal} min=${1} onChange=${(/** @type {number} */ n) => setWeeklyGoal(n)} /></div>
      </div>
    </div>
    <section class="section">
      <h3 class="section-title">${t('workouts.last12Weeks')}</h3>
      <div class="heatmap" role="img" aria-label=${t('workouts.heatmapSummary', { workouts: grid.flat().filter((c) => c.level === 'workout').length, walks: grid.flat().filter((c) => c.level === 'walk').length })}>
        <div class="heat-col heat-labels">${rowDays.map((d) => html`<span key=${d}>${names[d]}</span>`)}</div>
        ${grid.map((col, i) => html`<div class="heat-col" key=${i}>${col.map((c) => html`<span key=${c.date} class=${`heat ${c.level}`} title=${c.date}></span>`)}</div>`)}
      </div>
      <p class="field-help"><span class="heat workout inline-dot"></span> ${t('workouts.legendWorkout')} · <span class="heat walk inline-dot"></span> ${t('workouts.legendWalk')}</p>
    </section>
  `;
}

/** @param {{ nav: Nav }} props */
function History({ nav }) {
  const sessions = /** @type {WorkoutSession[]} */ (/** @type {unknown} */ (useCollection('workoutSessions')));
  const plans = /** @type {any[]} */ (useCollection('workoutPlans'));
  const settings = useProfile(PROFILE.settings);
  const units = settings.units === 'imperial' ? 'imperial' : 'metric';
  const list = completed(sessions).sort((a, b) => b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt));
  return html`
    <div class="group">${list.map((s) => {
      const st = sessionStats(s);
      return html`<button type="button" class="row" key=${s.id} onClick=${() => nav.push('session', { id: s.id })}>
        <span class="lead" aria-hidden="true">💪</span>
        <span class="main"><span class="title">${plans.find((p) => p.id === s.planId)?.name ?? t('workouts.workout')}</span>
          <span class="subtitle" style="display:block">${formatDate(s.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${durationText(st.minutes)} · ${t('workouts.setsN', { count: st.sets })}${st.volume ? ` · ${weightText(st.volume, units)}` : ''}</span></span>
      </button>`;
    })}</div>
    ${!list.length && html`<div class="empty"><div class="art" aria-hidden="true">📈</div><p>${t('workouts.noHistory')}</p></div>`}
  `;
}

function RecordsTab() {
  const sessions = /** @type {WorkoutSession[]} */ (/** @type {unknown} */ (useCollection('workoutSessions')));
  const exercises = /** @type {Exercise[]} */ (/** @type {unknown} */ (useCollection('exercises')));
  const settings = useProfile(PROFILE.settings);
  const units = settings.units === 'imperial' ? 'imperial' : 'metric';
  const recent = addDays(today(), -6);
  const map = records(sessions);
  const rows = [...map.entries()].map(([id, r]) => ({ id, ex: exercises.find((e) => e.id === id), r })).filter((x) => x.ex).sort((a, b) => exName(a.ex).localeCompare(exName(b.ex)));
  /** @param {{ value: number, date: string }|null} v @param {(n: number) => string} fmt @param {string} label */
  const cell = (v, fmt, label) => (v ? html`<span class="record"><small>${label}</small><b>${fmt(v.value)}</b>${v.date >= recent ? html`<span class="stock-pill ok">${t('workouts.new')}</span>` : ''}</span>` : null);
  return html`
    <div class="group">${rows.map(({ id, ex, r }) => html`<div class="row record-row" key=${id}>
      <span class="main"><span class="title">${exName(ex)}</span>
        <span class="records">
          ${cell(r.maxWeight, (n) => weightText(n, units), t('workouts.recordKinds.maxWeight'))}
          ${cell(r.best1RM, (n) => weightText(n, units), t('workouts.recordKinds.best1RM'))}
          ${cell(r.maxReps, (n) => String(n), t('workouts.recordKinds.maxReps'))}
          ${cell(r.maxDuration, (n) => `${n} s`, t('workouts.recordKinds.maxDuration'))}
        </span></span>
    </div>`)}</div>
    ${!rows.length && html`<div class="empty"><div class="art" aria-hidden="true">🏆</div><p>${t('workouts.noRecords')}</p></div>`}
  `;
}

function Trends() {
  const sessions = /** @type {WorkoutSession[]} */ (/** @type {unknown} */ (useCollection('workoutSessions')));
  const exercises = /** @type {Exercise[]} */ (/** @type {unknown} */ (useCollection('exercises')));
  const settings = useProfile(PROFILE.settings);
  const units = settings.units === 'imperial' ? 'imperial' : 'metric';
  const weekStart = settings.weekStart ?? 1;
  const used = [...new Set(completed(sessions).flatMap((s) => s.entries.map((e) => e.exerciseId)))].map((id) => exercises.find((e) => e.id === id)).filter((e) => e && e.metric === 'reps');
  const [exerciseId, setExerciseId] = useState(session.exerciseId || used[0]?.id || '');
  const [mode, setMode] = useState(session.mode);
  const points = exerciseId ? trend(sessions, exerciseId, mode).map((p) => ({ label: formatDate(p.date, { day: 'numeric', month: 'short' }), value: displayWeight(p.value, units), date: p.date })) : [];
  const vol = weeklyVolume(sessions, today(), weekStart, 12).map((w) => ({ label: formatDate(w.week, { day: 'numeric', month: 'short' }), value: displayWeight(w.volume, units) }));
  const ex = exercises.find((e) => e.id === exerciseId);
  const unit = units === 'imperial' ? 'lb' : 'kg';
  return html`
    ${used.length > 0 &&
    html`<div class="stack">
      <${Select} label=${t('workouts.exercise')} value=${exerciseId} options=${used.map((e) => ({ value: /** @type {Exercise} */ (e).id, label: exName(e) }))} onChange=${(/** @type {string} */ v) => { session.exerciseId = v; setExerciseId(v); }} />
      <${Segmented} label=${t('workouts.trendMode')} value=${mode} options=${[{ value: '1rm', label: t('workouts.est1RM') }, { value: 'top', label: t('workouts.topSet') }]}
        onChange=${(/** @type {any} */ v) => { session.mode = v; setMode(v); }} />
    </div>`}
    ${points.length >= 2
      ? html`<${LineChart} points=${points} summary=${t('workouts.trendSummary', { name: exName(ex), from: `${points[0].value} ${unit}`, to: `${points[points.length - 1].value} ${unit}`, since: points[0].label })} />`
      : html`<p class="empty small">${t('workouts.trendEmpty')}</p>`}
    <section class="section">
      <h3 class="section-title">${t('workouts.weeklyVolume')}</h3>
      <${BarChart} bars=${vol} summary=${t('workouts.volumeSummary', { total: `${Math.round(vol.reduce((s, b) => s + b.value, 0))} ${unit}` })} />
    </section>
  `;
}

/** Read-only detail with editable numbers and delete. @param {{ id: string, nav: Nav }} props */
function SessionDetail({ id, nav }) {
  const sessions = /** @type {WorkoutSession[]} */ (/** @type {unknown} */ (useCollection('workoutSessions')));
  const exercises = /** @type {Exercise[]} */ (/** @type {unknown} */ (useCollection('exercises')));
  const settings = useProfile(PROFILE.settings);
  const units = settings.units === 'imperial' ? 'imperial' : 'metric';
  const [editing, setEditing] = useState(false);
  const s = sessions.find((x) => x.id === id);
  if (!s) return null;
  const st = sessionStats(s);
  const onDelete = async () => {
    const ok = await confirmDialog({ title: t('workouts.deleteSession'), confirmLabel: t('common.delete'), destructive: true });
    if (!ok) return;
    const { token } = await deleteSession(s.id);
    await nav.pop();
    undoToast(t('workouts.sessionDeleted'), token);
  };
  return html`
    <${SheetHeader} title=${formatDate(s.date, { weekday: 'long', day: 'numeric', month: 'long' })} back />
    <${SheetBody}>
      <p class="summary-line"><span>${durationText(st.minutes)}</span><span>${t('workouts.setsN', { count: st.sets })}</span><span>${weightText(st.volume, units)}</span></p>
      ${s.entries.map((e) => html`<section class="section" key=${e.id}>
        <h3 class="section-title">${exName(exercises.find((x) => x.id === e.exerciseId))}</h3>
        <div class="group">${e.sets.filter((x) => x.done || editing).map((set, i) => html`<div class="row" key=${set.id}>
          <span class="main">${i + 1}.</span>
          ${editing
            ? html`<input class="input set-input" type="number" min="0" value=${set.reps ?? ''} aria-label=${t('workouts.repsOfSet', { n: i + 1 })}
                onChange=${(/** @type {Event} */ ev) => updateSet(s.id, e.id, set.id, { reps: Number(/** @type {HTMLInputElement} */ (ev.currentTarget).value) || null })} />
              <input class="input set-input" type="number" min="0" step="any" value=${set.weightKg ? displayWeight(set.weightKg, units) : ''} aria-label=${t('workouts.weightOfSet', { n: i + 1 })}
                onChange=${(/** @type {Event} */ ev) => { const v = /** @type {HTMLInputElement} */ (ev.currentTarget).value; updateSet(s.id, e.id, set.id, { weightKg: v ? toKg(Number(v), units) : null }); }} />`
            : html`<span class="meta">${[set.reps ? t('workouts.repsN', { count: set.reps }) : '', weightText(set.weightKg, units), set.durationSec ? `${set.durationSec} s` : '', set.distanceM ? `${set.distanceM / 1000} km` : ''].filter(Boolean).join(' · ')}</span>`}
        </div>`)}</div>
      </section>`)}
      ${s.notes && html`<p class="prose">${s.notes}</p>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn btn-danger" onClick=${onDelete}>${t('common.delete')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => setEditing(!editing)}>${editing ? t('common.done') : t('common.edit')}</button>
    <//>
  `;
}
