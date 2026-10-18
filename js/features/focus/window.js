// @ts-check
// Desk planner window (docs/spec/rooms/study.md S4): focus timer, task list, completion log.

import { html, useEffect, useState } from '../../ui/lib.js';
import { t, formatTime, formatDate } from '../../core/i18n.js';
import { today, nowTime } from '../../core/time.js';
import { appStore } from '../../core/store.js';
import { PROFILE } from '../../core/schema.js';
import { playChime } from '../../core/sound.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Segmented, ProgressRing, TextArea, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection, useProfile, useNow } from '../../ui/hooks.js';
import { toast, undoToast } from '../../ui/toast.js';
import { confirmDialog } from '../../ui/dialog.js';
import { NumberStepper } from '../media/item-page.js';
import { setTaskDone } from '../tasks/actions.js';
import { durationText } from '../walks/window.js';
import { PRESETS, activeFocus, sessionOnBreak, focusRemainingSec, breakRemainingSec, isFocusOver, focusTotals, dayOf, minutesOf, clampDurations } from './model.js';
import { startFocus, pauseFocus, resumeFocus, stopFocus, settleFocus, startBreak, endBreak, saveFocusNote, deleteFocus } from './actions.js';

/** @typedef {import('./model.js').FocusSession} FocusSession */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

const session = { preset: '25', focus: 25, brk: 5, taskId: /** @type {string|null} */ (null) };

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function FocusWindow({ page, nav }) {
  if (page?.id === 'session') return html`<${SessionPage} id=${page.params?.id} nav=${nav} />`;
  return html`<${FocusRoot} nav=${nav} />`;
}

/** "24:59" @param {number} sec */
const clock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** Recently finished session waiting for the break decision. @param {FocusSession[]} sessions @param {Date} now */
function awaitingBreak(sessions, now) {
  return sessions.find((s) => s.status === 'completed' && !s.breakStartedAt && !s.breakEndedAt && s.endedAt && now.getTime() - new Date(s.endedAt).getTime() < 30 * 60_000);
}

/** @param {{ nav: Nav }} props */
function FocusRoot({ nav }) {
  const sessions = /** @type {FocusSession[]} */ (/** @type {unknown} */ (useCollection('focusSessions')));
  const tasks = /** @type {any[]} */ (useCollection('tasks'));
  const settings = useProfile(PROFILE.settings);
  const now = useNow(1000);
  const [, setTick] = useState(0);
  const set = (/** @type {Partial<typeof session>} */ patch) => {
    Object.assign(session, patch);
    setTick((n) => n + 1);
  };
  const active = activeFocus(sessions);
  const onBreak = sessionOnBreak(sessions);
  const pending = !active && !onBreak ? awaitingBreak(sessions, now) : undefined;
  const day = today();
  const totals = focusTotals(sessions, day, settings.weekStart ?? 1);
  const todays = sessions.filter((s) => dayOf(s) === day && (s.status === 'completed' || s.status === 'aborted')).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const candidates = [
    ...tasks.filter((x) => x.context === 'study' && x.status !== 'done').sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')),
    ...tasks.filter((x) => x.context !== 'study' && x.status === 'doing'),
  ].slice(0, 8);
  const taskOf = (/** @type {string|null|undefined} */ id) => (id ? tasks.find((x) => x.id === id) : undefined);

  // Focus time is up while the window is open: complete it and chime.
  useEffect(() => {
    if (active && isFocusOver(active, now)) {
      settleFocus().then(() => playChime(/** @type {number} */ (settings.alarmVolume ?? 0.6)));
    }
  }, [active?.id, active && isFocusOver(active, now)]);
  // Report sessions that ended while the app was closed.
  useEffect(() => {
    settleFocus().then(({ result }) => result.away && toast(t('focus.finishedAway')));
  }, []);

  const onStart = async () => {
    const task = taskOf(session.taskId);
    await startFocus({ plannedMin: session.focus, breakMin: session.brk, taskId: session.taskId, moduleId: task?.moduleId ?? null });
  };
  const onStop = async (/** @type {FocusSession} */ s) => {
    const ok = await confirmDialog({ title: t('focus.stopTitle'), message: t('focus.stopText'), confirmLabel: t('focus.stop') });
    if (!ok) return;
    const { result } = await stopFocus(s.id);
    toast(t(result === 'aborted' ? 'focus.aborted' : 'focus.logged'));
  };
  const onMarkDone = async (/** @type {string} */ taskId) => {
    const { token } = await setTaskDone(taskId, true);
    if (session.taskId === taskId) set({ taskId: null });
    undoToast(t('tasks.completed'), token);
  };

  /** @param {FocusSession} s */
  const taskLine = (s) => {
    const task = taskOf(s.taskId);
    return task ? html`<p class="focus-task">🎯 ${task.title}</p>` : null;
  };

  let card;
  if (active) {
    const left = focusRemainingSec(active, now);
    card = html`<div class="focus-card">
      <${ProgressRing} value=${1 - left / (active.plannedMin * 60)} size=${180} label=${t('focus.progress')}>
        <b>${clock(left)}</b><span>${active.status === 'paused' ? t('focus.paused') : t('focus.focusing')}</span>
      <//>
      ${taskLine(active)}
      <div class="inline">
        ${active.status === 'paused'
          ? html`<button type="button" class="btn btn-primary wide" onClick=${() => resumeFocus(active.id)}>${t('focus.resume')}</button>`
          : html`<button type="button" class="btn wide" onClick=${() => pauseFocus(active.id)}>${t('focus.pause')}</button>`}
        <button type="button" class="btn wide btn-danger-text" onClick=${() => onStop(active)}>${t('focus.stop')}</button>
      </div>
    </div>`;
  } else if (onBreak) {
    const left = breakRemainingSec(onBreak, now);
    card = html`<div class="focus-card break">
      <${ProgressRing} value=${1 - left / (onBreak.breakMin * 60)} size=${180} label=${t('focus.breakProgress')}>
        <b>${left ? clock(left) : '☕'}</b><span>${t('focus.onBreak')}</span>
      <//>
      ${left
        ? html`<button type="button" class="btn wide" onClick=${() => endBreak(onBreak.id)}>${t('focus.endBreak')}</button>`
        : html`<p class="title">${t('focus.backToWork')}</p>
          <div class="inline">
            <button type="button" class="btn btn-primary wide" onClick=${async () => { await endBreak(onBreak.id); await onStart(); }}>${t('focus.startNext')}</button>
            <button type="button" class="btn wide" onClick=${() => endBreak(onBreak.id)}>${t('focus.doneForNow')}</button>
          </div>`}
    </div>`;
  } else if (pending) {
    const task = taskOf(pending.taskId);
    card = html`<div class="focus-card done">
      <div class="done-mark" aria-hidden="true">✓</div>
      <p class="title">${t('focus.breakTime', { minutes: pending.breakMin })}</p>
      ${task && task.status !== 'done' && html`<button type="button" class="btn btn-small" onClick=${() => onMarkDone(task.id)}>✓ ${t('focus.markTaskDone', { title: task.title })}</button>`}
      <div class="inline">
        <button type="button" class="btn btn-primary wide" onClick=${() => startBreak(pending.id)}>☕ ${t('focus.startBreak')}</button>
        <button type="button" class="btn wide" onClick=${() => endBreak(pending.id)}>${t('focus.skip')}</button>
      </div>
    </div>`;
  } else {
    const task = taskOf(session.taskId);
    card = html`<div class="focus-card idle">
      <${Segmented} label=${t('focus.preset')} value=${session.preset}
        options=${[...PRESETS.map((p) => ({ value: p.key, label: `${p.focus}/${p.break}` })), { value: 'custom', label: t('focus.custom') }]}
        onChange=${(/** @type {string} */ v) => { const p = PRESETS.find((x) => x.key === v); set(p ? { preset: v, focus: p.focus, brk: p.break } : { preset: v }); }} />
      ${session.preset === 'custom' &&
      html`<div class="two-cols">
        <${Field} label=${t('focus.focusMin')}><${NumberStepper} label=${t('focus.focusMin')} value=${session.focus} min=${5} onChange=${(/** @type {number} */ n) => set({ focus: clampDurations(n, session.brk).focus })} /><//>
        <${Field} label=${t('focus.breakMin')}><${NumberStepper} label=${t('focus.breakMin')} value=${session.brk} min=${1} onChange=${(/** @type {number} */ n) => set({ brk: clampDurations(session.focus, n).break })} /><//>
      </div>`}
      <div class="hero-big">${session.focus}:00</div>
      ${task ? html`<p class="focus-task">🎯 ${task.title} <button type="button" class="link-button" onClick=${() => set({ taskId: null })}>${t('focus.clearTask')}</button></p>` : html`<p class="field-help">${t('focus.pickTask')}</p>`}
      <button type="button" class="btn btn-primary wide" onClick=${onStart}>▶ ${t('focus.start')}</button>
    </div>`;
  }

  return html`
    <${SheetHeader} title=${t('objects.study.deskPlanner.name')} />
    <${SheetBody}>
      ${card}
      ${!active && candidates.length > 0 &&
      html`<section class="section">
        <h3 class="section-title">${t('focus.tasks')}</h3>
        <div class="group">${candidates.map((x) => html`<div class=${`row${session.taskId === x.id ? ' selected-row' : ''}`} key=${x.id}>
          <button type="button" class="row-hit" aria-pressed=${session.taskId === x.id ? 'true' : 'false'} onClick=${() => set({ taskId: session.taskId === x.id ? null : x.id })}>
            <span class="main"><span class="title">${x.title}</span>${x.dueDate && html`<span class="subtitle" style="display:block">${t('study.due', { date: formatDate(x.dueDate, { weekday: 'short', day: 'numeric', month: 'short' }) })}</span>`}</span>
          </button>
          <button type="button" class="icon-button" aria-label=${t('focus.markDone', { title: x.title })} onClick=${() => onMarkDone(x.id)}>✓</button>
        </div>`)}</div>
      </section>`}
      <section class="section">
        <h3 class="section-title">${t('focus.log')}</h3>
        <p class="summary-line">${t('focus.totals', { day: durationText(totals.day), week: durationText(totals.week) })}</p>
        <div class="group">${todays.map((s) => html`<button type="button" class="row" key=${s.id} onClick=${() => nav.push('session', { id: s.id })}>
          <span class="lead" aria-hidden="true">${s.status === 'completed' ? '✓' : '·'}</span>
          <span class="main"><span class="title">${taskOf(s.taskId)?.title ?? t('focus.session')}</span>
            <span class="subtitle" style="display:block">${formatTime(nowTime(new Date(s.startedAt)))} · ${s.status === 'completed' ? t('time.minutesShort', { minutes: minutesOf(s) }) : t('focus.abortedShort')}</span></span>
        </button>`)}</div>
        ${!todays.length && html`<p class="empty small">${t('focus.noSessions')}</p>`}
      </section>
    <//>
    <${SheetFooter}><span class="grow"></span><button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button><//>
  `;
}

/** @param {{ id: string, nav: Nav }} props */
function SessionPage({ id, nav }) {
  const sessions = /** @type {FocusSession[]} */ (/** @type {unknown} */ (useCollection('focusSessions')));
  const s = sessions.find((x) => x.id === id);
  const [form, update, markSaved] = useForm({ note: s?.note ?? '' });
  const noteId = useFieldId('fs-note');
  if (!s) return null;
  const task = s.taskId ? /** @type {any} */ (appStore.get('tasks', s.taskId)) : undefined;
  const onDelete = async () => {
    const { token } = await deleteFocus(s.id);
    markSaved();
    await nav.pop();
    undoToast(t('focus.deleted'), token);
  };
  return html`
    <${SheetHeader} title=${t('focus.session')} back />
    <${SheetBody}>
      <p class="title">${task?.title ?? t('focus.session')}</p>
      <p class="field-help">${formatTime(nowTime(new Date(s.startedAt)))} · ${s.status === 'completed' ? t('time.minutesShort', { minutes: minutesOf(s) }) : t('focus.abortedShort')}</p>
      <${Field} label=${t('tasks.fields.notes')} htmlFor=${noteId} optional><${TextArea} id=${noteId} value=${form.note} onInput=${(/** @type {string} */ note) => update({ note })} /><//>
    <//>
    <${SheetFooter}>
      <button type="button" class="btn btn-danger" onClick=${onDelete}>${t('common.delete')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${async () => { await saveFocusNote(s.id, form.note); markSaved(); nav.pop(); }}>${t('common.save')}</button>
    <//>
  `;
}
