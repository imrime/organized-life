// @ts-check
// Art supplies window (docs/spec/rooms/entertainment.md E4): project board Ideas · In progress · Done.

import { html, useState } from '../../ui/lib.js';
import { t } from '../../core/i18n.js';
import { newId } from '../../core/ids.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Segmented, Select, Switch, TextInput, TextArea, DateTimeInput, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection } from '../../ui/hooks.js';
import { toast, undoToast } from '../../ui/toast.js';
import { confirmDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { randomPick, isValidLink } from '../media/model.js';
import { ChipSelect } from '../media/item-page.js';
import { revealRow } from '../media/ui.js';
import { MEDIUMS, MEDIUM_ICON, columnOf, missingMaterials } from './model.js';
import { saveProject, setProjectStatus, deleteProject, addMissingMaterials } from './actions.js';

/** @typedef {import('./model.js').CreativeProject} CreativeProject */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

const session = { column: 'in_progress' };

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function CreativeWindow({ page, nav }) {
  if (page?.id === 'project') return html`<${ProjectPage} id=${page.params?.id ?? null} nav=${nav} />`;
  return html`<${Board} nav=${nav} />`;
}

/** @param {{ nav: Nav }} props */
function Board({ nav }) {
  const projects = /** @type {CreativeProject[]} */ (/** @type {unknown} */ (useCollection('creativeProjects')));
  const [column, setColumn] = useState(session.column);
  const [picked, setPicked] = useState(/** @type {string|null} */ (null));
  const shown = projects.filter((p) => columnOf(p.status) === column).sort((a, b) => Number(a.status === 'paused') - Number(b.status === 'paused') || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const choose = (/** @type {string} */ v) => {
    session.column = v;
    setColumn(v);
    setPicked(null);
  };

  const onInspire = () => {
    const idea = randomPick(projects.filter((p) => p.status === 'idea'));
    if (!idea) return toast(t('creative.noIdeas'));
    choose('idea');
    setPicked(idea.id);
    toast(t('creative.howAbout', { title: idea.title }));
    revealRow(idea.id);
  };
  /** @param {CreativeProject} p */
  const actionsFor = (p) => {
    if (p.status === 'idea') return [{ label: t('creative.start'), onClick: () => setProjectStatus(p.id, 'in_progress') }];
    if (p.status === 'in_progress') return [{ label: t('creative.pause'), onClick: () => setProjectStatus(p.id, 'paused') }, { label: t('creative.finish'), onClick: () => setProjectStatus(p.id, 'done') }];
    if (p.status === 'paused') return [{ label: t('creative.resume'), onClick: () => setProjectStatus(p.id, 'in_progress') }, { label: t('creative.finish'), onClick: () => setProjectStatus(p.id, 'done') }];
    return [{ label: t('creative.reopen'), onClick: () => setProjectStatus(p.id, 'in_progress') }];
  };

  return html`
    <${SheetHeader} title=${t('objects.entertainment.artSupplies.name')}>
      <${Segmented} label=${t('creative.board')} value=${column}
        options=${['idea', 'in_progress', 'done'].map((v) => ({ value: v, label: t(`creative.columns.${v}`) }))} onChange=${choose} />
    <//>
    <${SheetBody}>
      <button type="button" class="btn wide pick-btn" onClick=${onInspire}>🎲 ${t('creative.inspire')}</button>
      ${shown.map((p) => {
        const missing = missingMaterials(p).length;
        return html`<div class=${`card project-card${picked === p.id ? ' picked' : ''}`} key=${p.id} id=${`media-${p.id}`}>
          <button type="button" class="row-hit" onClick=${() => nav.push('project', { id: p.id })}>
            <span class="title">${MEDIUM_ICON[p.medium] ?? '✨'} ${p.favorite ? '★ ' : ''}${p.title}
              ${p.status === 'paused' && html` <span class="stock-pill low">${t('creative.paused')}</span>`}</span>
            ${p.nextStep && html`<span class="next-step">→ ${p.nextStep}</span>`}
            ${missing > 0 && html`<span class="subtitle">${t('creative.missing', { count: missing })}</span>`}
          </button>
          <div class="row-actions">
            ${actionsFor(p).map((a) => html`<button type="button" class="btn btn-small" key=${a.label} onClick=${a.onClick}>${a.label}</button>`)}
          </div>
        </div>`;
      })}
      ${!shown.length && html`<div class="empty"><div class="art" aria-hidden="true">🖌️</div><p>${t(`creative.empty.${column}`)}</p></div>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('project', { id: null })}>${icon('plus', { size: 20 })} ${t('creative.new')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ id: string|null, nav: Nav }} props */
export function ProjectPage({ id, nav }) {
  const projects = /** @type {CreativeProject[]} */ (/** @type {unknown} */ (useCollection('creativeProjects')));
  const collections = /** @type {any[]} */ (useCollection('mediaCollections'));
  const existing = id ? projects.find((p) => p.id === id) : undefined;
  const [form, update, markSaved] = useForm({
    title: existing?.title ?? '',
    medium: existing?.medium ?? 'drawing',
    status: existing?.status ?? (session.column === 'done' ? 'idea' : session.column),
    nextStep: existing?.nextStep ?? '',
    materials: existing?.materials ?? /** @type {import('./model.js').Material[]} */ ([]),
    referenceNotes: existing?.referenceNotes ?? '',
    links: (existing?.links ?? []).join('\n'),
    startedAt: existing?.startedAt ?? '',
    finishedAt: existing?.finishedAt ?? '',
    favorite: existing?.favorite ?? false,
    collectionIds: collections.filter((c) => id && c.itemIds.includes(id)).map((c) => c.id),
  });
  const [material, setMaterial] = useState('');
  const [tried, setTried] = useState(false);
  const ids = { title: useFieldId('cp-title'), next: useFieldId('cp-next'), mat: useFieldId('cp-mat'), notes: useFieldId('cp-notes'), links: useFieldId('cp-links'), start: useFieldId('cp-start'), end: useFieldId('cp-end') };
  const links = form.links.split('\n').map((l) => l.trim()).filter(Boolean);
  const linksOk = links.every(isValidLink);

  const addMaterial = () => {
    if (!material.trim()) return;
    update({ materials: [...form.materials, { id: newId(), name: material.trim().slice(0, 60), have: false }] });
    setMaterial('');
  };
  const onSave = async () => {
    setTried(true);
    if (!form.title.trim() || !linksOk) return;
    const { collectionIds, ...rest } = form;
    await saveProject({ ...rest, status: /** @type {any} */ (rest.status), links, startedAt: rest.startedAt || null, finishedAt: rest.finishedAt || null }, id, collectionIds);
    markSaved();
    toast(t('common.saved'));
    nav.pop();
  };
  const onToShopping = async () => {
    if (!id) return;
    const { token, result } = await addMissingMaterials(id);
    if (result) undoToast(t('creative.addedToList', { count: /** @type {number} */ (result) }), token);
    else toast(t('creative.alreadyOnList'));
  };
  const onDelete = async () => {
    if (!id) return;
    const ok = await confirmDialog({ title: t('creative.deleteTitle', { title: existing?.title ?? '' }), confirmLabel: t('common.delete'), destructive: true });
    if (!ok) return;
    const { token } = await deleteProject(id);
    markSaved();
    await nav.pop();
    undoToast(t('creative.deleted'), token);
  };
  const saved = existing ? missingMaterials(existing).length : 0;

  return html`
    <${SheetHeader} title=${id ? t('creative.project') : t('creative.new')} back />
    <${SheetBody}>
      <${Field} label=${t('media.title')} htmlFor=${ids.title} error=${tried && !form.title.trim() ? t('form.errors.required') : undefined}>
        <${TextInput} id=${ids.title} value=${form.title} maxLength=${120} onInput=${(/** @type {string} */ title) => update({ title })} autoFocus=${!id} />
      <//>
      <div class="two-cols">
        <${Field} label=${t('creative.medium')}>
          <${Select} label=${t('creative.medium')} value=${form.medium} options=${MEDIUMS.map((m) => ({ value: m, label: `${MEDIUM_ICON[m]} ${t(`creative.mediums.${m}`)}` }))} onChange=${(/** @type {string} */ medium) => update({ medium })} />
        <//>
        <${Field} label=${t('media.status')}>
          <${Select} label=${t('media.status')} value=${form.status} options=${['idea', 'in_progress', 'paused', 'done'].map((s) => ({ value: s, label: t(`creative.statuses.${s}`) }))} onChange=${(/** @type {string} */ status) => update({ status })} />
        <//>
      </div>
      <${Field} label=${t('creative.nextStep')} htmlFor=${ids.next} optional>
        <${TextInput} id=${ids.next} value=${form.nextStep} maxLength=${120} placeholder=${t('creative.nextStepHint')} onInput=${(/** @type {string} */ nextStep) => update({ nextStep })} />
      <//>
      <section class="section">
        <h3 class="section-title">${t('creative.materials')}</h3>
        <div class="group">
          ${form.materials.map((m, i) => html`<div class="row check-row" key=${m.id}>
            <button type="button" class="row-hit" role="checkbox" aria-checked=${m.have ? 'true' : 'false'}
              onClick=${() => update({ materials: form.materials.map((x, k) => (k === i ? { ...x, have: !x.have } : x)) })}>
              <span class=${`check${m.have ? ' on' : ''}`} aria-hidden="true">${m.have ? '✓' : ''}</span>
              <span class="main"><span class="title">${m.name}</span><span class="subtitle" style="display:block">${m.have ? t('creative.have') : t('creative.need')}</span></span>
            </button>
            <button type="button" class="icon-button" aria-label=${t('common.delete')} onClick=${() => update({ materials: form.materials.filter((_, k) => k !== i) })}>${icon('close', { size: 18 })}</button>
          </div>`)}
        </div>
        <div class="inline" style="margin-top:8px">
          <${TextInput} id=${ids.mat} value=${material} maxLength=${60} placeholder=${t('creative.newMaterial')} onInput=${setMaterial} />
          <button type="button" class="btn" onClick=${addMaterial} disabled=${!material.trim()} aria-label=${t('creative.addMaterial')}>${icon('plus', { size: 18 })}</button>
        </div>
        ${id && saved > 0 && html`<button type="button" class="btn" style="margin-top:8px" onClick=${onToShopping}>🛒 ${t('creative.toShopping', { count: saved })}</button>`}
      </section>
      <${Field} label=${t('creative.references')} htmlFor=${ids.notes} optional>
        <${TextArea} id=${ids.notes} value=${form.referenceNotes} onInput=${(/** @type {string} */ referenceNotes) => update({ referenceNotes })} />
      <//>
      <${Field} label=${t('creative.links')} htmlFor=${ids.links} help=${t('creative.linksHelp')} error=${tried && !linksOk ? t('media.errors.link') : undefined} optional>
        <${TextArea} id=${ids.links} value=${form.links} rows=${2} onInput=${(/** @type {string} */ v) => update({ links: v })} />
      <//>
      ${existing?.links?.length > 0 &&
      html`<p>${existing.links.map((l) => html`<a class="link-button" key=${l} href=${l} target="_blank" rel="noopener noreferrer">${new URL(l).hostname} ↗</a> `)}</p>`}
      <div class="two-cols">
        <${Field} label=${t('creative.started')} htmlFor=${ids.start} optional>
          <${DateTimeInput} id=${ids.start} type="date" value=${form.startedAt} onInput=${(/** @type {string} */ startedAt) => update({ startedAt })} />
        <//>
        <${Field} label=${t('creative.finished')} htmlFor=${ids.end} optional>
          <${DateTimeInput} id=${ids.end} type="date" value=${form.finishedAt} onInput=${(/** @type {string} */ finishedAt) => update({ finishedAt })} />
        <//>
      </div>
      <div class="group"><div class="row"><span class="main title">${t('media.favorite')}</span>
        <${Switch} label=${t('media.favorite')} checked=${form.favorite} onChange=${(/** @type {boolean} */ favorite) => update({ favorite })} /></div></div>
      ${collections.length > 0 &&
      html`<${Field} label=${t('media.collections')}>
        <${ChipSelect} label=${t('media.collections')} value=${form.collectionIds} options=${collections.map((c) => ({ value: c.id, label: c.name }))} onChange=${(/** @type {string[]} */ collectionIds) => update({ collectionIds })} />
      <//>`}
    <//>
    <${SheetFooter}>
      ${id && html`<button type="button" class="btn btn-danger" onClick=${onDelete}>${t('common.delete')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}
