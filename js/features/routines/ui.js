// @ts-check
// Shared routine UI: today's checklist with streak/history, and the routine editor page.

import { html, useState } from '../../ui/lib.js';
import { t, nameOf, formatDate, weekdayNames } from '../../core/i18n.js';
import { today } from '../../core/time.js';
import { appStore } from '../../core/store.js';
import { useCollection, useProfile } from '../../ui/hooks.js';
import { PROFILE } from '../../core/schema.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { CheckRow, Field, TextInput, DateTimeInput, DayToggles, Switch, useForm, useFieldId } from '../../ui/controls.js';
import { toast } from '../../ui/toast.js';
import { icon } from '../../ui/icons.js';
import { isComplete, isActiveOn, streak, history, runId } from './model.js';
import { toggleStep, setHabitDone, saveRoutine } from './actions.js';

/** @typedef {import('./model.js').Routine} Routine */
/** @typedef {import('./model.js').RoutineRun} RoutineRun */

/** @param {string} date */
const runGetter = () => (/** @type {string} */ routineId) => (/** @type {string} */ date) =>
  /** @type {RoutineRun|undefined} */ (/** @type {unknown} */ (appStore.get('routineRuns', runId(routineId, date))));

/**
 * Today's checklist for a routine with progress, streak and a 14-day history strip.
 * @param {{ routine: Routine, doneText?: string, onEdit?: () => void }} props
 */
export function RoutineChecklist({ routine, doneText, onEdit }) {
  useCollection('routineRuns');
  const day = today();
  const runOn = runGetter()(routine.id);
  const run = runOn(day);
  const complete = isComplete(routine, run);
  const done = run?.doneStepIds.length ?? 0;
  const count = streak(routine, runOn, day);
  const days = history(routine, runOn, day);

  return html`<div class="routine">
    <div class="routine-head">
      <span class="progress-pill">${routine.steps.length ? `${done} / ${routine.steps.length}` : ''}</span>
      <span class="streak">${count ? t('routines.streak', { count }) : t('routines.startStreak')}</span>
    </div>
    ${complete && html`<p class="routine-done">✓ ${doneText ?? t('routines.allDone')}</p>`}
    <div class="group">
      ${routine.steps.map(
        (step) => html`<${CheckRow}
          key=${step.id}
          checked=${run?.doneStepIds.includes(step.id) ?? false}
          label=${nameOf(step)}
          onToggle=${() => toggleStep(routine, step.id, day)}
        />`,
      )}
      ${!routine.steps.length && html`<p class="empty small">${t('routines.noSteps')}</p>`}
    </div>
    ${!isActiveOn(routine, day) && html`<p class="field-help">${t('routines.notToday')}</p>`}
    <div class="history-dots" aria-label=${t('routines.history')}>
      ${days.map(
        (d) => html`<i key=${d.date} class=${d.state} title=${`${formatDate(d.date, { day: 'numeric', month: 'short' })}: ${t(`routines.states.${d.state}`)}`}></i>`,
      )}
    </div>
    ${onEdit && html`<button type="button" class="btn" style="margin-top:12px" onClick=${onEdit}>${icon('settings', { size: 18 })} ${t('routines.edit')}</button>`}
  </div>`;
}

/**
 * Habit row (no steps): big "Done today" checkbox + schedule and last done.
 * @param {{ routine: Routine, last: string|null, onOpen: () => void }} props
 */
export function HabitRow({ routine, last, onOpen }) {
  useCollection('routineRuns');
  const day = today();
  const done = isComplete(routine, runGetter()(routine.id)(day));
  return html`<${CheckRow}
    checked=${done}
    label=${nameOf(routine)}
    sub=${last ? t('routines.last', { date: formatDate(last, { day: 'numeric', month: 'short' }) }) : t('routines.never')}
    onToggle=${() => setHabitDone(routine, day, !done)}
    trailing=${html`<button type="button" class="icon-button" onClick=${onOpen} aria-label=${t('routines.edit')}>${icon('chevron')}</button>`}
  />`;
}

/**
 * Routine editor page: name, steps, days, reminder, enabled.
 * @param {{ routine: Routine, nav: { pop: Function }, allowSteps?: boolean, showReminder?: boolean, onDelete?: () => void }} props
 */
export function RoutineEditor({ routine, nav, allowSteps = true, showReminder = true, onDelete }) {
  const settings = useProfile(PROFILE.settings);
  const [form, update, markSaved] = useForm({
    name: nameOf(routine),
    steps: routine.steps.map((s) => ({ id: s.id, label: nameOf(s) })),
    days: [...routine.days],
    reminderTime: routine.reminderTime ?? '',
    enabled: routine.enabled,
  });
  const [draft, setDraft] = useState('');
  const ids = { name: useFieldId('r-name'), step: useFieldId('r-step'), time: useFieldId('r-time') };

  /** @param {number} i @param {number} dir */
  const move = (i, dir) => {
    const steps = [...form.steps];
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    [steps[i], steps[j]] = [steps[j], steps[i]];
    update({ steps });
  };
  const addStep = () => {
    if (!draft.trim()) return;
    update({ steps: [...form.steps, { id: `new-${Date.now()}`, label: draft.trim().slice(0, 80) }] });
    setDraft('');
  };
  const onSave = async () => {
    const original = Object.fromEntries(routine.steps.map((s) => [s.id, s]));
    await saveRoutine(routine.id, {
      ...(form.name !== nameOf(routine) ? { name: form.name.trim() } : {}),
      steps: form.steps
        .filter((s) => s.label.trim())
        .map((s) => {
          const orig = original[s.id];
          const unchanged = orig && nameOf(orig) === s.label;
          return { id: s.id.startsWith('new-') ? undefined : s.id, label: unchanged ? orig.label : s.label.trim(), seedKey: unchanged ? orig.seedKey : undefined };
        }),
      days: form.days,
      reminderTime: form.reminderTime || null,
      enabled: form.enabled,
    });
    markSaved();
    toast(t('common.saved'));
    nav.pop();
  };

  return html`
    <${SheetHeader} title=${t('routines.edit')} back />
    <${SheetBody}>
      <${Field} label=${t('routines.name')} htmlFor=${ids.name}>
        <${TextInput} id=${ids.name} value=${form.name} maxLength=${60} onInput=${(/** @type {string} */ name) => update({ name })} />
      <//>
      ${allowSteps &&
      html`<${Field} label=${t('routines.steps')} htmlFor=${ids.step}>
        <div class="group">
          ${form.steps.map(
            (s, i) => html`<div class="row step-row" key=${s.id}>
              <input class="input" value=${s.label} aria-label=${t('routines.stepN', { n: i + 1 })} maxlength="80"
                onInput=${(/** @type {Event} */ e) => update({ steps: form.steps.map((x, k) => (k === i ? { ...x, label: /** @type {HTMLInputElement} */ (e.currentTarget).value } : x)) })} />
              <button type="button" class="icon-button" aria-label=${t('common.moveUp')} onClick=${() => move(i, -1)} disabled=${i === 0}>↑</button>
              <button type="button" class="icon-button" aria-label=${t('common.moveDown')} onClick=${() => move(i, 1)} disabled=${i === form.steps.length - 1}>↓</button>
              <button type="button" class="icon-button" aria-label=${t('common.delete')} onClick=${() => update({ steps: form.steps.filter((_, k) => k !== i) })}>${icon('close', { size: 18 })}</button>
            </div>`,
          )}
        </div>
        <div class="inline" style="margin-top:8px">
          <${TextInput} id=${ids.step} value=${draft} maxLength=${80} placeholder=${t('routines.newStep')} onInput=${setDraft} />
          <button type="button" class="btn" onClick=${addStep} disabled=${!draft.trim()}>${icon('plus', { size: 18 })}</button>
        </div>
      <//>`}
      <${Field} label=${t('routines.days')}>
        <${DayToggles} label=${t('routines.days')} value=${form.days} weekStart=${settings.weekStart ?? 1} names=${weekdayNames('short')}
          onChange=${(/** @type {number[]} */ days) => update({ days })} />
      <//>
      ${showReminder &&
      html`<${Field} label=${t('routines.reminder')} htmlFor=${ids.time} optional>
        <div class="inline">
          <${DateTimeInput} id=${ids.time} type="time" value=${form.reminderTime} onInput=${(/** @type {string} */ reminderTime) => update({ reminderTime })} />
          ${form.reminderTime && html`<button type="button" class="btn" onClick=${() => update({ reminderTime: '' })}>${t('routines.noReminder')}</button>`}
        </div>
      <//>`}
      <div class="group" style="margin-top:16px">
        <div class="row"><span class="main title">${t('routines.enabled')}</span>
          <${Switch} label=${t('routines.enabled')} checked=${form.enabled} onChange=${(/** @type {boolean} */ enabled) => update({ enabled })} /></div>
      </div>
    <//>
    <${SheetFooter}>
      ${onDelete && html`<button type="button" class="btn btn-danger" onClick=${() => { markSaved(); onDelete(); }}>${t('common.delete')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}
