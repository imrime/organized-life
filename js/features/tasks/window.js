// @ts-check
// Desk / notebook window (docs/spec/rooms/bedroom.md B5): Tasks · Projects · Notes.

import { html, useEffect, useRef, useState } from '../../ui/lib.js';
import { t, formatDate, formatTime } from '../../core/i18n.js';
import { today, addDays } from '../../core/time.js';
import { newId } from '../../core/ids.js';
import { matchesQuery } from '../../core/text.js';
import { SheetHeader, SheetBody, SheetFooter, DoneFooter } from '../../ui/sheet.js';
import { Field, Segmented, Select, TextInput, TextArea, DateTimeInput, Switch, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection } from '../../ui/hooks.js';
import { undoToast, toast } from '../../ui/toast.js';
import { confirmDialog, choiceDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { COLORS } from '../wardrobe/catalog.js';
import { taskSections, dueState, validateTask, projectProgress, checklistProgress, sortedNotes, noteTitle } from './model.js';
import {
  quickAddTask, saveTask, setTaskDone, deleteTask, saveProject, setProjectArchived, deleteProject, saveNote, deleteNote,
} from './actions.js';

/** @typedef {import('./model.js').Task} Task */
/** @typedef {import('./model.js').Project} Project */
/** @typedef {import('./model.js').Note} Note */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

const PROJECT_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown'];
const session = { tab: 'tasks', filter: /** @type {'today'|'upcoming'|'all'|'done'} */ ('all'), context: /** @type {string|null} */ (null) };

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav, props: Record<string, any> }} args */
export default function TasksWindow({ page, nav, props }) {
  if (page?.id === 'task') return html`<${TaskPage} id=${page.params?.id ?? null} projectId=${page.params?.projectId ?? null} nav=${nav} />`;
  if (page?.id === 'project') return html`<${ProjectPage} id=${page.params?.id ?? null} nav=${nav} />`;
  if (page?.id === 'note') return html`<${NotePage} id=${page.params?.id ?? null} nav=${nav} />`;
  return html`<${DeskRoot} nav=${nav} initialTab=${props.tab} />`;
}

/** @param {{ nav: Nav, initialTab?: string }} props */
function DeskRoot({ nav, initialTab }) {
  const [tab, setTab] = useState(initialTab ?? session.tab);
  const choose = (/** @type {string} */ v) => {
    session.tab = v;
    setTab(v);
  };
  return html`
    <${SheetHeader} title=${t('objects.bedroom.deskNotebook.name')}>
      <${Segmented}
        label=${t('tasks.sections')}
        value=${tab}
        options=${[
          { value: 'tasks', label: t('tasks.tasks') },
          { value: 'projects', label: t('tasks.projects') },
          { value: 'notes', label: t('tasks.notes') },
        ]}
        onChange=${choose}
      />
    <//>
    ${tab === 'tasks' && html`<${TasksTab} nav=${nav} />`}
    ${tab === 'projects' && html`<${ProjectsTab} nav=${nav} />`}
    ${tab === 'notes' && html`<${NotesTab} nav=${nav} />`}
  `;
}

/** @param {Task} task */
function dueLabel(task) {
  if (!task.dueDate) return '';
  const state = dueState(task, today());
  const day = state === 'today' ? t('calendar.today') : state === 'tomorrow' ? t('calendar.tomorrow') : formatDate(task.dueDate, { day: 'numeric', month: 'short' });
  return task.dueTime ? `${day} ${formatTime(task.dueTime)}` : day;
}

/** @param {{ task: Task, nav: Nav, projects: Project[] }} props */
export function TaskRow({ task, nav, projects }) {
  const done = task.status === 'done';
  const state = dueState(task, today());
  const progress = checklistProgress(task);
  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : undefined;
  const toggle = async () => {
    const { token } = await setTaskDone(task.id, !done);
    if (!done) undoToast(t('tasks.completed'), token);
  };
  return html`<div class="row task-row">
    <button type="button" class=${`check${done ? ' on' : ''}`} role="checkbox" aria-checked=${done ? 'true' : 'false'} aria-label=${task.title} onClick=${toggle}>
      ${done && icon('check', { size: 18 })}
    </button>
    <button type="button" class="row-hit" onClick=${() => nav.push('task', { id: task.id })}>
      <span class="main">
        <span class=${`title${done ? ' done' : ''}`}>${task.priority === 'high' ? '⚑ ' : ''}${task.title}</span>
        <span class="subtitle meta-line">
          ${task.dueDate && html`<span class=${`due ${state}`}>${dueLabel(task)}</span>`}
          ${project && html`<span class="chip" style=${`--chip:${COLORS[project.color] ?? '#6B625B'}`}>${project.name}</span>`}
          ${progress && html`<span>☑ ${progress.done}/${progress.total}</span>`}
          ${task.context === 'homework' && html`<span>📚</span>`}
        </span>
      </span>
    </button>
  </div>`;
}

/** @param {{ nav: Nav }} props */
function TasksTab({ nav }) {
  const tasks = /** @type {Task[]} */ (/** @type {unknown} */ (useCollection('tasks')));
  const projects = /** @type {Project[]} */ (/** @type {unknown} */ (useCollection('projects')));
  const [filter, setFilter] = useState(session.filter);
  const [context, setContext] = useState(session.context);
  const [draft, setDraft] = useState('');
  const sections = taskSections(tasks, today(), filter, context);

  const add = async (/** @type {Event} */ e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    await quickAddTask(draft, { context: context ?? 'personal', dueDate: filter === 'today' ? today() : null });
    setDraft('');
  };

  return html`
    <${SheetBody}>
      <form class="quick-add" onSubmit=${add}>
        <input class="input" value=${draft} maxlength="120" placeholder=${t('tasks.quickAdd')} aria-label=${t('tasks.quickAdd')}
          onInput=${(/** @type {Event} */ e) => setDraft(/** @type {HTMLInputElement} */ (e.currentTarget).value)} />
        <button type="submit" class="btn" disabled=${!draft.trim()} aria-label=${t('tasks.add')}>${icon('plus', { size: 20 })}</button>
      </form>
      <div class="chips">
        ${['today', 'upcoming', 'all', 'done'].map(
          (f) => html`<button type="button" class="chip-btn" aria-pressed=${filter === f ? 'true' : 'false'} onClick=${() => {
            session.filter = /** @type {any} */ (f);
            setFilter(/** @type {any} */ (f));
          }}>${t(`tasks.filters.${f}`)}</button>`,
        )}
        <span class="chip-sep"></span>
        ${[null, 'personal', 'homework'].map(
          (c) => html`<button type="button" class="chip-btn" aria-pressed=${context === c ? 'true' : 'false'} onClick=${() => {
            session.context = c;
            setContext(c);
          }}>${t(`tasks.contexts.${c ?? 'all'}`)}</button>`,
        )}
      </div>
      ${sections.map(
        (section) => html`<section class="section" key=${section.key}>
          <h3 class="section-title">${t(`tasks.groups.${section.key}`)}</h3>
          <div class="group">${section.items.map((task) => html`<${TaskRow} key=${task.id} task=${task} nav=${nav} projects=${projects} />`)}</div>
        </section>`,
      )}
      ${!sections.length && html`<div class="empty"><div class="art" aria-hidden="true">📓</div><p>${t(filter === 'done' ? 'tasks.emptyDone' : 'tasks.empty')}</p></div>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('task', { id: null })}>${icon('plus', { size: 20 })} ${t('tasks.newTask')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

const REMINDERS = [null, 0, 10, 60, 1440];

/** @param {{ id: string|null, projectId: string|null, nav: Nav }} props */
function TaskPage({ id, projectId, nav }) {
  const tasks = /** @type {Task[]} */ (/** @type {unknown} */ (useCollection('tasks')));
  const projects = /** @type {Project[]} */ (/** @type {unknown} */ (useCollection('projects')));
  const existing = id ? tasks.find((x) => x.id === id) : undefined;
  const [form, update, markSaved] = useForm({
    title: existing?.title ?? '',
    notes: existing?.notes ?? '',
    dueDate: existing?.dueDate ?? '',
    dueTime: existing?.dueTime ?? '',
    reminderOffsetMin: existing ? existing.reminderOffsetMin : null,
    priority: existing?.priority ?? 'normal',
    context: existing?.context ?? 'personal',
    projectId: existing?.projectId ?? projectId ?? '',
    status: existing?.status ?? 'todo',
    checklist: (existing?.checklist ?? []).map((c) => ({ ...c })),
    grade: existing?.grade ?? '',
  });
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const [item, setItem] = useState('');
  const ids = { title: useFieldId('t-title'), notes: useFieldId('t-notes'), date: useFieldId('t-date'), time: useFieldId('t-time'), rem: useFieldId('t-rem'), proj: useFieldId('t-proj'), item: useFieldId('t-item') };

  const onSave = async () => {
    const found = validateTask(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    await saveTask(form, id);
    markSaved();
    toast(t('tasks.saved'));
    nav.pop();
  };
  const onDelete = async () => {
    if (!id) return;
    const { token } = await deleteTask(id);
    markSaved();
    await nav.pop();
    undoToast(t('tasks.deleted'), token);
  };
  const addItem = () => {
    if (!item.trim()) return;
    update({ checklist: [...form.checklist, { id: newId(), label: item.trim().slice(0, 120), done: false }] });
    setItem('');
  };
  const reminderLabel = (/** @type {number|null} */ o) =>
    o === null ? t('calendar.reminders.none') : o === 0 ? t('tasks.reminderAtDue') : o < 60 ? t('calendar.reminders.minutes', { count: o }) : o < 1440 ? t('calendar.reminders.hours', { count: o / 60 }) : t('calendar.reminders.days', { count: o / 1440 });

  return html`
    <${SheetHeader} title=${id ? t('tasks.editTask') : t('tasks.newTask')} back />
    <${SheetBody}>
      <${Field} label=${t('tasks.fields.title')} htmlFor=${ids.title} error=${errors.title && t(errors.title, { max: 120 })}>
        <${TextInput} id=${ids.title} value=${form.title} maxLength=${120} autoFocus=${!id} invalid=${Boolean(errors.title)} onInput=${(/** @type {string} */ title) => update({ title })} />
      <//>
      ${id && html`<${Field} label=${t('tasks.fields.status')}>
        <${Segmented} label=${t('tasks.fields.status')} value=${form.status}
          options=${['todo', 'doing', 'done'].map((v) => ({ value: v, label: t(`tasks.status.${v}`) }))}
          onChange=${(/** @type {any} */ status) => update({ status })} />
      <//>`}
      <div class="two-cols">
        <${Field} label=${t('tasks.fields.dueDate')} htmlFor=${ids.date} optional error=${errors.dueDate && t(errors.dueDate)}>
          <${DateTimeInput} id=${ids.date} type="date" value=${form.dueDate} onInput=${(/** @type {string} */ dueDate) => update({ dueDate })} />
        <//>
        <${Field} label=${t('tasks.fields.dueTime')} htmlFor=${ids.time} optional error=${errors.dueTime && t(errors.dueTime)}>
          <${DateTimeInput} id=${ids.time} type="time" value=${form.dueTime} onInput=${(/** @type {string} */ dueTime) => update({ dueTime })} />
        <//>
      </div>
      <div class="chips">
        <button type="button" class="chip-btn" onClick=${() => update({ dueDate: today() })}>${t('calendar.today')}</button>
        <button type="button" class="chip-btn" onClick=${() => update({ dueDate: addDays(today(), 1) })}>${t('calendar.tomorrow')}</button>
        <button type="button" class="chip-btn" onClick=${() => update({ dueDate: addDays(today(), 7) })}>${t('tasks.nextWeek')}</button>
        ${form.dueDate && html`<button type="button" class="chip-btn" onClick=${() => update({ dueDate: '', dueTime: '', reminderOffsetMin: null })}>${t('tasks.noDate')}</button>`}
      </div>
      ${form.dueDate && html`<${Field} label=${t('calendar.fields.reminder')} htmlFor=${ids.rem}>
        <${Select} id=${ids.rem} value=${String(form.reminderOffsetMin)} options=${REMINDERS.map((o) => ({ value: String(o), label: reminderLabel(o) }))}
          onChange=${(/** @type {string} */ v) => update({ reminderOffsetMin: v === 'null' ? null : Number(v) })} />
      <//>`}
      <${Field} label=${t('tasks.fields.priority')}>
        <${Segmented} label=${t('tasks.fields.priority')} value=${form.priority}
          options=${['low', 'normal', 'high'].map((v) => ({ value: v, label: t(`tasks.priority.${v}`) }))}
          onChange=${(/** @type {any} */ priority) => update({ priority })} />
      <//>
      <${Field} label=${t('tasks.fields.context')}>
        <${Segmented} label=${t('tasks.fields.context')} value=${form.context}
          options=${['personal', 'homework'].map((v) => ({ value: v, label: t(`tasks.contexts.${v}`) }))}
          onChange=${(/** @type {any} */ context) => update({ context })} />
      <//>
      <${Field} label=${t('tasks.fields.project')} htmlFor=${ids.proj} optional>
        <${Select} id=${ids.proj} value=${form.projectId}
          options=${[{ value: '', label: t('tasks.noProject') }, ...projects.filter((p) => !p.archived || p.id === form.projectId).map((p) => ({ value: p.id, label: p.name }))]}
          onChange=${(/** @type {string} */ projectId) => update({ projectId })} />
      <//>
      <${Field} label=${t('tasks.fields.checklist')} htmlFor=${ids.item} optional>
        ${form.checklist.length > 0 &&
        html`<div class="group">${form.checklist.map(
          (c, i) => html`<div class="row" key=${c.id}>
            <button type="button" class=${`check${c.done ? ' on' : ''}`} role="checkbox" aria-checked=${c.done ? 'true' : 'false'} aria-label=${c.label}
              onClick=${() => update({ checklist: form.checklist.map((x, k) => (k === i ? { ...x, done: !x.done } : x)) })}>${c.done && icon('check', { size: 18 })}</button>
            <span class=${`main title${c.done ? ' done' : ''}`}>${c.label}</span>
            <button type="button" class="icon-button" aria-label=${t('common.delete')} onClick=${() => update({ checklist: form.checklist.filter((_, k) => k !== i) })}>${icon('close', { size: 18 })}</button>
          </div>`,
        )}</div>`}
        <div class="inline" style="margin-top:8px">
          <${TextInput} id=${ids.item} value=${item} maxLength=${120} placeholder=${t('tasks.addItem')} onInput=${setItem} />
          <button type="button" class="btn" onClick=${addItem} disabled=${!item.trim()} aria-label=${t('tasks.addItem')}>${icon('plus', { size: 18 })}</button>
        </div>
      <//>
      <${Field} label=${t('tasks.fields.notes')} htmlFor=${ids.notes} optional>
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

/** @param {{ nav: Nav }} props */
function ProjectsTab({ nav }) {
  const tasks = /** @type {Task[]} */ (/** @type {unknown} */ (useCollection('tasks')));
  const projects = /** @type {Project[]} */ (/** @type {unknown} */ (useCollection('projects')));
  const [showArchived, setShowArchived] = useState(false);
  const list = projects.filter((p) => p.archived === showArchived).sort((a, b) => a.name.localeCompare(b.name));
  return html`
    <${SheetBody}>
      ${list.map((p) => {
        const { done, total, next } = projectProgress(p, tasks);
        return html`<button type="button" class="card project-card" key=${p.id} style=${`--chip:${COLORS[p.color] ?? '#6B625B'}`} onClick=${() => nav.push('project', { id: p.id })}>
          <span class="title">${p.name}</span>
          <span class="bar"><i style=${`width:${total ? (done / total) * 100 : 0}%`}></i></span>
          <span class="subtitle">${t('tasks.progress', { done, total })}${next ? ` · ${t('tasks.next', { title: next.title })}` : ''}</span>
        </button>`;
      })}
      ${!list.length && html`<div class="empty"><div class="art" aria-hidden="true">🗂️</div><p>${t(showArchived ? 'tasks.noArchived' : 'tasks.noProjects')}</p></div>`}
      <button type="button" class="btn btn-ghost" onClick=${() => setShowArchived(!showArchived)}>${t(showArchived ? 'tasks.showActive' : 'tasks.showArchived')}</button>
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('project', { id: null })}>${icon('plus', { size: 20 })} ${t('tasks.newProject')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ id: string|null, nav: Nav }} props */
function ProjectPage({ id, nav }) {
  const tasks = /** @type {Task[]} */ (/** @type {unknown} */ (useCollection('tasks')));
  const projects = /** @type {Project[]} */ (/** @type {unknown} */ (useCollection('projects')));
  const existing = id ? projects.find((p) => p.id === id) : undefined;
  const [form, update, markSaved] = useForm({ name: existing?.name ?? '', color: existing?.color ?? 'blue', notes: existing?.notes ?? '' });
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const ids = { name: useFieldId('p-name'), notes: useFieldId('p-notes') };
  const own = tasks.filter((x) => x.projectId === id).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.order - b.order);

  const onSave = async () => {
    if (!form.name.trim()) return setError(t('form.errors.required'));
    await saveProject(form, id);
    markSaved();
    toast(t('common.saved'));
    nav.pop();
  };
  const onDelete = async () => {
    if (!id) return;
    const choice = own.length
      ? await choiceDialog({ title: t('tasks.deleteProject'), choices: [{ value: 'keep', label: t('tasks.keepTasks') }, { value: 'all', label: t('tasks.deleteTasksToo'), destructive: true }] })
      : (await confirmDialog({ title: t('tasks.deleteProject'), confirmLabel: t('common.delete'), destructive: true })) ? 'keep' : null;
    if (!choice) return;
    const { token } = await deleteProject(id, choice === 'all');
    markSaved();
    await nav.pop();
    undoToast(t('tasks.projectDeleted'), token);
  };
  const add = async (/** @type {Event} */ e) => {
    e.preventDefault();
    if (!draft.trim() || !id) return;
    await quickAddTask(draft, { context: existing?.context ?? 'personal', projectId: id });
    setDraft('');
  };

  return html`
    <${SheetHeader} title=${id ? form.name || t('tasks.project') : t('tasks.newProject')} back />
    <${SheetBody}>
      <${Field} label=${t('tasks.fields.name')} htmlFor=${ids.name} error=${error || null}>
        <${TextInput} id=${ids.name} value=${form.name} maxLength=${80} autoFocus=${!id} onInput=${(/** @type {string} */ name) => update({ name })} />
      <//>
      <${Field} label=${t('tasks.fields.color')}>
        <div class="swatches" role="radiogroup" aria-label=${t('tasks.fields.color')}>
          ${PROJECT_COLORS.map(
            (c) => html`<button type="button" key=${c} role="radio" aria-checked=${form.color === c ? 'true' : 'false'} aria-label=${t(`colors.${c}`)}
              style=${`background:${COLORS[c]}`} onClick=${() => update({ color: c })}></button>`,
          )}
        </div>
      <//>
      ${id &&
      html`<section class="section">
        <h3 class="section-title">${t('tasks.checklistTitle')}</h3>
        <form class="quick-add" onSubmit=${add}>
          <input class="input" value=${draft} maxlength="120" placeholder=${t('tasks.quickAdd')} aria-label=${t('tasks.quickAdd')}
            onInput=${(/** @type {Event} */ e) => setDraft(/** @type {HTMLInputElement} */ (e.currentTarget).value)} />
          <button type="submit" class="btn" disabled=${!draft.trim()} aria-label=${t('tasks.add')}>${icon('plus', { size: 20 })}</button>
        </form>
        <div class="group">${own.map((task) => html`<${TaskRow} key=${task.id} task=${task} nav=${nav} projects=${projects} />`)}</div>
      </section>`}
      <${Field} label=${t('tasks.fields.notes')} htmlFor=${ids.notes} optional>
        <${TextArea} id=${ids.notes} value=${form.notes} onInput=${(/** @type {string} */ notes) => update({ notes })} />
      <//>
      ${existing &&
      html`<button type="button" class="btn btn-ghost" style="margin-top:12px" onClick=${() => setProjectArchived(existing.id, !existing.archived)}>
        ${t(existing.archived ? 'tasks.unarchive' : 'tasks.archive')}
      </button>`}
    <//>
    <${SheetFooter}>
      ${id && html`<button type="button" class="btn btn-danger" onClick=${onDelete}>${t('common.delete')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}

/** @param {{ nav: Nav }} props */
function NotesTab({ nav }) {
  const notes = /** @type {Note[]} */ (/** @type {unknown} */ (useCollection('notes')));
  const [query, setQuery] = useState('');
  const list = sortedNotes(notes, (n) => matchesQuery(`${n.title} ${n.body}`, query));
  return html`
    <${SheetBody}>
      <input class="search" type="search" value=${query} placeholder=${t('tasks.searchNotes')} aria-label=${t('tasks.searchNotes')}
        onInput=${(/** @type {Event} */ e) => setQuery(/** @type {HTMLInputElement} */ (e.currentTarget).value)} />
      <div class="group" style="margin-top:12px">
        ${list.map(
          (n) => html`<button type="button" class="row" key=${n.id} onClick=${() => nav.push('note', { id: n.id })}>
            <span class="main">
              <span class="title">${n.pinned ? '📌 ' : ''}${noteTitle(n) || t('tasks.untitled')}</span>
              <span class="subtitle clamp">${n.title.trim() ? n.body.trim().split('\n')[0] : ''}</span>
            </span>
            <span class="meta">${formatDate(String(n.updatedAt ?? '').slice(0, 10) || today(), { day: 'numeric', month: 'short' })}</span>
          </button>`,
        )}
      </div>
      ${!list.length && html`<div class="empty"><div class="art" aria-hidden="true">📝</div><p>${t(query ? 'tasks.noNotesFound' : 'tasks.noNotes')}</p></div>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('note', { id: null })}>${icon('plus', { size: 20 })} ${t('tasks.newNote')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** Note editor: autosaves 500 ms after typing stops (and on leaving). @param {{ id: string|null, nav: Nav }} props */
function NotePage({ id, nav }) {
  const notes = /** @type {Note[]} */ (/** @type {unknown} */ (useCollection('notes')));
  const noteId = useRef(id ?? newId());
  const existing = notes.find((n) => n.id === noteId.current);
  const [form, setForm] = useState({ title: existing?.title ?? '', body: existing?.body ?? '', pinned: existing?.pinned ?? false });
  const timer = useRef(/** @type {ReturnType<typeof setTimeout>|undefined} */ (undefined));
  const latest = useRef(form);
  const saved = useRef(JSON.stringify(form));
  const ids = { title: useFieldId('n-title'), body: useFieldId('n-body') };

  const flush = () => {
    clearTimeout(timer.current);
    const value = latest.current;
    const json = JSON.stringify(value);
    if (json === saved.current || (!value.title.trim() && !value.body.trim() && !hasNote(noteId.current, notes))) return;
    saved.current = json;
    saveNote(value, noteId.current);
  };
  useEffect(() => () => flush(), []);
  const change = (/** @type {Partial<typeof form>} */ patch) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setForm(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
  };
  const onDelete = async () => {
    clearTimeout(timer.current);
    saved.current = JSON.stringify(latest.current);
    if (!notes.some((n) => n.id === noteId.current)) return nav.pop();
    const { token } = await deleteNote(noteId.current);
    await nav.pop();
    undoToast(t('tasks.noteDeleted'), token);
  };

  return html`
    <${SheetHeader} title=${t(id ? 'tasks.note' : 'tasks.newNote')} back />
    <${SheetBody}>
      <input id=${ids.title} class="input note-title" value=${form.title} maxlength="120" placeholder=${t('tasks.fields.title')} aria-label=${t('tasks.fields.title')}
        onInput=${(/** @type {Event} */ e) => change({ title: /** @type {HTMLInputElement} */ (e.currentTarget).value })} />
      <${TextArea} id=${ids.body} value=${form.body} rows=${10} placeholder=${t('tasks.noteBody')} onInput=${(/** @type {string} */ body) => change({ body })} />
      <div class="group" style="margin-top:12px">
        <div class="row"><span class="main title">📌 ${t('tasks.pin')}</span>
          <${Switch} label=${t('tasks.pin')} checked=${form.pinned} onChange=${(/** @type {boolean} */ pinned) => change({ pinned })} /></div>
      </div>
      <p class="field-help">${t('tasks.autosave')}</p>
    <//>
    <${SheetFooter}>
      <button type="button" class="btn btn-danger" onClick=${onDelete}>${t('common.delete')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => { flush(); nav.pop(); }}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {string} id @param {Note[]} notes */
function hasNote(id, notes) {
  return notes.some((n) => n.id === id);
}


