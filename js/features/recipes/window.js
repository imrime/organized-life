// @ts-check
// Recipe book (docs/spec/rooms/kitchen.md K2): list, detail with servings and availability, editor.

import { html, useState } from '../../ui/lib.js';
import { t, formatNumber } from '../../core/i18n.js';
import { newId } from '../../core/ids.js';
import { matchesQuery } from '../../core/text.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, TextInput, TextArea, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection } from '../../ui/hooks.js';
import { undoToast, toast } from '../../ui/toast.js';
import { confirmDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { UnitSelect } from '../products/ui.js';
import { scaledQuantity, availability, missingIngredients, validateRecipe } from './model.js';
import { saveRecipe, deleteRecipe, setRecipeFavorite, addMissingToShopping, addSampleRecipes } from './actions.js';

/** @typedef {import('./model.js').Recipe} Recipe */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

const session = { query: '', tag: '' };

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function RecipesWindow({ page, nav }) {
  if (page?.id === 'recipe') return html`<${RecipeDetail} id=${page.params?.id} nav=${nav} />`;
  if (page?.id === 'edit') return html`<${RecipeEditor} id=${page.params?.id ?? null} nav=${nav} />`;
  return html`<${RecipeList} nav=${nav} />`;
}

/** @param {number|null} q @param {string|null|undefined} unit */
function amount(q, unit) {
  if (q === null) return '';
  return `${formatNumber(q, { maximumFractionDigits: 2 })}${unit ? ` ${t(`units.${unit}`)}` : ''}`;
}

/** @param {{ nav: Nav }} props */
function RecipeList({ nav }) {
  const recipes = /** @type {Recipe[]} */ (/** @type {unknown} */ (useCollection('recipes')));
  const stock = /** @type {any[]} */ (useCollection('inventoryItems'));
  const [query, setQuery] = useState(session.query);
  const [tag, setTag] = useState(session.tag);
  const tags = [...new Set(recipes.flatMap((r) => r.tags))].sort();
  const shown = recipes
    .filter((r) => matchesQuery(`${r.title} ${r.tags.join(' ')} ${r.ingredients.map((i) => i.name).join(' ')}`, query))
    .filter((r) => !tag || (tag === '★' ? r.favorite : r.tags.includes(tag)))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.title.localeCompare(b.title));

  return html`
    <${SheetHeader} title=${t('objects.kitchen.recipeBook.name')} />
    <${SheetBody}>
      ${recipes.length > 0 &&
      html`<input class="search" type="search" value=${query} placeholder=${t('recipes.search')} aria-label=${t('recipes.search')}
          onInput=${(/** @type {Event} */ e) => { session.query = /** @type {HTMLInputElement} */ (e.currentTarget).value; setQuery(session.query); }} />
        <div class="chips scroll">${['', '★', ...tags].map((x) => html`<button type="button" class="chip-btn" key=${x || 'all'} aria-pressed=${tag === x ? 'true' : 'false'}
          onClick=${() => { session.tag = x; setTag(x); }}>${x === '' ? t('tasks.filters.all') : x === '★' ? `★ ${t('grocery.favourites')}` : x}</button>`)}</div>`}
      ${shown.map((r) => {
        const missing = missingIngredients(r, r.servings, stock).length;
        const minutes = (r.prepMin ?? 0) + (r.cookMin ?? 0);
        return html`<button type="button" class="card recipe-card" key=${r.id} onClick=${() => nav.push('recipe', { id: r.id })}>
          <span class="title">${r.favorite ? '★ ' : ''}${r.title}</span>
          <span class="subtitle">${t('recipes.servingsN', { count: r.servings })}${minutes ? ` · ${t('recipes.minutes', { count: minutes })}` : ''}${r.tags.length ? ` · ${r.tags.join(', ')}` : ''}</span>
          <span class=${`availability ${missing ? 'missing' : 'ok'}`}>${missing ? t('recipes.missingN', { count: missing }) : `✓ ${t('recipes.haveAll')}`}</span>
        </button>`;
      })}
      ${!recipes.length &&
      html`<div class="empty"><div class="art" aria-hidden="true">📕</div><p>${t('recipes.empty')}</p>
        <button type="button" class="btn" onClick=${() => addSampleRecipes()}>${t('recipes.addSamples')}</button></div>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('edit', { id: null })}>${icon('plus', { size: 20 })} ${t('recipes.add')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ id: string, nav: Nav }} props */
function RecipeDetail({ id, nav }) {
  const recipes = /** @type {Recipe[]} */ (/** @type {unknown} */ (useCollection('recipes')));
  const stock = /** @type {any[]} */ (useCollection('inventoryItems'));
  const recipe = recipes.find((r) => r.id === id);
  const [servings, setServings] = useState(recipe?.servings ?? 1);
  const [doneSteps, setDoneSteps] = useState(/** @type {string[]} */ ([]));
  if (!recipe) return html`<${SheetHeader} title="" back /><${SheetBody} />`;
  const missing = missingIngredients(recipe, servings, stock);

  const addMissing = async () => {
    const { token, result } = await addMissingToShopping(recipe, servings);
    undoToast(t('recipes.addedMissing', { count: result }), token);
  };
  const onDelete = async () => {
    if (!(await confirmDialog({ title: t('recipes.deleteTitle'), confirmLabel: t('common.delete'), destructive: true }))) return;
    const { token } = await deleteRecipe(recipe.id);
    await nav.pop();
    undoToast(t('recipes.deleted'), token);
  };
  const mark = { have: '✓', missing: '✗', partial: '◐', check: '~' };

  return html`
    <${SheetHeader} title=${recipe.title} back />
    <${SheetBody}>
      <div class="inline toolbar">
        <span class="title">${t('recipes.servings')}</span>
        <div class="stepper">
          <button type="button" aria-label=${t('inventory.less')} onClick=${() => setServings(Math.max(1, servings - 1))}>−</button>
          <span class="stepper-value">${servings}</span>
          <button type="button" aria-label=${t('inventory.more')} onClick=${() => setServings(Math.min(50, servings + 1))}>+</button>
        </div>
        <button type="button" class="icon-button" aria-pressed=${recipe.favorite ? 'true' : 'false'} aria-label=${t('wardrobe.favorite')} onClick=${() => setRecipeFavorite(recipe.id, !recipe.favorite)}>${recipe.favorite ? '★' : '☆'}</button>
      </div>
      <section class="section">
        <h3 class="section-title">${t('recipes.ingredients')}</h3>
        <div class="group">${recipe.ingredients.map((ing) => {
          const needed = scaledQuantity(ing, recipe.servings, servings);
          const a = availability(ing, needed, stock);
          return html`<div class="row" key=${ing.id}>
            <span class=${`avail ${a.state}`} aria-label=${t(`recipes.states.${a.state}`)}>${mark[a.state]}</span>
            <span class="main"><span class="title">${ing.name}${ing.optional ? html` <em class="field-optional">${t('recipes.optional')}</em>` : ''}</span>
              ${a.state === 'partial' && html`<span class="subtitle" style="display:block">${t('recipes.need', { amount: amount(a.missing, ing.unit) })}</span>`}</span>
            <span class="meta">${amount(needed, ing.unit)}</span>
          </div>`;
        })}</div>
        <button type="button" class="btn wide" style="margin-top:12px" disabled=${!missing.length} onClick=${addMissing}>🛒 ${t('recipes.addMissing', { count: missing.length })}</button>
      </section>
      ${recipe.steps.length > 0 &&
      html`<section class="section">
        <h3 class="section-title">${t('recipes.steps')}</h3>
        <ol class="steps">${recipe.steps.map((s, i) => html`<li key=${s.id}>
          <button type="button" class=${doneSteps.includes(s.id) ? 'done' : ''} onClick=${() => setDoneSteps(doneSteps.includes(s.id) ? doneSteps.filter((x) => x !== s.id) : [...doneSteps, s.id])}>
            <b>${i + 1}</b> ${s.text}</button></li>`)}</ol>
      </section>`}
      ${recipe.notes && html`<p class="prose" style="margin-top:12px">${recipe.notes}</p>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn btn-danger" onClick=${onDelete}>${t('common.delete')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.push('edit', { id: recipe.id })}>${t('common.edit')}</button>
    <//>
  `;
}

/** @param {{ id: string|null, nav: Nav }} props */
function RecipeEditor({ id, nav }) {
  const recipes = /** @type {Recipe[]} */ (/** @type {unknown} */ (useCollection('recipes')));
  const existing = id ? recipes.find((r) => r.id === id) : undefined;
  const [form, update, markSaved] = useForm({
    title: existing?.title ?? '',
    servings: existing?.servings ?? 2,
    prepMin: existing?.prepMin ?? '',
    cookMin: existing?.cookMin ?? '',
    tags: existing?.tags ?? [],
    ingredients: existing?.ingredients.map((i) => ({ ...i, quantity: i.quantity ?? '', unit: i.unit ?? 'pcs' })) ?? [{ id: newId(), name: '', quantity: '', unit: 'pcs', optional: false }],
    steps: existing?.steps ?? [{ id: newId(), text: '' }],
    notes: existing?.notes ?? '',
  });
  const [tagDraft, setTagDraft] = useState('');
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const ids = { title: useFieldId('r-title'), serv: useFieldId('r-serv'), prep: useFieldId('r-prep'), cook: useFieldId('r-cook'), tag: useFieldId('r-tag'), notes: useFieldId('r-notes') };
  /** @param {number} i @param {Record<string, any>} patch */
  const setIng = (i, patch) => update({ ingredients: form.ingredients.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  /** @param {number} i @param {string} text */
  const setStep = (i, text) => update({ steps: form.steps.map((x, k) => (k === i ? { ...x, text } : x)) });

  const onSave = async () => {
    const found = validateRecipe(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    const { result } = await saveRecipe(form, id);
    markSaved();
    toast(t('recipes.saved'));
    await nav.pop();
    if (!id) nav.push('recipe', { id: result.id });
  };

  return html`
    <${SheetHeader} title=${id ? t('recipes.edit') : t('recipes.add')} back />
    <${SheetBody}>
      <${Field} label=${t('tasks.fields.title')} htmlFor=${ids.title} error=${errors.title && t(errors.title)}>
        <${TextInput} id=${ids.title} value=${form.title} maxLength=${120} autoFocus=${!id} onInput=${(/** @type {string} */ title) => update({ title })} />
      <//>
      <div class="three-cols">
        <${Field} label=${t('recipes.servings')} htmlFor=${ids.serv} error=${errors.servings && t(errors.servings)}>
          <input id=${ids.serv} class="input" type="number" min="1" max="50" value=${form.servings} onInput=${(/** @type {Event} */ e) => update({ servings: Number(/** @type {HTMLInputElement} */ (e.currentTarget).value) })} />
        <//>
        <${Field} label=${t('recipes.prepMin')} htmlFor=${ids.prep} optional>
          <input id=${ids.prep} class="input" type="number" min="0" value=${form.prepMin} onInput=${(/** @type {Event} */ e) => update({ prepMin: /** @type {HTMLInputElement} */ (e.currentTarget).value })} />
        <//>
        <${Field} label=${t('recipes.cookMin')} htmlFor=${ids.cook} optional>
          <input id=${ids.cook} class="input" type="number" min="0" value=${form.cookMin} onInput=${(/** @type {Event} */ e) => update({ cookMin: /** @type {HTMLInputElement} */ (e.currentTarget).value })} />
        <//>
      </div>
      <${Field} label=${t('recipes.ingredients')} error=${errors.ingredients && t(errors.ingredients)}>
        ${form.ingredients.map(
          (ing, i) => html`<div class="ing-row" key=${ing.id}>
            <input class="input ing-qty" type="number" min="0" step="any" value=${ing.quantity} aria-label=${t('inventory.fields.quantity')}
              onInput=${(/** @type {Event} */ e) => setIng(i, { quantity: /** @type {HTMLInputElement} */ (e.currentTarget).value })} />
            <div class="ing-unit"><${UnitSelect} id=${`ing-unit-${i}`} value=${ing.unit} onChange=${(/** @type {string} */ unit) => setIng(i, { unit })} /></div>
            <input class="input ing-name" value=${ing.name} maxlength="80" placeholder=${t('recipes.ingredientName')} aria-label=${t('recipes.ingredientName')}
              onInput=${(/** @type {Event} */ e) => setIng(i, { name: /** @type {HTMLInputElement} */ (e.currentTarget).value })} />
            <button type="button" class="icon-button" aria-label=${t('common.delete')} onClick=${() => update({ ingredients: form.ingredients.filter((_, k) => k !== i) })}>${icon('close', { size: 18 })}</button>
          </div>`,
        )}
        <button type="button" class="chip-btn" onClick=${() => update({ ingredients: [...form.ingredients, { id: newId(), name: '', quantity: '', unit: 'pcs', optional: false }] })}>+ ${t('recipes.addIngredient')}</button>
      <//>
      <${Field} label=${t('recipes.steps')}>
        ${form.steps.map(
          (s, i) => html`<div class="step-edit" key=${s.id}>
            <b>${i + 1}</b>
            <${TextArea} id=${`step-${s.id}`} value=${s.text} rows=${2} onInput=${(/** @type {string} */ text) => setStep(i, text)} />
            <button type="button" class="icon-button" aria-label=${t('common.delete')} onClick=${() => update({ steps: form.steps.filter((_, k) => k !== i) })}>${icon('close', { size: 18 })}</button>
          </div>`,
        )}
        <button type="button" class="chip-btn" onClick=${() => update({ steps: [...form.steps, { id: newId(), text: '' }] })}>+ ${t('recipes.addStep')}</button>
      <//>
      <${Field} label=${t('recipes.tags')} htmlFor=${ids.tag} optional>
        <div class="chips">${form.tags.map((tag) => html`<button type="button" class="chip-btn" key=${tag} onClick=${() => update({ tags: form.tags.filter((x) => x !== tag) })}>${tag} ✕</button>`)}</div>
        <form class="quick-add" style="margin-top:8px" onSubmit=${(/** @type {Event} */ e) => { e.preventDefault(); const v = tagDraft.trim(); if (v && !form.tags.includes(v) && form.tags.length < 10) update({ tags: [...form.tags, v] }); setTagDraft(''); }}>
          <${TextInput} id=${ids.tag} value=${tagDraft} maxLength=${24} placeholder=${t('recipes.newTag')} onInput=${setTagDraft} />
          <button type="submit" class="btn" aria-label=${t('tasks.add')}>${icon('plus', { size: 18 })}</button>
        </form>
      <//>
      <${Field} label=${t('tasks.fields.notes')} htmlFor=${ids.notes} optional>
        <${TextArea} id=${ids.notes} value=${form.notes} onInput=${(/** @type {string} */ notes) => update({ notes })} />
      <//>
    <//>
    <${SheetFooter}><span class="grow"></span><button type="button" class="btn btn-primary" onClick=${onSave}>${t('common.save')}</button><//>
  `;
}
