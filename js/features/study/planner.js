// @ts-check
// Planner window (docs/spec/rooms/study.md S2): Timetable · Deadlines · Exams. Classes and exams are calendar events (F-11).

import { html, useState } from '../../ui/lib.js';
import { t, formatDate, formatTime, weekdayNames } from '../../core/i18n.js';
import { today, addDays, startOfWeek, weekday } from '../../core/time.js';
import { PROFILE } from '../../core/schema.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Segmented, Select, TextInput, TextArea, DateTimeInput, DayToggles, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection, useProfile } from '../../ui/hooks.js';
import { toast, undoToast } from '../../ui/toast.js';
import { confirmDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { COLORS } from '../wardrobe/catalog.js';
import { deleteEvent } from '../calendar/actions.js';
import { TaskPage } from '../tasks/window.js';
import { classesOn, classDays, deadlines, upcomingExams, daysUntil, validateClass } from './model.js';
import { saveClass, saveExam } from './actions.js';
import { countdown } from './computer.js';

/** @typedef {import('./model.js').CalendarEvent} CalendarEvent */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

const session = { tab: 'timetable', day: 0, overview: false };
const REMINDERS = [null, 0, 10, 30, 60, 1440, 2880, 10080];

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function PlannerWindow({ page, nav }) {
  if (page?.id === 'class') return html`<${ClassPage} id=${page.params?.id ?? null} day=${page.params?.day ?? null} nav=${nav} />`;
  if (page?.id === 'exam') return html`<${ExamPage} id=${page.params?.id ?? null} nav=${nav} />`;
  if (page?.id === 'task') return html`<${TaskPage} id=${page.params?.id ?? null} projectId=${null} defaults=${{ context: 'study' }} nav=${nav} />`;
  return html`<${PlannerRoot} nav=${nav} />`;
}

/** Reminder offset label. @param {number|null} o */
const reminderLabel = (o) =>
  o === null ? t('calendar.reminders.none') : o === 0 ? t('calendar.reminders.atTime') : o < 60 ? t('calendar.reminders.minutes', { count: o }) : o < 1440 ? t('calendar.reminders.hours', { count: o / 60 }) : t('calendar.reminders.days', { count: o / 1440 });

/** @param {any[]} modules @param {string|null|undefined} id */
const moduleOf = (modules, id) => modules.find((m) => m.id === id);

/** @param {{ nav: Nav }} props */
function PlannerRoot({ nav }) {
  const [tab, setTab] = useState(session.tab);
  return html`
    <${SheetHeader} title=${t('objects.study.planner.name')}>
      <${Segmented} label=${t('study.sections')} value=${tab}
        options=${['timetable', 'deadlines', 'exams'].map((v) => ({ value: v, label: t(`study.${v}`) }))}
        onChange=${(/** @type {string} */ v) => { session.tab = v; setTab(v); }} />
    <//>
    ${tab === 'timetable' && html`<${TimetableTab} nav=${nav} />`}
    ${tab === 'deadlines' && html`<${DeadlinesTab} nav=${nav} />`}
    ${tab === 'exams' && html`<${ExamsTab} nav=${nav} />`}
  `;
}

/** @param {{ nav: Nav }} props */
function TimetableTab({ nav }) {
  const events = /** @type {CalendarEvent[]} */ (/** @type {unknown} */ (useCollection('events')));
  const modules = /** @type {any[]} */ (useCollection('studyModules'));
  const day0 = today();
  const [wd, setWd] = useState(session.day || weekday(day0));
  const [overview, setOverview] = useState(session.overview);
  const used = classDays(events);
  const days = [1, 2, 3, 4, 5, ...[6, 7].filter((d) => used.has(d) || d === wd)];
  const names = weekdayNames('short');
  const weekStart = startOfWeek(day0, 1);
  const dateOf = (/** @type {number} */ d) => addDays(weekStart, d - 1);
  const list = classesOn(events, dateOf(wd));

  /** @param {CalendarEvent} c */
  const classRow = (c) => {
    const m = moduleOf(modules, c.moduleId);
    return html`<button type="button" class="row class-row" key=${c.id} style=${`--chip:${COLORS[m?.color ?? 'grey']}`} onClick=${() => nav.push('class', { id: c.id })}>
      <span class="time-col">${formatTime(/** @type {string} */ (c.start))}<br /><small>${formatTime(/** @type {string} */ (c.end))}</small></span>
      <span class="main"><span class="title">${c.title}</span><span class="subtitle" style="display:block">${[m?.code || m?.name, c.location].filter(Boolean).join(' · ')}</span></span>
    </button>`;
  };

  return html`
    <${SheetBody}>
      <div class="chips day-chips" role="group" aria-label=${t('study.weekday')}>
        ${days.map((d) => html`<button type="button" class="chip-btn" key=${d} aria-pressed=${wd === d ? 'true' : 'false'}
          onClick=${() => { session.day = d; setWd(d); }}>${names[d]}${dateOf(d) === day0 ? ' •' : ''}</button>`)}
        <button type="button" class="chip-btn" aria-pressed=${overview ? 'true' : 'false'} onClick=${() => { session.overview = !overview; setOverview(!overview); }}>${t('study.weekOverview')}</button>
      </div>
      ${overview
        ? html`<div class="week-grid" style=${`grid-template-columns:repeat(${days.length},1fr)`}>
            ${days.map((d) => html`<div class="week-col" key=${d}><div class="week-head">${names[d]}</div>
              ${classesOn(events, dateOf(d)).map((c) => html`<div class="week-block" key=${c.id} style=${`background:${COLORS[moduleOf(modules, c.moduleId)?.color ?? 'grey']}33;border-color:${COLORS[moduleOf(modules, c.moduleId)?.color ?? 'grey']}`}>
                <b>${formatTime(/** @type {string} */ (c.start))}</b><span>${moduleOf(modules, c.moduleId)?.code || c.title}</span></div>`)}
            </div>`)}
          </div>`
        : html`<p class="field-help">${formatDate(dateOf(wd), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <div class="group">${list.map(classRow)}</div>
          ${!list.length && html`<div class="empty small"><p>${t('study.noClasses')}</p></div>`}`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" disabled=${!modules.some((m) => !m.archived)} onClick=${() => nav.push('class', { id: null, day: wd })}>${icon('plus', { size: 20 })} ${t('study.addClass')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ nav: Nav }} props */
function DeadlinesTab({ nav }) {
  const events = /** @type {CalendarEvent[]} */ (/** @type {unknown} */ (useCollection('events')));
  const tasks = /** @type {any[]} */ (useCollection('tasks'));
  const modules = /** @type {any[]} */ (useCollection('studyModules'));
  const day = today();
  const list = deadlines(tasks, events, day);
  return html`
    <${SheetBody}>
      <div class="group">
        ${list.map((d) => {
          const m = moduleOf(modules, d.moduleId);
          const days = daysUntil(day, d.date);
          const inner = html`<span class="lead" aria-hidden="true" style=${`background:${COLORS[m?.color ?? 'grey']}33`}>${d.task ? '📝' : '⏳'}</span>
            <span class="main"><span class="title">${d.title}</span>
              <span class="subtitle" style="display:block">${[m?.code || m?.name, formatDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' }) + (d.time ? ` ${formatTime(d.time)}` : '')].filter(Boolean).join(' · ')}</span></span>
            <span class=${`due ${days < 0 ? 'overdue' : days <= 2 ? 'soon' : ''}`}>${countdown(days)}</span>`;
          return d.task
            ? html`<button type="button" class="row" key=${d.key} onClick=${() => nav.push('task', { id: d.task?.id })}>${inner}</button>`
            : html`<div class="row" key=${d.key}>${inner}</div>`;
        })}
      </div>
      ${!list.length && html`<div class="empty"><div class="art" aria-hidden="true">🗓️</div><p>${t('study.noDeadlines')}</p></div>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" disabled=${!modules.some((m) => !m.archived)} onClick=${() => nav.push('task', { id: null })}>${icon('plus', { size: 20 })} ${t('study.addAssignment')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ nav: Nav }} props */
function ExamsTab({ nav }) {
  const events = /** @type {CalendarEvent[]} */ (/** @type {unknown} */ (useCollection('events')));
  const modules = /** @type {any[]} */ (useCollection('studyModules'));
  const day = today();
  const exams = upcomingExams(events, day);
  return html`
    <${SheetBody}>
      <div class="group">
        ${exams.map(({ event: e, date }) => {
          const m = moduleOf(modules, e.moduleId);
          return html`<button type="button" class="row" key=${e.id} onClick=${() => nav.push('exam', { id: e.id })}>
            <span class="lead" aria-hidden="true" style=${`background:${COLORS[m?.color ?? 'grey']}33`}>📝</span>
            <span class="main"><span class="title">${e.title}</span>
              <span class="subtitle" style="display:block">${formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}${e.start ? ` ${formatTime(e.start)}` : ''}${e.location ? ` · ${e.location}` : ''}</span></span>
            <span class="meta">${countdown(daysUntil(day, date))}</span>
          </button>`;
        })}
      </div>
      ${!exams.length && html`<div class="empty"><div class="art" aria-hidden="true">🎓</div><p>${t('study.noExams')}</p></div>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" disabled=${!modules.some((m) => !m.archived)} onClick=${() => nav.push('exam', { id: null })}>${icon('plus', { size: 20 })} ${t('study.addExam')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** Deletes a class or exam with undo. @param {string} id @param {Nav} nav @param {() => void} markSaved */
async function removeEvent(id, nav, markSaved) {
  const ok = await confirmDialog({ title: t('study.deleteEvent'), confirmLabel: t('common.delete'), destructive: true });
  if (!ok) return;
  const { token } = await deleteEvent(id);
  markSaved();
  await nav.pop();
  undoToast(t('study.eventDeleted'), token);
}

/** @param {{ id: string|null, day: number|null, nav: Nav }} props */
function ClassPage({ id, day, nav }) {
  const events = /** @type {CalendarEvent[]} */ (/** @type {unknown} */ (useCollection('events')));
  const modules = /** @type {any[]} */ (useCollection('studyModules')).filter((m) => !m.archived);
  const settings = useProfile(PROFILE.settings);
  const existing = id ? events.find((e) => e.id === id) : undefined;
  const [form, update, markSaved] = useForm({
    moduleId: existing?.moduleId ?? modules[0]?.id ?? '',
    title: existing?.title ?? '',
    days: existing?.recurrence?.byWeekday ?? (day ? [day] : [weekday(today())]),
    start: existing?.start ?? '10:00',
    end: existing?.end ?? '11:30',
    location: existing?.location ?? '',
    termStart: existing?.date ?? today(),
    termEnd: existing?.recurrence?.until ?? '',
    reminderOffsetMin: existing ? existing.reminderOffsetMin : 10,
    notes: existing?.notes ?? '',
  });
  const [tried, setTried] = useState(false);
  const errors = validateClass(form);
  const ids = { title: useFieldId('cl-title'), start: useFieldId('cl-start'), end: useFieldId('cl-end'), loc: useFieldId('cl-loc'), ts: useFieldId('cl-ts'), te: useFieldId('cl-te'), notes: useFieldId('cl-notes') };
  const onSave = async () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    await saveClass(form, id);
    markSaved();
    toast(t('common.saved'));
    nav.pop();
  };
  const err = (/** @type {string} */ k) => (tried && errors[k] ? t(errors[k]) : undefined);
  return html`
    <${SheetHeader} title=${id ? t('study.class') : t('study.addClass')} back />
    <${SheetBody}>
      <${Field} label=${t('study.module')} error=${err('moduleId')}>
        <${Select} label=${t('study.module')} value=${form.moduleId} options=${modules.map((m) => ({ value: m.id, label: m.name }))} onChange=${(/** @type {string} */ moduleId) => update({ moduleId })} />
      <//>
      <${Field} label=${t('media.title')} htmlFor=${ids.title} optional>
        <${TextInput} id=${ids.title} value=${form.title} maxLength=${80} placeholder=${modules.find((m) => m.id === form.moduleId)?.name ?? ''} onInput=${(/** @type {string} */ title) => update({ title })} />
      <//>
      <${Field} label=${t('study.weekdays')} error=${err('days')}>
        <${DayToggles} label=${t('study.weekdays')} value=${form.days} weekStart=${settings.weekStart ?? 1} names=${weekdayNames('short')} onChange=${(/** @type {number[]} */ days) => update({ days })} />
      <//>
      <div class="two-cols">
        <${Field} label=${t('calendar.fields.start')} htmlFor=${ids.start} error=${err('time')}><${DateTimeInput} id=${ids.start} type="time" value=${form.start} onInput=${(/** @type {string} */ start) => update({ start })} /><//>
        <${Field} label=${t('calendar.fields.end')} htmlFor=${ids.end}><${DateTimeInput} id=${ids.end} type="time" value=${form.end} onInput=${(/** @type {string} */ end) => update({ end })} /><//>
      </div>
      <${Field} label=${t('study.room')} htmlFor=${ids.loc} optional><${TextInput} id=${ids.loc} value=${form.location} maxLength=${60} onInput=${(/** @type {string} */ location) => update({ location })} /><//>
      <div class="two-cols">
        <${Field} label=${t('study.termStart')} htmlFor=${ids.ts}><${DateTimeInput} id=${ids.ts} type="date" value=${form.termStart} onInput=${(/** @type {string} */ termStart) => update({ termStart })} /><//>
        <${Field} label=${t('study.termEnd')} htmlFor=${ids.te} optional><${DateTimeInput} id=${ids.te} type="date" value=${form.termEnd} onInput=${(/** @type {string} */ termEnd) => update({ termEnd })} /><//>
      </div>
      <${Field} label=${t('calendar.fields.reminder')}>
        <${Select} label=${t('calendar.fields.reminder')} value=${String(form.reminderOffsetMin)} options=${REMINDERS.map((o) => ({ value: String(o), label: reminderLabel(o) }))}
          onChange=${(/** @type {string} */ v) => update({ reminderOffsetMin: v === 'null' ? null : Number(v) })} />
      <//>
      <${Field} label=${t('tasks.fields.notes')} htmlFor=${ids.notes} optional><${TextArea} id=${ids.notes} value=${form.notes} onInput=${(/** @type {string} */ notes) => update({ notes })} /><//>
    <//>
    <${SheetFooter}>
      ${id && html`<button type="button" class="btn btn-danger" onClick=${() => removeEvent(/** @type {string} */ (id), nav, markSaved)}>${t('common.delete')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}

/** @param {{ id: string|null, nav: Nav }} props */
function ExamPage({ id, nav }) {
  const events = /** @type {CalendarEvent[]} */ (/** @type {unknown} */ (useCollection('events')));
  const modules = /** @type {any[]} */ (useCollection('studyModules')).filter((m) => !m.archived);
  const existing = id ? events.find((e) => e.id === id) : undefined;
  const [form, update, markSaved] = useForm({
    moduleId: existing?.moduleId ?? modules[0]?.id ?? '',
    title: existing?.title ?? '',
    date: existing?.date ?? addDays(today(), 14),
    time: existing?.start ?? '',
    location: existing?.location ?? '',
    reminderOffsetMin: existing ? existing.reminderOffsetMin : 1440,
    notes: existing?.notes ?? '',
  });
  const ids = { title: useFieldId('ex-title'), date: useFieldId('ex-date'), time: useFieldId('ex-time'), loc: useFieldId('ex-loc'), notes: useFieldId('ex-notes') };
  const module = modules.find((m) => m.id === form.moduleId);
  const defaultTitle = module ? t('study.examTitle', { module: module.name }) : '';
  const onSave = async () => {
    if (!form.moduleId || !form.date) return;
    await saveExam({ ...form, title: form.title.trim() || defaultTitle }, id);
    markSaved();
    toast(t('common.saved'));
    nav.pop();
  };
  return html`
    <${SheetHeader} title=${id ? t('study.exam') : t('study.addExam')} back />
    <${SheetBody}>
      <${Field} label=${t('study.module')}>
        <${Select} label=${t('study.module')} value=${form.moduleId} options=${modules.map((m) => ({ value: m.id, label: m.name }))} onChange=${(/** @type {string} */ moduleId) => update({ moduleId })} />
      <//>
      <${Field} label=${t('media.title')} htmlFor=${ids.title} optional>
        <${TextInput} id=${ids.title} value=${form.title} maxLength=${80} placeholder=${defaultTitle} onInput=${(/** @type {string} */ title) => update({ title })} />
      <//>
      <div class="two-cols">
        <${Field} label=${t('walks.date')} htmlFor=${ids.date}><${DateTimeInput} id=${ids.date} type="date" value=${form.date} onInput=${(/** @type {string} */ date) => update({ date })} /><//>
        <${Field} label=${t('calendar.fields.start')} htmlFor=${ids.time} optional><${DateTimeInput} id=${ids.time} type="time" value=${form.time} onInput=${(/** @type {string} */ time) => update({ time })} /><//>
      </div>
      <${Field} label=${t('study.room')} htmlFor=${ids.loc} optional><${TextInput} id=${ids.loc} value=${form.location} maxLength=${60} onInput=${(/** @type {string} */ location) => update({ location })} /><//>
      <${Field} label=${t('calendar.fields.reminder')}>
        <${Select} label=${t('calendar.fields.reminder')} value=${String(form.reminderOffsetMin)} options=${REMINDERS.map((o) => ({ value: String(o), label: reminderLabel(o) }))}
          onChange=${(/** @type {string} */ v) => update({ reminderOffsetMin: v === 'null' ? null : Number(v) })} />
      <//>
      <${Field} label=${t('tasks.fields.notes')} htmlFor=${ids.notes} optional><${TextArea} id=${ids.notes} value=${form.notes} onInput=${(/** @type {string} */ notes) => update({ notes })} /><//>
    <//>
    <${SheetFooter}>
      ${id && html`<button type="button" class="btn btn-danger" onClick=${() => removeEvent(/** @type {string} */ (id), nav, markSaved)}>${t('common.delete')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" disabled=${!form.moduleId || !form.date} onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}
