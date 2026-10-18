// @ts-check
// Bed window (docs/spec/rooms/bedroom.md B3): Plan · Routine · Log, Go to sleep, Good morning page.

import { html, useState } from '../../ui/lib.js';
import { t, formatTime, formatDate, weekdayNames } from '../../core/i18n.js';
import { today, splitDuration } from '../../core/time.js';
import { SheetHeader, SheetBody, SheetFooter, DoneFooter } from '../../ui/sheet.js';
import { Field, Segmented, Switch, Select, DateTimeInput, DayToggles, TextArea, Rating, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection, useProfile } from '../../ui/hooks.js';
import { PROFILE } from '../../core/schema.js';
import { appStore } from '../../core/store.js';
import { toast, undoToast } from '../../ui/toast.js';
import { confirmDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { startNightstand } from '../../ui/nightstand.js';
import { RoutineChecklist, RoutineEditor } from '../routines/ui.js';
import { goalMinutes, durationMinutes, validateLog, defaultLog, averageMinutes, toLocalDateTime, parseLocalDateTime, windDownTime } from './model.js';
import { savePlan, saveLog, deleteLog, markBedtime, finishNight } from './actions.js';

/** @typedef {import('./model.js').SleepPlan} SleepPlan */
/** @typedef {import('./model.js').SleepLog} SleepLog */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

export const QUALITY_FACES = ['😫', '😕', '😐', '🙂', '😄'];
const session = { tab: /** @type {'plan'|'routine'|'log'} */ ('plan') };

/** @param {number|null} minutes */
export function formatDuration(minutes) {
  if (minutes === null) return '—';
  const { hours, minutes: m } = splitDuration(minutes);
  return t('time.duration', { hours, minutes: String(m).padStart(2, '0') });
}

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function SleepWindow({ page, nav }) {
  if (page?.id === 'log') return html`<${LogPage} id=${page.params?.id ?? null} fromPending=${Boolean(page.params?.fromPending)} nav=${nav} />`;
  if (page?.id === 'morning') return html`<${MorningPage} nav=${nav} />`;
  if (page?.id === 'routine') {
    const plan = appStore.profile(PROFILE.sleepPlan);
    const routine = plan?.bedtimeRoutineId ? appStore.get('routines', plan.bedtimeRoutineId) : undefined;
    if (routine) return html`<${RoutineEditor} routine=${routine} nav=${nav} showReminder=${false} />`;
  }
  return html`<${SleepRoot} nav=${nav} />`;
}

/** @param {{ nav: Nav }} props */
function SleepRoot({ nav }) {
  const [tab, setTab] = useState(session.tab);
  const plan = /** @type {SleepPlan} */ (/** @type {unknown} */ (useProfile(PROFILE.sleepPlan)));
  const hour = new Date().getHours();
  const showGoToSleep = hour >= 18 || hour < 4;
  const choose = (/** @type {any} */ v) => {
    session.tab = v;
    setTab(v);
  };
  const goToSleep = async () => {
    await markBedtime();
    await startNightstand();
  };

  return html`
    <${SheetHeader} title=${t('objects.bedroom.bed.name')}>
      <${Segmented}
        label=${t('sleep.sections')}
        value=${tab}
        options=${[
          { value: 'plan', label: t('sleep.plan') },
          { value: 'routine', label: t('sleep.routine') },
          { value: 'log', label: t('sleep.log') },
        ]}
        onChange=${choose}
      />
    <//>
    ${tab === 'plan' && html`<${PlanTab} plan=${plan} showGoToSleep=${showGoToSleep} onGoToSleep=${goToSleep} />`}
    ${tab === 'routine' && html`<${RoutineTab} plan=${plan} nav=${nav} />`}
    ${tab === 'log' && html`<${LogTab} plan=${plan} nav=${nav} />`}
  `;
}

/** @param {{ plan: SleepPlan, showGoToSleep: boolean, onGoToSleep: () => void }} props */
function PlanTab({ plan, showGoToSleep, onGoToSleep }) {
  const settings = useProfile(PROFILE.settings);
  const [form, update, markSaved] = useForm({
    bedtime: plan.bedtime,
    wakeTime: plan.wakeTime,
    windDownMin: plan.windDownMin,
    linkAlarm: plan.linkAlarm,
    alarmDays: [...plan.alarmDays],
  });
  const ids = { bed: useFieldId('s-bed'), wake: useFieldId('s-wake'), wind: useFieldId('s-wind') };
  const onSave = async () => {
    await savePlan(form);
    markSaved();
    toast(form.linkAlarm ? t('sleep.savedWithAlarm', { time: formatTime(form.wakeTime) }) : t('common.saved'));
  };
  return html`
    <${SheetBody}>
      ${showGoToSleep &&
      html`<button type="button" class="btn btn-primary wide" onClick=${onGoToSleep}>${icon('moon')} ${t('sleep.goToSleep')}</button>
        <p class="field-help" style="margin:6px 0 16px">${t('sleep.goToSleepHelp')}</p>`}
      ${plan.pendingBedAt && html`<p class="note">🌙 ${t('sleep.pending', { time: formatTime(plan.pendingBedAt.slice(11)) })}</p>`}
      <div class="two-cols">
        <${Field} label=${t('sleep.bedtime')} htmlFor=${ids.bed}>
          <${DateTimeInput} id=${ids.bed} type="time" value=${form.bedtime} onInput=${(/** @type {string} */ bedtime) => bedtime && update({ bedtime })} />
        <//>
        <${Field} label=${t('sleep.wakeTime')} htmlFor=${ids.wake}>
          <${DateTimeInput} id=${ids.wake} type="time" value=${form.wakeTime} onInput=${(/** @type {string} */ wakeTime) => wakeTime && update({ wakeTime })} />
        <//>
      </div>
      <p class="goal">${t('sleep.goal', { duration: formatDuration(goalMinutes(form.bedtime, form.wakeTime)) })}</p>
      <${Field} label=${t('sleep.windDown')} htmlFor=${ids.wind}>
        <${Select} id=${ids.wind} value=${String(form.windDownMin)}
          options=${[0, 15, 30, 45, 60].map((m) => ({ value: String(m), label: m ? t('sleep.windDownBefore', { minutes: m }) : t('sleep.windDownOff') }))}
          onChange=${(/** @type {string} */ v) => update({ windDownMin: Number(v) })} />
      <//>
      <div class="group" style="margin-top:16px">
        <div class="row"><span class="main"><span class="title">${t('sleep.linkAlarm')}</span>
          <span class="subtitle" style="display:block">${t('sleep.linkAlarmHelp')}</span></span>
          <${Switch} label=${t('sleep.linkAlarm')} checked=${form.linkAlarm} onChange=${(/** @type {boolean} */ linkAlarm) => update({ linkAlarm })} /></div>
      </div>
      ${form.linkAlarm &&
      html`<${DayToggles} label=${t('sleep.alarmDays')} value=${form.alarmDays} weekStart=${settings.weekStart ?? 1} names=${weekdayNames('short')}
        onChange=${(/** @type {number[]} */ alarmDays) => update({ alarmDays })} />`}
    <//>
    <${SheetFooter}>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}

/** @param {{ plan: SleepPlan, nav: Nav }} props */
function RoutineTab({ plan, nav }) {
  useCollection('routines');
  const routine = plan.bedtimeRoutineId ? appStore.get('routines', plan.bedtimeRoutineId) : undefined;
  return html`
    <${SheetBody}>
      ${routine
        ? html`<${RoutineChecklist} routine=${routine} doneText=${t('sleep.routineDone')} onEdit=${() => nav.push('routine')} />
            <p class="field-help" style="margin-top:12px">${plan.windDownMin ? t('sleep.routineReminder', { time: formatTime(windDownTime(plan)) }) : t('sleep.routineNoReminder')}</p>`
        : html`<p class="empty">${t('routines.noSteps')}</p>`}
    <//>
    <${DoneFooter} />
  `;
}

/** @param {{ plan: SleepPlan, nav: Nav }} props */
function LogTab({ plan, nav }) {
  const logs = /** @type {SleepLog[]} */ (/** @type {unknown} */ (useCollection('sleepLogs')));
  const day = today();
  const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  const goal = goalMinutes(plan.bedtime, plan.wakeTime);
  const avg = averageMinutes(logs, day);
  return html`
    <${SheetBody}>
      <div class="hero">
        <div class="hero-big small">${formatDuration(avg)}</div>
        <div class="hero-sub">${t('sleep.average')}</div>
      </div>
      ${plan.pendingBedAt &&
      html`<div class="note">🌙 ${t('sleep.pending', { time: formatTime(plan.pendingBedAt.slice(11)) })}
        <button type="button" class="btn btn-small" onClick=${() => finishNight(null)}>${t('common.discard')}</button></div>`}
      ${recent.length
        ? html`<div class="group">
            ${recent.map((log) => {
              const minutes = durationMinutes(log.bedAt, log.wakeAt) ?? 0;
              return html`<button type="button" class="row" key=${log.id} onClick=${() => nav.push('log', { id: log.id })}>
                <span class="main">
                  <span class="title">${formatDate(log.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  <span class="bar"><i style=${`width:${Math.min(100, (minutes / Math.max(goal, 1)) * 100)}%`}></i></span>
                </span>
                <span class="meta">${formatDuration(minutes)} ${log.quality ? QUALITY_FACES[log.quality - 1] : ''}</span>
              </button>`;
            })}
          </div>`
        : html`<div class="empty"><div class="art" aria-hidden="true">🛏️</div><p>${t('sleep.noLogs')}</p></div>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('log', { id: null })}>${icon('plus', { size: 20 })} ${t('sleep.logSleep')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ id: string|null, fromPending?: boolean, nav: Nav }} props */
function LogPage({ id, fromPending = false, nav }) {
  const logs = /** @type {SleepLog[]} */ (/** @type {unknown} */ (useCollection('sleepLogs')));
  const plan = /** @type {SleepPlan} */ (/** @type {unknown} */ (useProfile(PROFILE.sleepPlan)));
  const existing = id ? logs.find((l) => l.id === id) : undefined;
  const base = existing
    ? { bedAt: existing.bedAt, wakeAt: existing.wakeAt, quality: existing.quality ?? null, notes: existing.notes ?? '' }
    : fromPending && plan.pendingBedAt
      ? { bedAt: plan.pendingBedAt, wakeAt: toLocalDateTime(new Date()), quality: null, notes: '' }
      : defaultLog(plan, today());
  const [form, update, markSaved] = useForm(base);
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const ids = { bed: useFieldId('l-bed'), wake: useFieldId('l-wake'), notes: useFieldId('l-notes') };
  const minutes = durationMinutes(form.bedAt, form.wakeAt);

  const onSave = async () => {
    const found = validateLog(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    await saveLog(form, id);
    if (fromPending) await finishNight(null);
    markSaved();
    toast(t('sleep.logSaved'));
    if (fromPending) nav.close();
    else nav.pop();
  };
  const onDelete = async () => {
    if (!id || !(await confirmDialog({ title: t('sleep.deleteLog'), confirmLabel: t('common.delete'), destructive: true }))) return;
    const { token } = await deleteLog(id);
    markSaved();
    await nav.pop();
    undoToast(t('sleep.logDeleted'), token);
  };

  return html`
    <${SheetHeader} title=${id ? t('sleep.editLog') : t('sleep.logSleep')} back />
    <${SheetBody}>
      <${Field} label=${t('sleep.wentToBed')} htmlFor=${ids.bed} error=${errors.bedAt && t(errors.bedAt)}>
        <input id=${ids.bed} class="input" type="datetime-local" value=${form.bedAt} onInput=${(/** @type {Event} */ e) => update({ bedAt: /** @type {HTMLInputElement} */ (e.currentTarget).value })} />
      <//>
      <${Field} label=${t('sleep.wokeUp')} htmlFor=${ids.wake} error=${errors.wakeAt && t(errors.wakeAt)}>
        <input id=${ids.wake} class="input" type="datetime-local" value=${form.wakeAt} onInput=${(/** @type {Event} */ e) => update({ wakeAt: /** @type {HTMLInputElement} */ (e.currentTarget).value })} />
      <//>
      <p class="goal">${t('sleep.duration', { duration: formatDuration(minutes !== null && minutes > 0 ? minutes : null) })}</p>
      <${Field} label=${t('sleep.quality')} optional>
        <${Rating} label=${t('sleep.quality')} value=${form.quality} symbols=${QUALITY_FACES} onChange=${(/** @type {number|null} */ quality) => update({ quality })} />
      <//>
      <${Field} label=${t('sleep.notes')} htmlFor=${ids.notes} optional>
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

/** "Good morning": one-tap save of the night started with "Go to sleep". @param {{ nav: Nav }} props */
function MorningPage({ nav }) {
  const plan = /** @type {SleepPlan} */ (/** @type {unknown} */ (useProfile(PROFILE.sleepPlan)));
  const [quality, setQuality] = useState(/** @type {number|null} */ (null));
  const bedAt = plan.pendingBedAt ?? '';
  const wakeAt = toLocalDateTime(new Date());
  const minutes = bedAt ? durationMinutes(bedAt, wakeAt) : null;
  const valid = Boolean(bedAt && parseLocalDateTime(bedAt) && minutes && minutes > 0 && minutes <= 16 * 60);

  const save = async () => {
    await finishNight({ bedAt, wakeAt, quality });
    toast(t('sleep.logSaved'));
    nav.close();
  };
  const discard = async () => {
    await finishNight(null);
    nav.close();
  };
  return html`
    <${SheetHeader} title=${t('sleep.goodMorning')} />
    <${SheetBody}>
      <div class="hero">
        <div class="hero-big small">${formatDuration(valid ? minutes : null)}</div>
        <div class="hero-sub">${bedAt ? t('sleep.night', { from: formatTime(bedAt.slice(11)), to: formatTime(wakeAt.slice(11)) }) : t('sleep.noPending')}</div>
      </div>
      <${Field} label=${t('sleep.howDidYouSleep')} optional>
        <${Rating} label=${t('sleep.quality')} value=${quality} symbols=${QUALITY_FACES} onChange=${setQuality} />
      <//>
      ${!valid && bedAt && html`<p class="field-help">${t('sleep.morningInvalid')}</p>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${discard}>${t('common.discard')}</button>
      ${valid && html`<button type="button" class="btn" onClick=${() => nav.push('log', { id: null, fromPending: true })}>${t('sleep.edit')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" disabled=${!valid} onClick=${save}>${t('common.save')}</button>
    <//>
  `;
}
