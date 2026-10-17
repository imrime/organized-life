// @ts-check
// Wall calendar window (docs/spec/rooms/bedroom.md B2): month/week views, agenda, event page.

import { html, useState } from '../../ui/lib.js';
import { t, formatTime, formatDate, weekdayNames, intlLocale } from '../../core/i18n.js';
import { today, addDays, addMonths, startOfWeek, isValidLocalDate, weekday as weekdayOf } from '../../core/time.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Segmented, Switch, Select, TextInput, TextArea, DateTimeInput, DayToggles, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection, useProfile } from '../../ui/hooks.js';
import { PROFILE } from '../../core/schema.js';
import { undoToast, toast } from '../../ui/toast.js';
import { confirmDialog, choiceDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { agenda, monthGrid, defaultEvent, formFromEvent, validateEvent, REMINDER_OFFSETS } from './model.js';
import { saveEvent, deleteEvent, deleteOccurrence, setTaskDone } from './actions.js';

/** @typedef {import('./model.js').CalendarEvent} CalendarEvent */
/** @typedef {import('./model.js').AgendaItem} AgendaItem */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

export const KIND_COLORS = /** @type {Record<string, string>} */ ({
  event: '#5E7B8C',
  deadline: '#B83C48',
  reminder: '#C99A50',
  exam: '#8A5FA8',
  class: '#4F7A5A',
  task: '#6B625B',
});

/** Remembered for the session: last view and selected day. */
const session = { view: /** @type {'month'|'week'} */ ('month'), selected: today() };

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function CalendarWindow({ page, nav }) {
  if (page?.id === 'event') return html`<${EventPage} id=${page.params?.id ?? null} date=${page.params?.date ?? null} nav=${nav} />`;
  return html`<${CalendarRoot} nav=${nav} />`;
}

/** @param {{ nav: Nav }} props */
function CalendarRoot({ nav }) {
  const events = /** @type {CalendarEvent[]} */ (/** @type {unknown} */ (useCollection('events')));
  const tasks = /** @type {any[]} */ (useCollection('tasks'));
  const settings = useProfile(PROFILE.settings);
  const weekStart = settings.weekStart ?? 1;
  const [view, setView] = useState(session.view);
  const [selected, setSelected] = useState(session.selected);
  const now = today();

  const select = (/** @type {string} */ date) => {
    session.selected = date;
    setSelected(date);
  };
  const changeView = (/** @type {'month'|'week'} */ v) => {
    session.view = v;
    setView(v);
  };

  const [y, m] = selected.split('-').map(Number);
  const grid = monthGrid(y, m, weekStart);
  const weekFrom = startOfWeek(selected, weekStart);
  const rangeFrom = view === 'month' ? grid[0] : weekFrom;
  const rangeTo = view === 'month' ? grid[41] : addDays(weekFrom, 6);
  const items = agenda(events, tasks, rangeFrom, rangeTo);

  const step = (/** @type {number} */ dir) => select(view === 'month' ? addMonths(selected, dir) : addDays(selected, dir * 7));
  const title =
    view === 'month'
      ? new Intl.DateTimeFormat(intlLocale(), { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1))
      : `${formatDate(weekFrom, { day: 'numeric', month: 'short' })} – ${formatDate(addDays(weekFrom, 6), { day: 'numeric', month: 'short' })}`;

  return html`
    <${SheetHeader} title=${t('objects.bedroom.wallCalendar.name')}>
      <${Segmented}
        label=${t('calendar.view')}
        value=${view}
        options=${[
          { value: 'month', label: t('calendar.month') },
          { value: 'week', label: t('calendar.week') },
        ]}
        onChange=${changeView}
      />
    <//>
    <${SheetBody}>
      <div class="cal-nav">
        <button type="button" class="icon-button" onClick=${() => step(-1)} aria-label=${t('calendar.previous')}>${icon('back')}</button>
        <div class="cal-title" aria-live="polite">${title}</div>
        <button type="button" class="icon-button" onClick=${() => step(1)} aria-label=${t('calendar.next')}>${icon('chevron')}</button>
        <button type="button" class="btn btn-small" onClick=${() => select(now)}>${t('calendar.today')}</button>
      </div>
      ${view === 'month'
        ? html`<${MonthView} grid=${grid} month=${m} items=${items} selected=${selected} todayDate=${now} weekStart=${weekStart} onSelect=${select} />
            <${DayAgenda} date=${selected} items=${items.get(selected) ?? []} nav=${nav} heading />`
        : html`${Array.from({ length: 7 }, (_, i) => addDays(weekFrom, i)).map(
            (date) => html`<${DayAgenda} key=${date} date=${date} items=${items.get(date) ?? []} nav=${nav} heading compact />`,
          )}`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('event', { id: null, date: selected })}>${icon('plus', { size: 20 })} ${t('calendar.addEvent')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/**
 * @param {{ grid: string[], month: number, items: Map<string, AgendaItem[]>, selected: string, todayDate: string, weekStart: 1|7, onSelect: (d: string) => void }} props
 */
function MonthView({ grid, month, items, selected, todayDate, weekStart, onSelect }) {
  const names = weekdayNames('narrow');
  const order = weekStart === 7 ? [7, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7];
  return html`<div class="cal-grid" role="grid" aria-label=${t('calendar.month')}>
    ${order.map((d) => html`<div class="cal-dow" role="columnheader" key=${`h${d}`}>${names[d]}</div>`)}
    ${grid.map((date) => {
      const list = items.get(date) ?? [];
      const inMonth = Number(date.slice(5, 7)) === month;
      const label = `${formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}${list.length ? `, ${t('calendar.itemsCount', { count: list.length })}` : ''}`;
      return html`<button
        type="button"
        key=${date}
        role="gridcell"
        class=${`cal-day${inMonth ? '' : ' out'}${date === todayDate ? ' today' : ''}${date === selected ? ' selected' : ''}`}
        aria-selected=${date === selected ? 'true' : 'false'}
        aria-label=${label}
        onClick=${() => onSelect(date)}
      >
        <span class="num">${Number(date.slice(8))}</span>
        <span class="dots" aria-hidden="true">
          ${list.slice(0, 3).map(
            (item, i) => html`<i key=${i} style=${`background:${KIND_COLORS[item.type === 'event' ? item.event.kind : 'task']}`}></i>`,
          )}
          ${list.length > 3 && html`<b>+</b>`}
        </span>
      </button>`;
    })}
  </div>`;
}

/**
 * @param {{ date: string, items: AgendaItem[], nav: Nav, heading?: boolean, compact?: boolean }} props
 */
function DayAgenda({ date, items, nav, heading = false, compact = false }) {
  const isToday = date === today();
  return html`<section class=${`section agenda${compact ? ' compact' : ''}`}>
    ${heading &&
    html`<h3 class="section-title">${isToday ? `${t('calendar.today')} · ` : ''}${formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>`}
    ${items.length
      ? html`<div class="group">${items.map((item) => html`<${AgendaRow} key=${item.type + (item.type === 'event' ? item.event.id : item.task.id)} item=${item} nav=${nav} />`)}</div>`
      : !compact &&
        html`<div class="empty small">
          <p>${t('calendar.nothing')}</p>
          <button type="button" class="btn" onClick=${() => nav.push('event', { id: null, date })}>${t('calendar.addEvent')}</button>
        </div>`}
    ${compact && !items.length && html`<p class="agenda-none">—</p>`}
  </section>`;
}

/** @param {{ item: AgendaItem, nav: Nav }} props */
function AgendaRow({ item, nav }) {
  if (item.type === 'task') {
    const done = item.task.status === 'done';
    return html`<div class="row">
      <button
        type="button"
        class=${`check${done ? ' on' : ''}`}
        role="checkbox"
        aria-checked=${done ? 'true' : 'false'}
        aria-label=${item.task.title}
        onClick=${() => setTaskDone(item.task.id, !done)}
      >
        ${done && icon('check', { size: 18 })}
      </button>
      <span class="main">
        <span class=${`title${done ? ' done' : ''}`}>${item.task.title}</span>
        <span class="subtitle" style="display:block">${item.task.dueTime ? formatTime(item.task.dueTime) : t('calendar.allDay')}</span>
      </span>
      <span class="chip" style=${`--chip:${KIND_COLORS.task}`}>${t('calendar.kinds.task')}</span>
    </div>`;
  }
  const { event, date } = item;
  const time = event.allDay ? t('calendar.allDay') : `${formatTime(event.start ?? '00:00')}–${formatTime(event.end ?? '00:00')}`;
  return html`<button type="button" class="row" onClick=${() => nav.push('event', { id: event.id, date })}>
    <span class="kind-bar" style=${`background:${KIND_COLORS[event.kind]}`} aria-hidden="true"></span>
    <span class="main">
      <span class="title">${event.title}</span>
      <span class="subtitle" style="display:block">
        ${time}${event.location ? ` · ${event.location}` : ''}
        ${event.reminderOffsetMin !== null && event.reminderOffsetMin !== undefined && html` <span aria-label=${t('calendar.hasReminder')}>🔔</span>`}
        ${event.recurrence && html` <span aria-label=${t('calendar.repeats')}>↻</span>`}
      </span>
    </span>
    <span class="chip" style=${`--chip:${KIND_COLORS[event.kind]}`}>${t(`calendar.kinds.${event.kind}`)}</span>
  </button>`;
}

/** @param {number|null} offset @param {boolean} allDay */
function reminderLabel(offset, allDay) {
  if (offset === null) return t('calendar.reminders.none');
  if (offset === 0) return allDay ? t('calendar.reminders.morning') : t('calendar.reminders.atTime');
  if (offset < 60) return t('calendar.reminders.minutes', { count: offset });
  if (offset < 1440) return t('calendar.reminders.hours', { count: offset / 60 });
  if (offset < 10080) return t('calendar.reminders.days', { count: offset / 1440 });
  return t('calendar.reminders.week');
}

/** @param {{ id: string|null, date: string|null, nav: Nav }} props */
function EventPage({ id, date, nav }) {
  const events = /** @type {CalendarEvent[]} */ (/** @type {unknown} */ (useCollection('events')));
  const settings = useProfile(PROFILE.settings);
  const existing = id ? events.find((e) => e.id === id) : undefined;
  const initial = existing ? formFromEvent(existing) : defaultEvent(date && isValidLocalDate(date) ? date : today(), new Date());
  const [form, update, markSaved] = useForm(initial);
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const ids = {
    title: useFieldId('ev-title'),
    date: useFieldId('ev-date'),
    start: useFieldId('ev-start'),
    end: useFieldId('ev-end'),
    repeat: useFieldId('ev-repeat'),
    until: useFieldId('ev-until'),
    reminder: useFieldId('ev-reminder'),
    location: useFieldId('ev-location'),
    notes: useFieldId('ev-notes'),
  };
  /** @param {string|undefined} key */
  const err = (key) => (key ? t(key, { max: 120 }) : null);

  const onSave = async () => {
    const found = validateEvent(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    await saveEvent(form, id);
    markSaved();
    toast(t('calendar.saved'));
    await nav.pop();
  };

  const onDelete = async () => {
    if (!existing || !id) return;
    if (existing.recurrence && date) {
      const choice = await choiceDialog({
        title: t('calendar.deleteRecurringTitle'),
        choices: [
          { value: 'one', label: t('calendar.deleteOne') },
          { value: 'all', label: t('calendar.deleteAll'), destructive: true },
        ],
      });
      if (!choice) return;
      const { token } = choice === 'one' ? await deleteOccurrence(id, date) : await deleteEvent(id);
      markSaved();
      await nav.pop();
      undoToast(t('calendar.deleted'), token);
      return;
    }
    if (!(await confirmDialog({ title: t('calendar.deleteTitle'), confirmLabel: t('common.delete'), destructive: true }))) return;
    const { token } = await deleteEvent(id);
    markSaved();
    await nav.pop();
    undoToast(t('calendar.deleted'), token);
  };

  const kinds = /** @type {const} */ (['event', 'deadline', 'reminder']);
  return html`
    <${SheetHeader} title=${id ? t('calendar.editEvent') : t('calendar.newEvent')} back />
    <${SheetBody}>
      <${Field} label=${t('calendar.fields.title')} htmlFor=${ids.title} error=${err(errors.title)}>
        <${TextInput} id=${ids.title} value=${form.title} maxLength=${120} invalid=${Boolean(errors.title)} autoFocus=${!id}
          onInput=${(/** @type {string} */ title) => update({ title })} />
      <//>
      <${Field} label=${t('calendar.fields.kind')}>
        <${Segmented} label=${t('calendar.fields.kind')} value=${form.kind}
          options=${kinds.map((k) => ({ value: k, label: t(`calendar.kinds.${k}`) }))}
          onChange=${(/** @type {any} */ kind) => update(kind === 'deadline' && !id ? { kind, allDay: true, reminderOffsetMin: 1440 } : { kind })} />
      <//>
      <div class="group" style="margin-top: 16px">
        <div class="row"><span class="main title">${t('calendar.fields.allDay')}</span>
          <${Switch} label=${t('calendar.fields.allDay')} checked=${form.allDay} onChange=${(/** @type {boolean} */ allDay) => update({ allDay })} /></div>
      </div>
      <${Field} label=${t('calendar.fields.date')} htmlFor=${ids.date} error=${err(errors.date)}>
        <${DateTimeInput} id=${ids.date} type="date" value=${form.date} invalid=${Boolean(errors.date)} onInput=${(/** @type {string} */ v) => update({ date: v })} />
        <div class="chips">
          <button type="button" class="chip-btn" onClick=${() => update({ date: today() })}>${t('calendar.today')}</button>
          <button type="button" class="chip-btn" onClick=${() => update({ date: addDays(today(), 1) })}>${t('calendar.tomorrow')}</button>
        </div>
      <//>
      ${!form.allDay &&
      html`<div class="two-cols">
        <${Field} label=${t('calendar.fields.start')} htmlFor=${ids.start} error=${err(errors.start)}>
          <${DateTimeInput} id=${ids.start} type="time" value=${form.start} invalid=${Boolean(errors.start)} onInput=${(/** @type {string} */ start) => update({ start })} />
        <//>
        <${Field} label=${t('calendar.fields.end')} htmlFor=${ids.end} error=${err(errors.end)}>
          <${DateTimeInput} id=${ids.end} type="time" value=${form.end} invalid=${Boolean(errors.end)} onInput=${(/** @type {string} */ end) => update({ end })} />
        <//>
      </div>`}
      <${Field} label=${t('calendar.fields.repeat')} htmlFor=${ids.repeat}>
        <${Select} id=${ids.repeat} value=${form.repeat}
          options=${['none', 'daily', 'weekly', 'monthly', 'yearly'].map((value) => ({ value, label: t(`calendar.repeat.${value}`) }))}
          onChange=${(/** @type {any} */ repeat) =>
            update(repeat === 'weekly' && !form.byWeekday.length ? { repeat, byWeekday: [weekdayOf(form.date)] } : { repeat })} />
      <//>
      ${form.repeat === 'weekly' &&
      html`<${DayToggles} label=${t('calendar.fields.repeatDays')} value=${form.byWeekday} weekStart=${settings.weekStart ?? 1}
        names=${weekdayNames('short')} onChange=${(/** @type {number[]} */ byWeekday) => update({ byWeekday })} />`}
      ${form.repeat !== 'none' &&
      html`<${Field} label=${t('calendar.fields.until')} htmlFor=${ids.until} optional error=${err(errors.until)}>
        <${DateTimeInput} id=${ids.until} type="date" value=${form.until} min=${form.date} onInput=${(/** @type {string} */ until) => update({ until })} />
      <//>`}
      <${Field} label=${t('calendar.fields.reminder')} htmlFor=${ids.reminder}>
        <${Select} id=${ids.reminder} value=${String(form.reminderOffsetMin)}
          options=${REMINDER_OFFSETS.map((o) => ({ value: String(o), label: reminderLabel(o, form.allDay) }))}
          onChange=${(/** @type {string} */ v) => update({ reminderOffsetMin: v === 'null' ? null : Number(v) })} />
      <//>
      <${Field} label=${t('calendar.fields.location')} htmlFor=${ids.location} optional>
        <${TextInput} id=${ids.location} value=${form.location} maxLength=${120} onInput=${(/** @type {string} */ location) => update({ location })} />
      <//>
      <${Field} label=${t('calendar.fields.notes')} htmlFor=${ids.notes} optional>
        <${TextArea} id=${ids.notes} value=${form.notes} onInput=${(/** @type {string} */ notes) => update({ notes })} />
      <//>
      ${existing?.recurrence && html`<p class="field-help">${t('calendar.seriesNote')}</p>`}
    <//>
    <${SheetFooter}>
      ${id && html`<button type="button" class="btn btn-danger" onClick=${onDelete}>${t('common.delete')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}
