// @ts-check
// Bath / shower window (docs/spec/rooms/bathroom.md BA3): care habits with "Done today", schedule and last done.

import { html } from '../../ui/lib.js';
import { t, nameOf, formatTime, weekdayNames } from '../../core/i18n.js';
import { today, diffDays } from '../../core/time.js';
import { appStore } from '../../core/store.js';
import { PROFILE } from '../../core/schema.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { CheckRow, Field, TextInput, DateTimeInput, DayToggles, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection, useProfile } from '../../ui/hooks.js';
import { toast } from '../../ui/toast.js';
import { confirmDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { RoutineChecklist, RoutineEditor } from '../routines/ui.js';
import { isActiveOn, isComplete, lastDone, runId } from '../routines/model.js';
import { setHabitDone, addRoutine, deleteRoutine } from '../routines/actions.js';

/** @typedef {import('../routines/model.js').Routine} Routine */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

export const SHOWER = 'bathroom.bath-shower';

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function ShowerWindow({ page, nav }) {
  const routines = /** @type {Routine[]} */ (/** @type {unknown} */ (useCollection('routines')));
  const routine = routines.find((r) => r.id === page?.params?.id);
  if (page?.id === 'edit' && routine) return html`<${HabitEditor} routine=${routine} nav=${nav} />`;
  if (page?.id === 'run' && routine) return html`<${HabitRun} routine=${routine} nav=${nav} />`;
  if (page?.id === 'new') return html`<${NewHabitPage} nav=${nav} />`;
  return html`<${ShowerRoot} routines=${routines.filter((r) => r.owner === SHOWER).sort((a, b) => a.order - b.order)} nav=${nav} />`;
}

/** "Mon, Thu · 🔔 20:00" @param {Routine} r */
export function scheduleText(r) {
  const names = weekdayNames('short');
  const days = r.days.length === 7 ? t('care.everyDay') : [...r.days].sort().map((d) => names[d]).join(', ');
  return [r.enabled ? days : t('care.off'), r.reminderTime ? `🔔 ${formatTime(r.reminderTime)}` : ''].filter(Boolean).join(' · ');
}

/** @param {string|null} date */
function lastText(date) {
  if (!date) return t('routines.never');
  const days = diffDays(date, today());
  if (days <= 0) return t('care.lastToday');
  if (days === 1) return t('care.lastYesterday');
  return t('care.lastDaysAgo', { count: days });
}

/** @param {{ routines: Routine[], nav: Nav }} props */
function ShowerRoot({ routines, nav }) {
  const runs = /** @type {any[]} */ (useCollection('routineRuns'));
  const day = today();
  const todays = routines.filter((r) => isActiveOn(r, day));
  const others = routines.filter((r) => !isActiveOn(r, day));

  /** @param {Routine} r */
  const row = (r) => {
    const done = isComplete(r, /** @type {any} */ (appStore.get('routineRuns', runId(r.id, day))));
    const onToggle = () => {
      if (r.steps.length) return nav.push('run', { id: r.id });
      setHabitDone(r, day, !done);
      if (!done) toast(t('care.habitDone', { name: nameOf(r) }));
    };
    return html`<${CheckRow} key=${r.id} checked=${done} label=${nameOf(r)}
      sub=${`${scheduleText(r)} · ${lastText(lastDone(r, runs))}`}
      onToggle=${onToggle}
      trailing=${html`<button type="button" class="icon-button" onClick=${() => nav.push('edit', { id: r.id })} aria-label=${t('care.editHabit', { name: nameOf(r) })}>${icon('chevron')}</button>`} />`;
  };

  return html`
    <${SheetHeader} title=${t('objects.bathroom.bathShower.name')} />
    <${SheetBody}>
      ${todays.length > 0 && html`<section class="section"><h3 class="section-title">${t('calendar.today')}</h3><div class="group">${todays.map(row)}</div></section>`}
      ${others.length > 0 && html`<section class="section"><h3 class="section-title">${t('care.notToday')}</h3><div class="group">${others.map(row)}</div></section>`}
      ${!routines.length && html`<div class="empty"><div class="art" aria-hidden="true">🚿</div><p>${t('care.noHabits')}</p></div>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('new')}>${icon('plus', { size: 20 })} ${t('care.addHabit')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** Step checklist for a habit that has steps. @param {{ routine: Routine, nav: Nav }} props */
function HabitRun({ routine, nav }) {
  return html`
    <${SheetHeader} title=${nameOf(routine)} back />
    <${SheetBody}><${RoutineChecklist} routine=${routine} onEdit=${() => nav.push('edit', { id: routine.id })} /><//>
  `;
}

/** Editor plus delete. @param {{ routine: Routine, nav: Nav }} props */
function HabitEditor({ routine, nav }) {
  const onDelete = async () => {
    const ok = await confirmDialog({ title: t('care.deleteTitle', { name: nameOf(routine) }), confirmLabel: t('common.delete'), destructive: true });
    if (!ok) return;
    await deleteRoutine(routine.id);
    nav.pop();
  };
  return html`<${RoutineEditor} routine=${routine} nav=${nav} onDelete=${onDelete} />`;
}

/** @param {{ nav: Nav }} props */
function NewHabitPage({ nav }) {
  const settings = useProfile(PROFILE.settings);
  const [form, update, markSaved] = useForm({ name: '', days: [1, 2, 3, 4, 5, 6, 7], reminderTime: '' });
  const ids = { name: useFieldId('h-name'), time: useFieldId('h-time') };
  const onSave = async () => {
    if (!form.name.trim()) return;
    await addRoutine({ name: form.name.trim().slice(0, 60), owner: SHOWER, slot: 'habit', days: form.days, reminderTime: form.reminderTime || null });
    markSaved();
    toast(t('common.saved'));
    nav.pop();
  };
  return html`
    <${SheetHeader} title=${t('care.addHabit')} back />
    <${SheetBody}>
      <${Field} label=${t('routines.name')} htmlFor=${ids.name}>
        <${TextInput} id=${ids.name} value=${form.name} maxLength=${60} placeholder=${t('care.habitPlaceholder')} onInput=${(/** @type {string} */ name) => update({ name })} autoFocus />
      <//>
      <${Field} label=${t('routines.days')}>
        <${DayToggles} label=${t('routines.days')} value=${form.days} weekStart=${settings.weekStart ?? 1} names=${weekdayNames('short')}
          onChange=${(/** @type {number[]} */ days) => update({ days })} />
      <//>
      <${Field} label=${t('routines.reminder')} htmlFor=${ids.time} optional>
        <${DateTimeInput} id=${ids.time} type="time" value=${form.reminderTime} onInput=${(/** @type {string} */ reminderTime) => update({ reminderTime })} />
      <//>
    <//>
    <${SheetFooter}>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" disabled=${!form.name.trim() || !form.days.length} onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}
