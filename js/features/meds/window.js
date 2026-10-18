// @ts-check
// Medication tray window (docs/spec/rooms/bedroom.md B6): Today · Medications · History.

import { html, useState } from '../../ui/lib.js';
import { t, formatTime, formatDate, weekdayNames } from '../../core/i18n.js';
import { today, addDays } from '../../core/time.js';
import { appStore } from '../../core/store.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Segmented, Select, TextInput, DateTimeInput, DayToggles, Switch, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection, useProfile } from '../../ui/hooks.js';
import { PROFILE } from '../../core/schema.js';
import { undoToast, toast } from '../../ui/toast.js';
import { choiceDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { COLORS } from '../wardrobe/catalog.js';
import { dosesOn, doseState, doseId, adherence, needsRefill, validateMedication } from './model.js';
import { saveMedication, setMedicationActive, deleteMedication, markDose, logAsNeeded } from './actions.js';

/** @typedef {import('./model.js').Medication} Medication */
/** @typedef {import('./model.js').DoseLog} DoseLog */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

const FORMS = ['pill', 'capsule', 'liquid', 'drops', 'spray', 'injection', 'patch', 'other'];
const PILL_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'white'];
const session = { tab: 'today' };
/** @param {string} id */
const logOf = (id) => /** @type {DoseLog|undefined} */ (/** @type {unknown} */ (appStore.get('doseLogs', id)));

/** @param {Medication} med */
export function scheduleText(med) {
  const s = med.schedule;
  const times = s.times.map(formatTime).join(', ');
  if (s.type === 'as_needed') return t('meds.schedule.asNeeded');
  if (s.type === 'weekdays') {
    const names = weekdayNames('short');
    return `${(s.days ?? []).map((d) => names[d]).join(', ')} · ${times}`;
  }
  if (s.type === 'interval') return `${t('meds.schedule.everyN', { count: s.everyNDays ?? 2 })} · ${times}`;
  return `${t('meds.schedule.daily')} · ${times}`;
}

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function MedsWindow({ page, nav }) {
  if (page?.id === 'med') return html`<${MedPage} id=${page.params?.id ?? null} nav=${nav} />`;
  return html`<${MedsRoot} nav=${nav} />`;
}

/** @param {{ nav: Nav }} props */
function MedsRoot({ nav }) {
  const [tab, setTab] = useState(session.tab);
  const choose = (/** @type {string} */ v) => {
    session.tab = v;
    setTab(v);
  };
  return html`
    <${SheetHeader} title=${t('objects.bedroom.medicationTray.name')}>
      <${Segmented} label=${t('meds.sections')} value=${tab}
        options=${[{ value: 'today', label: t('meds.today') }, { value: 'list', label: t('meds.medications') }, { value: 'history', label: t('meds.history') }]}
        onChange=${choose} />
    <//>
    ${tab === 'today' && html`<${TodayTab} />`}
    ${tab === 'list' && html`<${ListTab} nav=${nav} />`}
    ${tab === 'history' && html`<${HistoryTab} />`}
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('med', { id: null })}>${icon('plus', { size: 20 })} ${t('meds.add')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

function TodayTab() {
  const meds = /** @type {Medication[]} */ (/** @type {unknown} */ (useCollection('medications')));
  useCollection('doseLogs');
  const [date, setDate] = useState(today());
  const now = new Date();
  const doses = dosesOn(meds, date);
  const asNeeded = meds.filter((m) => m.active && m.schedule.type === 'as_needed');
  const groups = [...new Set(doses.map((d) => d.time))];

  const mark = async (/** @type {Medication} */ med, /** @type {string} */ time, /** @type {'taken'|'skipped'|null} */ status) => {
    const { token } = await markDose(med, date, time, status);
    if (status) undoToast(t(status === 'taken' ? 'meds.markedTaken' : 'meds.markedSkipped', { name: med.name }), token);
  };

  return html`<${SheetBody}>
    <div class="cal-nav">
      <button type="button" class="icon-button" onClick=${() => setDate(addDays(date, -1))} aria-label=${t('calendar.previous')}>${icon('back')}</button>
      <div class="cal-title">${date === today() ? t('calendar.today') : formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
      <button type="button" class="icon-button" onClick=${() => setDate(addDays(date, 1))} aria-label=${t('calendar.next')} disabled=${date >= today()}>${icon('chevron')}</button>
    </div>
    ${groups.map(
      (time) => html`<section class="section" key=${time}>
        <h3 class="section-title">${formatTime(time)}</h3>
        <div class="group">
          ${doses.filter((d) => d.time === time).map(({ med }) => {
            const state = doseState(med, date, time, logOf, now);
            const log = logOf(doseId(med.id, date, time));
            return html`<div class=${`row dose-row ${state}`} key=${med.id}>
              <span class="pill-dot" style=${`background:${COLORS[med.color] ?? '#ccc'}`} aria-hidden="true"></span>
              <span class="main">
                <span class="title">${med.name}</span>
                <span class="subtitle" style="display:block">${med.dose}${med.instructions ? ` · ${med.instructions}` : ''}</span>
                ${(state === 'overdue' || state === 'missed') && html`<span class="state-line warn">${t(`meds.states.${state}`)}</span>`}
              </span>
              ${state === 'taken' || state === 'skipped'
                ? html`<button type="button" class=${`chip-btn status ${state}`} onClick=${() => mark(med, time, null)} aria-label=${t('meds.undoMark')}>
                    ${state === 'taken' ? `✓ ${t('meds.taken')} ${formatTime(new Date(String(log?.at)).toTimeString().slice(0, 5))}` : t('meds.skipped')}
                  </button>`
                : html`<div class="dose-actions">
                    <button type="button" class="btn btn-small" onClick=${() => mark(med, time, 'skipped')}>${t('meds.skip')}</button>
                    <button type="button" class="btn btn-small btn-primary" onClick=${() => mark(med, time, 'taken')}>${t('meds.take')}</button>
                  </div>`}
            </div>`;
          })}
        </div>
      </section>`,
    )}
    ${asNeeded.length > 0 &&
    html`<section class="section">
      <h3 class="section-title">${t('meds.asNeeded')}</h3>
      <div class="group">${asNeeded.map(
        (med) => html`<div class="row" key=${med.id}>
          <span class="pill-dot" style=${`background:${COLORS[med.color] ?? '#ccc'}`} aria-hidden="true"></span>
          <span class="main"><span class="title">${med.name}</span><span class="subtitle" style="display:block">${med.dose}</span></span>
          <button type="button" class="btn btn-small" onClick=${async () => { await logAsNeeded(med, date); toast(t('meds.markedTaken', { name: med.name })); }}>${t('meds.logDose')}</button>
        </div>`,
      )}</div>
    </section>`}
    ${!doses.length && !asNeeded.length && html`<div class="empty"><div class="art" aria-hidden="true">💊</div><p>${t(meds.length ? 'meds.nothingToday' : 'meds.empty')}</p></div>`}
    <p class="disclaimer">${t('meds.disclaimer')}</p>
  <//>`;
}

/** @param {{ nav: Nav }} props */
function ListTab({ nav }) {
  const meds = /** @type {Medication[]} */ (/** @type {unknown} */ (useCollection('medications')));
  const [showArchived, setShowArchived] = useState(false);
  const active = meds.filter((m) => m.active).sort((a, b) => a.name.localeCompare(b.name));
  const archived = meds.filter((m) => !m.active);
  /** @param {Medication} med */
  const row = (med) => html`<button type="button" class="row" key=${med.id} onClick=${() => nav.push('med', { id: med.id })}>
    <span class="pill-dot" style=${`background:${COLORS[med.color] ?? '#ccc'}`} aria-hidden="true"></span>
    <span class="main">
      <span class="title">${med.name} · ${med.dose}</span>
      <span class="subtitle" style="display:block">${scheduleText(med)}</span>
      ${typeof med.stock === 'number' && html`<span class=${`state-line${needsRefill(med) ? ' warn' : ''}`}>${t('meds.left', { count: med.stock })}</span>`}
    </span>
    <span class="chev">${icon('chevron')}</span>
  </button>`;
  return html`<${SheetBody}>
    ${active.length ? html`<div class="group">${active.map(row)}</div>` : html`<div class="empty"><div class="art" aria-hidden="true">💊</div><p>${t('meds.empty')}</p></div>`}
    ${archived.length > 0 &&
    html`<button type="button" class="btn btn-ghost" onClick=${() => setShowArchived(!showArchived)}>${t('meds.archived', { count: archived.length })}</button>
      ${showArchived && html`<div class="group">${archived.map(row)}</div>`}`}
    <p class="disclaimer">${t('meds.disclaimer')}</p>
  <//>`;
}

function HistoryTab() {
  const meds = /** @type {Medication[]} */ (/** @type {unknown} */ (useCollection('medications')));
  const logs = /** @type {DoseLog[]} */ (/** @type {unknown} */ (useCollection('doseLogs')));
  const [medId, setMedId] = useState('');
  const day = today();
  const now = new Date();
  const scope = medId ? meds.filter((m) => m.id === medId) : meds;
  const all = meds.map((m) => ({ ...m, active: true })); // history includes archived medications
  const scoped = medId ? all.filter((m) => m.id === medId) : all;
  const week = adherence(scoped, addDays(day, -7), addDays(day, -1), logOf);
  const days = Array.from({ length: 30 }, (_, i) => addDays(day, -i));
  return html`<${SheetBody}>
    <${Select} value=${medId} label=${t('meds.filter')}
      options=${[{ value: '', label: t('meds.allMeds') }, ...meds.map((m) => ({ value: m.id, label: m.name }))]} onChange=${setMedId} />
    ${week.scheduled > 0 && html`<p class="goal">${t('meds.adherence', { taken: week.taken, scheduled: week.scheduled })}</p>`}
    ${days.map((date) => {
      const doses = dosesOn(scoped, date);
      const extra = logs.filter((l) => l.date === date && !l.scheduledTime && (!medId || l.medicationId === medId));
      if (!doses.length && !extra.length) return null;
      return html`<section class="section" key=${date}>
        <h3 class="section-title">${formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}</h3>
        <div class="history-list">
          ${doses.map(({ med, time }) => {
            const state = doseState(med, date, time, logOf, now);
            const symbol = state === 'taken' ? '✓' : state === 'skipped' ? '–' : state === 'missed' || state === 'overdue' ? '○' : '·';
            return html`<span class=${`hist ${state}`} key=${med.id + time}>${symbol} ${formatTime(time)} ${med.name}</span>`;
          })}
          ${extra.map((l) => html`<span class="hist taken" key=${l.id}>✓ ${scope.find((m) => m.id === l.medicationId)?.name ?? ''} (${t('meds.asNeeded').toLowerCase()})</span>`)}
        </div>
      </section>`;
    })}
  <//>`;
}

/** @param {{ id: string|null, nav: Nav }} props */
function MedPage({ id, nav }) {
  const meds = /** @type {Medication[]} */ (/** @type {unknown} */ (useCollection('medications')));
  const settings = useProfile(PROFILE.settings);
  const existing = id ? meds.find((m) => m.id === id) : undefined;
  const [form, update, markSaved] = useForm({
    name: existing?.name ?? '',
    form: existing?.form ?? 'pill',
    dose: existing?.dose ?? '',
    type: existing?.schedule.type ?? 'daily',
    times: existing?.schedule.times.length ? [...existing.schedule.times] : ['08:00'],
    days: existing?.schedule.days ?? [],
    everyNDays: existing?.schedule.everyNDays ?? 2,
    startDate: existing?.schedule.startDate ?? today(),
    endDate: existing?.schedule.endDate ?? '',
    instructions: existing?.instructions ?? '',
    stock: existing?.stock ?? '',
    dosePerIntake: existing?.dosePerIntake ?? 1,
    refillAt: existing?.refillAt ?? '',
    color: existing?.color ?? 'blue',
    active: existing?.active ?? true,
  });
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const ids = {
    name: useFieldId('m-name'), form: useFieldId('m-form'), dose: useFieldId('m-dose'), every: useFieldId('m-every'), start: useFieldId('m-start'), end: useFieldId('m-end'),
    instr: useFieldId('m-instr'), stock: useFieldId('m-stock'), per: useFieldId('m-per'), refill: useFieldId('m-refill'),
  };
  /** @param {string} k */
  const err = (k) => (errors[k] ? t(errors[k]) : null);

  const onSave = async () => {
    const found = validateMedication(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    await saveMedication(form, id);
    markSaved();
    toast(t('meds.saved'));
    nav.pop();
  };
  const onDelete = async () => {
    if (!id) return;
    const choice = await choiceDialog({
      title: t('meds.deleteTitle'),
      message: t('meds.deleteMessage'),
      choices: [
        { value: 'archive', label: t('meds.archive'), primary: true },
        { value: 'delete', label: t('meds.deleteWithHistory'), destructive: true },
      ],
    });
    if (!choice) return;
    const { token } = choice === 'archive' ? await setMedicationActive(id, false) : await deleteMedication(id);
    markSaved();
    await nav.pop();
    undoToast(t(choice === 'archive' ? 'meds.archivedToast' : 'meds.deleted'), token);
  };

  return html`
    <${SheetHeader} title=${id ? t('meds.edit') : t('meds.new')} back />
    <${SheetBody}>
      <${Field} label=${t('meds.fields.name')} htmlFor=${ids.name} error=${err('name')}>
        <${TextInput} id=${ids.name} value=${form.name} maxLength=${80} autoFocus=${!id} onInput=${(/** @type {string} */ name) => update({ name })} />
      <//>
      <div class="two-cols">
        <${Field} label=${t('meds.fields.form')} htmlFor=${ids.form}>
          <${Select} id=${ids.form} value=${form.form} options=${FORMS.map((f) => ({ value: f, label: t(`meds.forms.${f}`) }))} onChange=${(/** @type {string} */ v) => update({ form: v })} />
        <//>
        <${Field} label=${t('meds.fields.dose')} htmlFor=${ids.dose} error=${err('dose')}>
          <${TextInput} id=${ids.dose} value=${form.dose} maxLength=${40} placeholder=${t('meds.dosePlaceholder')} onInput=${(/** @type {string} */ dose) => update({ dose })} />
        <//>
      </div>
      <${Field} label=${t('meds.fields.schedule')}>
        <${Select} value=${form.type} label=${t('meds.fields.schedule')}
          options=${['daily', 'weekdays', 'interval', 'as_needed'].map((v) => ({ value: v, label: t(`meds.types.${v}`) }))}
          onChange=${(/** @type {any} */ type) => update({ type })} />
      <//>
      ${form.type === 'weekdays' &&
      html`<${DayToggles} label=${t('meds.fields.days')} value=${form.days} weekStart=${settings.weekStart ?? 1} names=${weekdayNames('short')} onChange=${(/** @type {number[]} */ days) => update({ days })} />
        ${errors.days && html`<div class="field-error">${t(errors.days)}</div>`}`}
      ${form.type === 'interval' &&
      html`<${Field} label=${t('meds.fields.everyNDays')} htmlFor=${ids.every} error=${err('everyNDays')}>
        <input id=${ids.every} class="input" type="number" min="2" max="30" inputmode="numeric" value=${form.everyNDays}
          onInput=${(/** @type {Event} */ e) => update({ everyNDays: Number(/** @type {HTMLInputElement} */ (e.currentTarget).value) })} />
      <//>`}
      ${form.type !== 'as_needed' &&
      html`<${Field} label=${t('meds.fields.times')} error=${err('times')}>
        ${form.times.map(
          (time, i) => html`<div class="inline" key=${i} style="margin-bottom:8px">
            <${DateTimeInput} id=${`m-time-${i}`} type="time" value=${time} onInput=${(/** @type {string} */ v) => update({ times: form.times.map((x, k) => (k === i ? v : x)) })} />
            ${form.times.length > 1 && html`<button type="button" class="icon-button" aria-label=${t('common.delete')} onClick=${() => update({ times: form.times.filter((_, k) => k !== i) })}>${icon('close', { size: 18 })}</button>`}
          </div>`,
        )}
        <button type="button" class="chip-btn" onClick=${() => update({ times: [...form.times, '20:00'] })}>+ ${t('meds.addTime')}</button>
      <//>`}
      <div class="two-cols">
        <${Field} label=${t('meds.fields.startDate')} htmlFor=${ids.start} error=${err('startDate')}>
          <${DateTimeInput} id=${ids.start} type="date" value=${form.startDate} onInput=${(/** @type {string} */ startDate) => update({ startDate })} />
        <//>
        <${Field} label=${t('meds.fields.endDate')} htmlFor=${ids.end} optional error=${err('endDate')}>
          <${DateTimeInput} id=${ids.end} type="date" value=${form.endDate} min=${form.startDate} onInput=${(/** @type {string} */ endDate) => update({ endDate })} />
        <//>
      </div>
      <${Field} label=${t('meds.fields.instructions')} htmlFor=${ids.instr} optional>
        <${TextInput} id=${ids.instr} value=${form.instructions} maxLength=${120} placeholder=${t('meds.instructionsPlaceholder')} onInput=${(/** @type {string} */ instructions) => update({ instructions })} />
      <//>
      <div class="three-cols">
        <${Field} label=${t('meds.fields.stock')} htmlFor=${ids.stock} optional error=${err('stock')}>
          <input id=${ids.stock} class="input" type="number" min="0" inputmode="numeric" value=${form.stock} onInput=${(/** @type {Event} */ e) => update({ stock: /** @type {HTMLInputElement} */ (e.currentTarget).value })} />
        <//>
        <${Field} label=${t('meds.fields.perIntake')} htmlFor=${ids.per} error=${err('dosePerIntake')}>
          <input id=${ids.per} class="input" type="number" min="0" step="0.5" inputmode="decimal" value=${form.dosePerIntake} onInput=${(/** @type {Event} */ e) => update({ dosePerIntake: /** @type {HTMLInputElement} */ (e.currentTarget).value })} />
        <//>
        <${Field} label=${t('meds.fields.refillAt')} htmlFor=${ids.refill} optional error=${err('refillAt')}>
          <input id=${ids.refill} class="input" type="number" min="0" inputmode="numeric" value=${form.refillAt} onInput=${(/** @type {Event} */ e) => update({ refillAt: /** @type {HTMLInputElement} */ (e.currentTarget).value })} />
        <//>
      </div>
      <${Field} label=${t('tasks.fields.color')}>
        <div class="swatches" role="radiogroup" aria-label=${t('tasks.fields.color')}>
          ${PILL_COLORS.map((c) => html`<button type="button" key=${c} role="radio" aria-checked=${form.color === c ? 'true' : 'false'} aria-label=${t(`colors.${c}`)} style=${`background:${COLORS[c]}`} onClick=${() => update({ color: c })}></button>`)}
        </div>
      <//>
      <div class="group" style="margin-top:16px">
        <div class="row"><span class="main title">${t('meds.fields.active')}</span>
          <${Switch} label=${t('meds.fields.active')} checked=${form.active} onChange=${(/** @type {boolean} */ active) => update({ active })} /></div>
      </div>
      <p class="disclaimer">${t('meds.disclaimer')}</p>
    <//>
    <${SheetFooter}>
      ${id && html`<button type="button" class="btn btn-danger" onClick=${onDelete}>${t('common.delete')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}
