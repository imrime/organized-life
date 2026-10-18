// @ts-check
// Weights window (docs/spec/rooms/gym.md G2): equipment and muscle filters, suggestions, exercise pages, substitutions.

import { html, useState } from '../../ui/lib.js';
import { t } from '../../core/i18n.js';
import { today } from '../../core/time.js';
import { PROFILE } from '../../core/schema.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Segmented, TextInput, TextArea, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection, useProfile } from '../../ui/hooks.js';
import { toast, undoToast } from '../../ui/toast.js';
import { choiceDialog, confirmDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { ChipSelect } from '../media/item-page.js';
import { EQUIPMENT, MUSCLE_GROUPS } from './catalog.js';
import { filterExercises, substitutes, suggestions, isAvailable } from './model.js';
import { addExerciseToSession, addToPlan, setMyEquipment, saveExercise, setExerciseHidden, deleteExercise } from './actions.js';
import { exName } from './today.js';

/** @typedef {import('./model.js').Exercise} Exercise */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

const session = { equipment: /** @type {string[]|null} */ (null), groups: /** @type {string[]} */ ([]) };
const MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'core', 'quads', 'hamstrings', 'glutes', 'calves', 'full_body', 'cardio'];
export const EQUIP_ICON = /** @type {Record<string, string>} */ ({ none: '🤸', mat: '🧘', dumbbells: '🏋️', barbell: '🏋️‍♀️', kettlebell: '🔔', bands: '➰', bench: '🪑', pullup_bar: '➖', machine: '⚙️', cardio_machine: '🚴' });

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function LibraryWindow({ page, nav }) {
  if (page?.id === 'exercise') return html`<${ExercisePage} id=${page.params?.id} nav=${nav} />`;
  if (page?.id === 'custom') return html`<${CustomPage} id=${page.params?.id ?? null} nav=${nav} />`;
  return html`<${LibraryRoot} nav=${nav} />`;
}

/** @param {{ nav: Nav }} props */
function LibraryRoot({ nav }) {
  const exercises = /** @type {Exercise[]} */ (/** @type {unknown} */ (useCollection('exercises')));
  const sessions = /** @type {any[]} */ (useCollection('workoutSessions'));
  const fitness = useProfile(PROFILE.fitness);
  const mine = /** @type {string[]} */ (fitness.equipment ?? ['none']);
  const [equipment, setEquipment] = useState(session.equipment ?? mine);
  const [groups, setGroups] = useState(session.groups);
  const list = filterExercises(exercises, equipment, groups).sort((a, b) => exName(a).localeCompare(exName(b)));
  const ideas = suggestions(exercises, sessions, equipment, today());
  const changed = [...equipment].sort().join() !== [...mine].sort().join();

  return html`
    <${SheetHeader} title=${t('objects.gym.weights.name')} />
    <${SheetBody}>
      <${Field} label=${t('workouts.equipment')}>
        <${ChipSelect} label=${t('workouts.equipment')} value=${equipment} options=${EQUIPMENT.map((e) => ({ value: e, label: `${EQUIP_ICON[e]} ${t(`workouts.equipmentNames.${e}`)}` }))}
          onChange=${(/** @type {string[]} */ v) => { session.equipment = v; setEquipment(v); }} />
      <//>
      ${changed && html`<button type="button" class="btn btn-small" onClick=${async () => { await setMyEquipment(equipment); toast(t('workouts.equipmentSaved')); }}>${t('workouts.saveEquipment')}</button>`}
      <${Field} label=${t('workouts.muscles')}>
        <${ChipSelect} label=${t('workouts.muscles')} value=${groups} options=${Object.keys(MUSCLE_GROUPS).map((g) => ({ value: g, label: t(`workouts.groups.${g}`) }))}
          onChange=${(/** @type {string[]} */ v) => { session.groups = v; setGroups(v); }} />
      <//>
      ${ideas.length > 0 && !groups.length &&
      html`<section class="section"><h3 class="section-title">✨ ${t('workouts.suggested')}</h3>
        <div class="suggest-grid">${ideas.map((e) => html`<button type="button" class="card suggest-card" key=${e.id} onClick=${() => nav.push('exercise', { id: e.id })}>
          <span class="title">${exName(e)}</span><span class="subtitle">${t(`workouts.muscleNames.${e.muscles[0]}`)}</span></button>`)}</div></section>`}
      <section class="section">
        <h3 class="section-title">${t('workouts.exercisesN', { count: list.length })}</h3>
        <div class="group">${list.map((e) => html`<button type="button" class="row" key=${e.id} onClick=${() => nav.push('exercise', { id: e.id })}>
          <span class="main"><span class="title">${exName(e)}${e.custom ? ' ✎' : ''}</span>
            <span class="subtitle" style="display:block">${t(`workouts.muscleNames.${e.muscles[0]}`)} · ${e.equipment.map((x) => EQUIP_ICON[x]).join(' ')}</span></span>
          ${icon('chevron')}</button>`)}</div>
        ${!list.length && html`<p class="empty small">${t('workouts.noMatches')}</p>`}
      </section>
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('custom', { id: null })}>${icon('plus', { size: 20 })} ${t('workouts.customExercise')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ id: string, nav: Nav }} props */
function ExercisePage({ id, nav }) {
  const exercises = /** @type {Exercise[]} */ (/** @type {unknown} */ (useCollection('exercises')));
  const plans = /** @type {any[]} */ (useCollection('workoutPlans'));
  const fitness = useProfile(PROFILE.fitness);
  const ex = exercises.find((e) => e.id === id);
  if (!ex) return null;
  const equipment = session.equipment ?? fitness.equipment ?? ['none'];
  const subs = substitutes(ex, exercises, equipment);
  const how = ex.howTo || (ex.howToKey ? t(ex.howToKey) : '');

  const onToday = async () => {
    await addExerciseToSession(ex.id);
    toast(t('workouts.addedToToday', { name: exName(ex) }));
  };
  const onPlan = async () => {
    const active = plans.filter((p) => !p.archived);
    if (!active.length) return toast(t('workouts.noPlans'));
    const choice = await choiceDialog({ title: t('workouts.addToPlan'), choices: active.map((p) => ({ value: p.id, label: p.name })) });
    if (!choice) return;
    await addToPlan(choice, ex.id);
    toast(t('workouts.addedToPlan', { plan: active.find((p) => p.id === choice)?.name ?? '' }));
  };
  const onHide = async () => {
    const { token } = await setExerciseHidden(ex.id, !ex.hidden);
    await nav.pop();
    undoToast(t(ex.hidden ? 'workouts.unhidden' : 'workouts.hidden'), token);
  };
  const onDelete = async () => {
    const ok = await confirmDialog({ title: t('media.deleteTitle', { title: exName(ex) }), confirmLabel: t('common.delete'), destructive: true });
    if (!ok) return;
    const { token } = await deleteExercise(ex.id);
    await nav.pop();
    undoToast(t('media.deleted'), token);
  };

  return html`
    <${SheetHeader} title=${exName(ex)} back />
    <${SheetBody}>
      <div class="chips">
        <span class="chip">${t(`workouts.types.${ex.type}`)}</span>
        ${ex.muscles.map((m) => html`<span class="chip" key=${m}>${t(`workouts.muscleNames.${m}`)}</span>`)}
      </div>
      <p class="field-help">${t('workouts.needs')}: ${ex.equipment.map((e) => `${EQUIP_ICON[e]} ${t(`workouts.equipmentNames.${e}`)}`).join(' / ')}
        ${!isAvailable(ex, equipment) ? html` · <b>${t('workouts.notWithYourEquipment')}</b>` : ''}</p>
      ${how && html`<section class="section"><h3 class="section-title">${t('workouts.howTo')}</h3><p class="prose">${how}</p></section>`}
      <section class="section">
        <h3 class="section-title">${t('workouts.substitutions')}</h3>
        <div class="group">${subs.map((x) => html`<button type="button" class="row" key=${x.id} onClick=${() => nav.push('exercise', { id: x.id })}>
          <span class="main"><span class="title">${exName(x)}</span></span>${icon('chevron')}</button>`)}</div>
        ${!subs.length && html`<p class="empty small">${t('workouts.noSubstitutions')}</p>`}
      </section>
      <div class="inline" style="margin-top:12px">
        <button type="button" class="btn wide" onClick=${onToday}>${icon('plus', { size: 18 })} ${t('workouts.addToToday')}</button>
        <button type="button" class="btn wide" onClick=${onPlan}>${t('workouts.addToPlan')}</button>
      </div>
    <//>
    <${SheetFooter}>
      ${ex.custom
        ? html`<button type="button" class="btn btn-danger" onClick=${onDelete}>${t('common.delete')}</button>
            <button type="button" class="btn" onClick=${() => nav.push('custom', { id: ex.id })}>${t('common.edit')}</button>`
        : html`<button type="button" class="btn" onClick=${onHide}>${ex.hidden ? t('workouts.unhide') : t('workouts.hide')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ id: string|null, nav: Nav }} props */
function CustomPage({ id, nav }) {
  const exercises = /** @type {Exercise[]} */ (/** @type {unknown} */ (useCollection('exercises')));
  const existing = id ? exercises.find((e) => e.id === id) : undefined;
  const [form, update, markSaved] = useForm({
    name: existing?.name ?? '',
    type: existing?.type ?? 'strength',
    metric: existing?.metric ?? 'reps',
    equipment: existing?.equipment ?? ['none'],
    muscles: existing?.muscles ?? ['full_body'],
    howTo: existing?.howTo ?? '',
  });
  const ids = { name: useFieldId('cx-name'), how: useFieldId('cx-how') };
  const onSave = async () => {
    if (!form.name.trim() || !form.muscles.length) return;
    await saveExercise(/** @type {any} */ (form), id);
    markSaved();
    toast(t('common.saved'));
    nav.pop();
  };
  return html`
    <${SheetHeader} title=${id ? exName(existing) : t('workouts.customExercise')} back />
    <${SheetBody}>
      <${Field} label=${t('tasks.fields.name')} htmlFor=${ids.name}><${TextInput} id=${ids.name} value=${form.name} maxLength=${60} onInput=${(/** @type {string} */ name) => update({ name })} autoFocus=${!id} /><//>
      <${Field} label=${t('media.type')}>
        <${Segmented} label=${t('media.type')} value=${form.type} options=${['strength', 'cardio', 'mobility'].map((v) => ({ value: v, label: t(`workouts.types.${v}`) }))} onChange=${(/** @type {any} */ type) => update({ type })} />
      <//>
      <${Field} label=${t('workouts.metric')}>
        <${Segmented} label=${t('workouts.metric')} value=${form.metric} options=${['reps', 'time', 'distance'].map((v) => ({ value: v, label: t(`workouts.metrics.${v}`) }))} onChange=${(/** @type {any} */ metric) => update({ metric })} />
      <//>
      <${Field} label=${t('workouts.equipment')}>
        <${ChipSelect} label=${t('workouts.equipment')} value=${form.equipment} options=${EQUIPMENT.map((e) => ({ value: e, label: t(`workouts.equipmentNames.${e}`) }))} onChange=${(/** @type {string[]} */ equipment) => update({ equipment })} />
      <//>
      <${Field} label=${t('workouts.muscles')} help=${t('workouts.primaryFirst')}>
        <${ChipSelect} label=${t('workouts.muscles')} value=${form.muscles} options=${MUSCLES.map((m) => ({ value: m, label: t(`workouts.muscleNames.${m}`) }))} onChange=${(/** @type {string[]} */ muscles) => update({ muscles })} />
      <//>
      <${Field} label=${t('workouts.howTo')} htmlFor=${ids.how} optional><${TextArea} id=${ids.how} value=${form.howTo} onInput=${(/** @type {string} */ howTo) => update({ howTo })} /><//>
    <//>
    <${SheetFooter}>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" disabled=${!form.name.trim() || !form.muscles.length} onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}
