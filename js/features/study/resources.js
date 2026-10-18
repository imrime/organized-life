// @ts-check
// Study bookshelf window (docs/spec/rooms/study.md S3): module folders with Reading list · Resources · Notes.

import { html, useState } from '../../ui/lib.js';
import { t, formatDate } from '../../core/i18n.js';
import { today } from '../../core/time.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { CheckRow, Field, Segmented, Select, TextInput, TextArea, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection } from '../../ui/hooks.js';
import { toast, undoToast } from '../../ui/toast.js';
import { confirmDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { COLORS } from '../wardrobe/catalog.js';
import { isValidLink } from '../media/model.js';
import { NotePage } from '../tasks/window.js';
import { noteTitle, sortedNotes } from '../tasks/model.js';
import { RESOURCE_TYPES, RESOURCE_ICON, folders } from './model.js';
import { saveResource, setResourceStatus, deleteResource } from './actions.js';

/** @typedef {import('./model.js').StudyResource} StudyResource */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

const session = { section: 'reading' };

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function ResourcesWindow({ page, nav }) {
  if (page?.id === 'folder') return html`<${FolderPage} moduleId=${page.params?.moduleId ?? null} nav=${nav} />`;
  if (page?.id === 'resource') return html`<${ResourcePage} id=${page.params?.id ?? null} moduleId=${page.params?.moduleId ?? null} nav=${nav} />`;
  if (page?.id === 'note') return html`<${NotePage} id=${page.params?.id ?? null} context="study" moduleId=${page.params?.moduleId ?? null} nav=${nav} />`;
  return html`<${FoldersRoot} nav=${nav} />`;
}

/** @param {{ nav: Nav }} props */
function FoldersRoot({ nav }) {
  const modules = /** @type {any[]} */ (useCollection('studyModules'));
  const resources = /** @type {StudyResource[]} */ (/** @type {unknown} */ (useCollection('studyResources')));
  const notes = /** @type {any[]} */ (useCollection('notes'));
  const list = folders(modules, resources, notes);
  return html`
    <${SheetHeader} title=${t('objects.study.bookshelf.name')} />
    <${SheetBody}>
      <div class="group">
        ${list.map((f) => html`<button type="button" class="row" key=${f.id ?? 'general'} onClick=${() => nav.push('folder', { moduleId: f.id })}>
          <span class="lead" aria-hidden="true" style=${`background:${COLORS[f.module?.color ?? 'grey']}33`}>📁</span>
          <span class="main"><span class="title">${f.module?.name ?? t('study.general')}</span>
            <span class="subtitle" style="display:block">${[t('study.resourcesN', { count: f.resources }), t('study.notesN', { count: f.notes }), f.reading ? t('study.readingN', { count: f.reading }) : ''].filter(Boolean).join(' · ')}</span></span>
          ${icon('chevron')}
        </button>`)}
      </div>
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('resource', { id: null, moduleId: null })}>${icon('plus', { size: 20 })} ${t('study.addResource')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** Copies text to the clipboard with a toast. @param {string} text */
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast(t('study.citationCopied'));
  } catch {
    toast(t('study.copyFailed'));
  }
}

/** @param {{ moduleId: string|null, nav: Nav }} props */
function FolderPage({ moduleId, nav }) {
  const modules = /** @type {any[]} */ (useCollection('studyModules'));
  const resources = /** @type {StudyResource[]} */ (/** @type {unknown} */ (useCollection('studyResources')));
  const notes = /** @type {any[]} */ (useCollection('notes'));
  const [section, setSection] = useState(session.section);
  const module = modules.find((m) => m.id === moduleId);
  const own = resources.filter((r) => (r.moduleId ?? null) === moduleId).sort((a, b) => a.title.localeCompare(b.title));
  const reading = own.filter((r) => r.status !== 'reference').sort((a, b) => ['reading', 'to_read', 'done'].indexOf(a.status) - ['reading', 'to_read', 'done'].indexOf(b.status));
  const folderNotes = sortedNotes(notes, (n) => n.context === 'study' && (n.moduleId ?? null) === moduleId);

  return html`
    <${SheetHeader} title=${module?.name ?? t('study.general')} back>
      <${Segmented} label=${t('study.sections')} value=${section}
        options=${['reading', 'resources', 'notes'].map((v) => ({ value: v, label: t(`study.folder.${v}`) }))}
        onChange=${(/** @type {string} */ v) => { session.section = v; setSection(v); }} />
    <//>
    <${SheetBody}>
      ${section === 'reading' &&
      html`<div class="group">${reading.map((r) => html`<${CheckRow} key=${r.id} checked=${r.status === 'done'} label=${`${RESOURCE_ICON[r.type] ?? ''} ${r.title}`}
        sub=${[r.author, t(`study.resourceStatus.${r.status}`)].filter(Boolean).join(' · ')}
        onToggle=${() => setResourceStatus(r.id, r.status === 'done' ? 'reading' : 'done')}
        trailing=${html`<button type="button" class="icon-button" aria-label=${t('common.edit')} onClick=${() => nav.push('resource', { id: r.id })}>${icon('chevron')}</button>`} />`)}</div>
      ${!reading.length && html`<div class="empty"><div class="art" aria-hidden="true">📚</div><p>${t('study.noReading')}</p></div>`}`}
      ${section === 'resources' &&
      html`<div class="group">${own.map((r) => html`<div class="row" key=${r.id}>
        <button type="button" class="row-hit" onClick=${() => nav.push('resource', { id: r.id })}>
          <span class="lead" aria-hidden="true">${RESOURCE_ICON[r.type] ?? '🗒️'}</span>
          <span class="main"><span class="title">${r.title}</span>${r.author && html`<span class="subtitle" style="display:block">${r.author}</span>`}</span>
        </button>
        ${r.url && html`<a class="icon-button" href=${r.url} target="_blank" rel="noopener noreferrer" aria-label=${t('media.openLink')}>↗</a>`}
        ${r.citation && html`<button type="button" class="icon-button" aria-label=${t('study.copyCitation')} onClick=${() => copy(/** @type {string} */ (r.citation))}>❝</button>`}
      </div>`)}</div>
      ${!own.length && html`<div class="empty"><div class="art" aria-hidden="true">🔖</div><p>${t('study.noResources')}</p></div>`}`}
      ${section === 'notes' &&
      html`<div class="group">${folderNotes.map((n) => html`<button type="button" class="row" key=${n.id} onClick=${() => nav.push('note', { id: n.id, moduleId })}>
        <span class="main"><span class="title">${n.pinned ? '📌 ' : ''}${noteTitle(n) || t('tasks.untitled')}</span></span>
        <span class="meta">${formatDate(String(n.updatedAt ?? '').slice(0, 10) || today(), { day: 'numeric', month: 'short' })}</span>
      </button>`)}</div>
      ${!folderNotes.length && html`<div class="empty"><div class="art" aria-hidden="true">📝</div><p>${t('study.noNotes')}</p></div>`}`}
    <//>
    <${SheetFooter}>
      ${section === 'notes'
        ? html`<button type="button" class="btn" onClick=${() => nav.push('note', { id: null, moduleId })}>${icon('plus', { size: 20 })} ${t('tasks.newNote')}</button>`
        : html`<button type="button" class="btn" onClick=${() => nav.push('resource', { id: null, moduleId })}>${icon('plus', { size: 20 })} ${t('study.addResource')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ id: string|null, moduleId: string|null, nav: Nav }} props */
function ResourcePage({ id, moduleId, nav }) {
  const resources = /** @type {StudyResource[]} */ (/** @type {unknown} */ (useCollection('studyResources')));
  const modules = /** @type {any[]} */ (useCollection('studyModules')).filter((m) => !m.archived);
  const existing = id ? resources.find((r) => r.id === id) : undefined;
  const [form, update, markSaved] = useForm({
    title: existing?.title ?? '',
    type: existing?.type ?? 'book',
    author: existing?.author ?? '',
    url: existing?.url ?? '',
    citation: existing?.citation ?? '',
    status: existing?.status ?? 'to_read',
    moduleId: existing?.moduleId ?? moduleId ?? '',
    notes: existing?.notes ?? '',
  });
  const [tried, setTried] = useState(false);
  const ids = { title: useFieldId('rs-title'), author: useFieldId('rs-author'), url: useFieldId('rs-url'), cite: useFieldId('rs-cite'), notes: useFieldId('rs-notes') };
  const urlOk = isValidLink(form.url.trim());
  const onSave = async () => {
    setTried(true);
    if (!form.title.trim() || !urlOk) return;
    await saveResource({ ...form, moduleId: form.moduleId || null }, id);
    markSaved();
    toast(t('common.saved'));
    nav.pop();
  };
  const onDelete = async () => {
    if (!id) return;
    const ok = await confirmDialog({ title: t('media.deleteTitle', { title: existing?.title ?? '' }), confirmLabel: t('common.delete'), destructive: true });
    if (!ok) return;
    const { token } = await deleteResource(id);
    markSaved();
    await nav.pop();
    undoToast(t('media.deleted'), token);
  };
  return html`
    <${SheetHeader} title=${id ? t('study.resource') : t('study.addResource')} back />
    <${SheetBody}>
      <${Field} label=${t('media.title')} htmlFor=${ids.title} error=${tried && !form.title.trim() ? t('form.errors.required') : undefined}>
        <${TextInput} id=${ids.title} value=${form.title} maxLength=${160} onInput=${(/** @type {string} */ title) => update({ title })} autoFocus=${!id} />
      <//>
      <div class="two-cols">
        <${Field} label=${t('media.type')}>
          <${Select} label=${t('media.type')} value=${form.type} options=${RESOURCE_TYPES.map((v) => ({ value: v, label: `${RESOURCE_ICON[v]} ${t(`study.resourceTypes.${v}`)}` }))} onChange=${(/** @type {string} */ type) => update({ type })} />
        <//>
        <${Field} label=${t('study.module')}>
          <${Select} label=${t('study.module')} value=${form.moduleId} options=${[{ value: '', label: t('study.general') }, ...modules.map((m) => ({ value: m.id, label: m.name }))]} onChange=${(/** @type {string} */ v) => update({ moduleId: v })} />
        <//>
      </div>
      <${Field} label=${t('media.status')}>
        <${Segmented} label=${t('media.status')} value=${form.status} options=${['to_read', 'reading', 'done', 'reference'].map((v) => ({ value: v, label: t(`study.resourceStatus.${v}`) }))} onChange=${(/** @type {string} */ status) => update({ status })} />
      <//>
      <${Field} label=${t('media.creator.book')} htmlFor=${ids.author} optional><${TextInput} id=${ids.author} value=${form.author} maxLength=${80} onInput=${(/** @type {string} */ author) => update({ author })} /><//>
      <${Field} label=${t('media.link')} htmlFor=${ids.url} error=${tried && !urlOk ? t('media.errors.link') : undefined} optional>
        <${TextInput} id=${ids.url} type="url" value=${form.url} placeholder="https://" onInput=${(/** @type {string} */ url) => update({ url })} />
      <//>
      <${Field} label=${t('study.citation')} htmlFor=${ids.cite} optional>
        <${TextArea} id=${ids.cite} value=${form.citation} rows=${2} onInput=${(/** @type {string} */ citation) => update({ citation })} />
      <//>
      ${form.citation.trim() && html`<button type="button" class="btn btn-small" onClick=${() => copy(form.citation.trim())}>❝ ${t('study.copyCitation')}</button>`}
      <${Field} label=${t('tasks.fields.notes')} htmlFor=${ids.notes} optional><${TextArea} id=${ids.notes} value=${form.notes} onInput=${(/** @type {string} */ notes) => update({ notes })} /><//>
    <//>
    <${SheetFooter}>
      ${id && html`<button type="button" class="btn btn-danger" onClick=${onDelete}>${t('common.delete')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}
