// @ts-check
// Computer window (docs/spec/rooms/study.md S1): Modules · Assignments.

import { html, useState } from '../../ui/lib.js';
import { t, formatDate, formatTime } from '../../core/i18n.js';
import { today } from '../../core/time.js';
import { newId } from '../../core/ids.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Segmented, TextInput, TextArea, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection } from '../../ui/hooks.js';
import { toast } from '../../ui/toast.js';
import { confirmDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { openObject } from '../../ui/navigation.js';
import { COLORS } from '../wardrobe/catalog.js';
import { TaskPage, TaskRow } from '../tasks/window.js';
import { nextAction, openAssignments, assignmentSections, upcomingExams, daysUntil, validateModule } from './model.js';
import { saveModule, setModuleArchived } from './actions.js';

/** @typedef {import('./model.js').StudyModule} StudyModule */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

const session = { tab: 'modules', showArchived: false };
const MODULE_COLORS = ['blue', 'green', 'purple', 'orange', 'red', 'pink', 'yellow', 'navy', 'olive', 'brown'];

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function ComputerWindow({ page, nav }) {
  if (page?.id === 'module') return html`<${ModulePage} id=${page.params?.id ?? null} nav=${nav} />`;
  if (page?.id === 'task') return html`<${TaskPage} id=${page.params?.id ?? null} projectId=${null} defaults=${page.params?.defaults ?? { context: 'study' }} nav=${nav} />`;
  return html`<${ComputerRoot} nav=${nav} />`;
}

/** "in 3 d" / "today" / "2 d ago" @param {number} days */
export function countdown(days) {
  if (days === 0) return t('calendar.today');
  if (days === 1) return t('calendar.tomorrow');
  return days > 0 ? t('study.inDays', { count: days }) : t('study.daysAgo', { count: -days });
}

/** @param {{ nav: Nav }} props */
function ComputerRoot({ nav }) {
  const [tab, setTab] = useState(session.tab);
  return html`
    <${SheetHeader} title=${t('objects.study.computer.name')}>
      <${Segmented} label=${t('study.sections')} value=${tab}
        options=${[{ value: 'modules', label: t('study.modules') }, { value: 'assignments', label: t('study.assignments') }]}
        onChange=${(/** @type {string} */ v) => { session.tab = v; setTab(v); }} />
    <//>
    ${tab === 'modules' ? html`<${ModulesTab} nav=${nav} />` : html`<${AssignmentsTab} nav=${nav} />`}
  `;
}

/** @param {{ nav: Nav }} props */
function ModulesTab({ nav }) {
  const modules = /** @type {StudyModule[]} */ (/** @type {unknown} */ (useCollection('studyModules')));
  const tasks = /** @type {any[]} */ (useCollection('tasks'));
  const events = /** @type {any[]} */ (useCollection('events'));
  const [archived, setArchived] = useState(session.showArchived);
  const day = today();
  const list = modules.filter((m) => m.archived === archived).sort((a, b) => a.name.localeCompare(b.name));
  return html`
    <${SheetBody}>
      ${list.map((m) => {
        const next = nextAction(m, tasks);
        const open = openAssignments(tasks, m.id).length;
        const exam = upcomingExams(events.filter((e) => e.moduleId === m.id), day)[0];
        return html`<button type="button" class="card" key=${m.id} style=${`--chip:${COLORS[m.color] ?? '#6B625B'}`} onClick=${() => nav.push('module', { id: m.id })}>
          <span class="title">${m.name}${m.code ? html` <span class="muted">· ${m.code}</span>` : ''}</span>
          ${next && html`<span class="next-step">→ ${next.text}${next.task?.dueDate ? ` · ${t('study.due', { date: formatDate(next.task.dueDate, { weekday: 'short', day: 'numeric', month: 'short' }) })}` : ''}</span>`}
          <span class="subtitle">${[t('study.openCount', { count: open }), exam ? t('study.examIn', { when: countdown(daysUntil(day, exam.date)) }) : ''].filter(Boolean).join(' · ')}</span>
        </button>`;
      })}
      ${!list.length && html`<div class="empty"><div class="art" aria-hidden="true">🎓</div><p>${t(archived ? 'study.noArchived' : 'study.noModules')}</p></div>`}
      ${(archived || modules.some((m) => m.archived)) &&
      html`<button type="button" class="btn btn-ghost" onClick=${() => { session.showArchived = !archived; setArchived(!archived); }}>${t(archived ? 'tasks.showActive' : 'tasks.showArchived')}</button>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('module', { id: null })}>${icon('plus', { size: 20 })} ${t('study.addModule')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ nav: Nav }} props */
function AssignmentsTab({ nav }) {
  const tasks = /** @type {any[]} */ (useCollection('tasks'));
  const projects = /** @type {any[]} */ (useCollection('projects'));
  const modules = /** @type {StudyModule[]} */ (/** @type {unknown} */ (useCollection('studyModules')));
  const [showDone, setShowDone] = useState(false);
  const sections = assignmentSections(tasks, today());
  return html`
    <${SheetBody}>
      ${sections.map((s) => s.key === 'done' && !showDone
        ? html`<button type="button" class="btn btn-ghost" key="done" onClick=${() => setShowDone(true)}>${t('study.showSubmitted', { count: s.items.length })}</button>`
        : html`<section class="section" key=${s.key}>
            <h3 class="section-title">${t(`study.groups.${s.key}`)}</h3>
            <div class="group">${s.items.map((task) => html`<${TaskRow} key=${task.id} task=${task} nav=${nav} projects=${projects} />`)}</div>
          </section>`)}
      ${!sections.length && html`<div class="empty"><div class="art" aria-hidden="true">📝</div><p>${t(modules.length ? 'study.noAssignments' : 'study.addModuleFirst')}</p></div>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" disabled=${!modules.some((m) => !m.archived)} onClick=${() => nav.push('task', { id: null, defaults: { context: 'study' } })}>${icon('plus', { size: 20 })} ${t('study.addAssignment')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ id: string|null, nav: Nav }} props */
function ModulePage({ id, nav }) {
  const modules = /** @type {StudyModule[]} */ (/** @type {unknown} */ (useCollection('studyModules')));
  const tasks = /** @type {any[]} */ (useCollection('tasks'));
  const projects = /** @type {any[]} */ (useCollection('projects'));
  const events = /** @type {any[]} */ (useCollection('events'));
  const resources = /** @type {any[]} */ (useCollection('studyResources'));
  const existing = id ? modules.find((m) => m.id === id) : undefined;
  const [form, update, markSaved] = useForm({
    name: existing?.name ?? '',
    code: existing?.code ?? '',
    color: existing?.color ?? MODULE_COLORS[modules.length % MODULE_COLORS.length],
    teacher: existing?.teacher ?? '',
    term: existing?.term ?? '',
    credits: existing?.credits ? String(existing.credits) : '',
    links: (existing?.links ?? []).map((l) => ({ ...l })),
    nextActionOverride: existing?.nextActionOverride ?? '',
    notes: existing?.notes ?? '',
  });
  const [tried, setTried] = useState(false);
  const errors = validateModule(form);
  const ids = { name: useFieldId('mo-name'), code: useFieldId('mo-code'), teacher: useFieldId('mo-teacher'), term: useFieldId('mo-term'), credits: useFieldId('mo-credits'), next: useFieldId('mo-next'), notes: useFieldId('mo-notes') };
  const day = today();
  const own = tasks.filter((x) => x.context === 'study' && x.moduleId === id);
  const moduleEvents = events.filter((e) => e.moduleId === id);
  const exams = upcomingExams(moduleEvents, day);
  const classes = moduleEvents.filter((e) => e.kind === 'class');

  const onSave = async () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    await saveModule(form, id);
    markSaved();
    toast(t('common.saved'));
    nav.pop();
  };
  const onArchive = async () => {
    if (!id || !existing) return;
    if (!existing.archived) {
      const ok = await confirmDialog({ title: t('study.archiveTitle', { name: existing.name }), message: t('study.archiveText'), confirmLabel: t('study.archive') });
      if (!ok) return;
    }
    await setModuleArchived(id, !existing.archived);
    markSaved();
    nav.pop();
  };

  return html`
    <${SheetHeader} title=${id ? existing?.name ?? '' : t('study.addModule')} back />
    <${SheetBody}>
      <${Field} label=${t('tasks.fields.name')} htmlFor=${ids.name} error=${tried && errors.name ? t(errors.name) : undefined}>
        <${TextInput} id=${ids.name} value=${form.name} maxLength=${80} onInput=${(/** @type {string} */ name) => update({ name })} autoFocus=${!id} />
      <//>
      <div class="two-cols">
        <${Field} label=${t('study.code')} htmlFor=${ids.code} optional><${TextInput} id=${ids.code} value=${form.code} maxLength=${20} onInput=${(/** @type {string} */ code) => update({ code })} /><//>
        <${Field} label=${t('study.credits')} htmlFor=${ids.credits} optional><${TextInput} id=${ids.credits} type="number" value=${form.credits} onInput=${(/** @type {string} */ credits) => update({ credits })} /><//>
      </div>
      <${Field} label=${t('wardrobe.color')}>
        <div class="swatches" role="radiogroup" aria-label=${t('wardrobe.color')}>
          ${MODULE_COLORS.map((c) => html`<button type="button" key=${c} role="radio" aria-checked=${form.color === c ? 'true' : 'false'} aria-label=${t(`colors.${c}`)}
            style=${`background:${COLORS[c]}`} onClick=${() => update({ color: c })}></button>`)}
        </div>
      <//>
      <div class="two-cols">
        <${Field} label=${t('study.teacher')} htmlFor=${ids.teacher} optional><${TextInput} id=${ids.teacher} value=${form.teacher} maxLength=${60} onInput=${(/** @type {string} */ teacher) => update({ teacher })} /><//>
        <${Field} label=${t('study.term')} htmlFor=${ids.term} optional><${TextInput} id=${ids.term} value=${form.term} maxLength=${40} onInput=${(/** @type {string} */ term) => update({ term })} /><//>
      </div>
      <${Field} label=${t('study.nextAction')} htmlFor=${ids.next} help=${t('study.nextActionHelp')} optional>
        <${TextInput} id=${ids.next} value=${form.nextActionOverride} maxLength=${120} onInput=${(/** @type {string} */ nextActionOverride) => update({ nextActionOverride })} />
      <//>
      <${Field} label=${t('study.links')} error=${tried && errors.links ? t(errors.links) : undefined} optional>
        <div class="group">
          ${form.links.map((l, i) => html`<div class="row link-edit" key=${l.id ?? i}>
            <input class="input" value=${l.label} placeholder=${t('study.linkLabel')} aria-label=${t('study.linkLabel')} maxlength="60"
              onInput=${(/** @type {Event} */ e) => update({ links: form.links.map((x, k) => (k === i ? { ...x, label: /** @type {HTMLInputElement} */ (e.currentTarget).value } : x)) })} />
            <input class="input" type="url" value=${l.url} placeholder="https://" aria-label=${t('media.link')}
              onInput=${(/** @type {Event} */ e) => update({ links: form.links.map((x, k) => (k === i ? { ...x, url: /** @type {HTMLInputElement} */ (e.currentTarget).value } : x)) })} />
            ${existing?.links.some((x) => x.id === l.id && x.url === l.url) && html`<a class="icon-button" href=${l.url} target="_blank" rel="noopener noreferrer" aria-label=${t('media.openLink')}>↗</a>`}
            <button type="button" class="icon-button" aria-label=${t('common.delete')} onClick=${() => update({ links: form.links.filter((_, k) => k !== i) })}>${icon('close', { size: 18 })}</button>
          </div>`)}
        </div>
        <button type="button" class="btn btn-small" style="margin-top:8px" onClick=${() => update({ links: [...form.links, { id: newId(), label: '', url: '' }] })}>${icon('plus', { size: 16 })} ${t('study.addLink')}</button>
      <//>
      <${Field} label=${t('tasks.fields.notes')} htmlFor=${ids.notes} optional>
        <${TextArea} id=${ids.notes} value=${form.notes} onInput=${(/** @type {string} */ notes) => update({ notes })} />
      <//>
      ${id &&
      html`<section class="section">
        <div class="section-head"><h3 class="section-title">${t('study.assignments')}</h3>
          <button type="button" class="btn btn-small" onClick=${() => nav.push('task', { id: null, defaults: { context: 'study', moduleId: id } })}>${icon('plus', { size: 16 })} ${t('study.addAssignment')}</button></div>
        <div class="group">${own.sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')).map((task) => html`<${TaskRow} key=${task.id} task=${task} nav=${nav} projects=${projects} />`)}</div>
        ${!own.length && html`<p class="empty small">${t('study.noAssignments')}</p>`}
      </section>
      <section class="section">
        <h3 class="section-title">${t('study.examsAndClasses')}</h3>
        <div class="group">
          ${exams.map((x) => html`<div class="row" key=${x.event.id}><span class="lead" aria-hidden="true">📝</span>
            <span class="main"><span class="title">${x.event.title}</span><span class="subtitle" style="display:block">${formatDate(x.date, { weekday: 'short', day: 'numeric', month: 'short' })}${x.event.start ? ` ${formatTime(x.event.start)}` : ''}</span></span>
            <span class="meta">${countdown(daysUntil(day, x.date))}</span></div>`)}
          ${classes.map((c) => html`<div class="row" key=${c.id}><span class="lead" aria-hidden="true">🏫</span>
            <span class="main"><span class="title">${c.title}</span><span class="subtitle" style="display:block">${formatTime(c.start)}–${formatTime(c.end)}${c.location ? ` · ${c.location}` : ''}</span></span></div>`)}
        </div>
        ${!exams.length && !classes.length && html`<p class="empty small">${t('study.noExamsClasses')}</p>`}
        <button type="button" class="btn btn-small" style="margin-top:8px" onClick=${() => openObject('study.planner')}>📅 ${t('study.openPlanner')}</button>
      </section>
      <section class="section">
        <button type="button" class="btn" onClick=${() => openObject('study.bookshelf')}>📚 ${t('study.resourcesCount', { count: resources.filter((r) => r.moduleId === id).length })}</button>
      </section>`}
    <//>
    <${SheetFooter}>
      ${id && html`<button type="button" class="btn" onClick=${onArchive}>${existing?.archived ? t('study.restore') : t('study.archive')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}
