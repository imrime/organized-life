// @ts-check
// Dining table (docs/spec/rooms/kitchen.md K4): food diary with a daily summary.

import { html, useState } from '../../ui/lib.js';
import { t, formatTime, formatDate, formatNumber } from '../../core/i18n.js';
import { today, addDays, nowTime } from '../../core/time.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Segmented, Select, TextInput, TextArea, DateTimeInput, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection, useProfile } from '../../ui/hooks.js';
import { PROFILE } from '../../core/schema.js';
import { undoToast, toast } from '../../ui/toast.js';
import { icon } from '../../ui/icons.js';
import { MEAL_TYPES, mealTypeAt, daySummary, recentFoods, validateMeal } from './model.js';
import { saveMeal, deleteMeal } from './actions.js';

/** @typedef {import('./model.js').Meal} Meal */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

const session = { date: today() };

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function DiaryWindow({ page, nav }) {
  if (page?.id === 'meal') return html`<${MealPage} id=${page.params?.id ?? null} nav=${nav} />`;
  return html`<${DiaryRoot} nav=${nav} />`;
}

/** @param {{ nav: Nav }} props */
function DiaryRoot({ nav }) {
  const meals = /** @type {Meal[]} */ (/** @type {unknown} */ (useCollection('meals')));
  const settings = useProfile(PROFILE.settings);
  const [date, setDate] = useState(session.date);
  const move = (/** @type {number} */ d) => { session.date = addDays(date, d); setDate(session.date); };
  const day = meals.filter((m) => m.date === date);
  const summary = daySummary(day);
  const recent = recentFoods(meals);
  const target = settings.kcalTarget;

  const relog = async (/** @type {Meal} */ m) => {
    const { token } = await saveMeal({ ...m, date, time: date === today() ? nowTime() : m.time ?? '', mealType: date === today() ? mealTypeAt(new Date()) : m.mealType, recipeId: m.recipeId ?? '', notes: '', portion: m.portion ?? '' }, null);
    undoToast(t('diary.logged', { food: m.food }), token);
  };

  return html`
    <${SheetHeader} title=${t('objects.kitchen.diningTable.name')} />
    <${SheetBody}>
      <div class="cal-nav">
        <button type="button" class="icon-button" onClick=${() => move(-1)} aria-label=${t('calendar.previous')}>${icon('back')}</button>
        <div class="cal-title">${date === today() ? t('calendar.today') : formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
        <button type="button" class="icon-button" onClick=${() => move(1)} aria-label=${t('calendar.next')} disabled=${date >= today()}>${icon('chevron')}</button>
      </div>
      <div class="summary-card">
        <div class="meal-ticks">${MEAL_TYPES.map((type) => html`<span key=${type} class=${summary.counts[type] ? 'on' : ''}>
          ${summary.counts[type] ? '✓' : '–'} ${t(`diary.types.${type}`)}${type === 'snack' && summary.counts.snack > 1 ? ` ×${summary.counts.snack}` : ''}</span>`)}</div>
        ${summary.has.kcal &&
        html`<div class="kcal">
          <b>${formatNumber(summary.totals.kcal)}</b> ${t('diary.kcal')}${target ? ` / ${formatNumber(target)}` : ''}
          ${target && html`<span class="bar"><i style=${`width:${Math.min(100, (summary.totals.kcal / target) * 100)}%`}></i></span>`}
        </div>`}
        ${(summary.has.proteinG || summary.has.carbsG || summary.has.fatG) &&
        html`<div class="macros">${t('diary.macros', { p: formatNumber(summary.totals.proteinG), c: formatNumber(summary.totals.carbsG), f: formatNumber(summary.totals.fatG) })}</div>`}
      </div>
      ${recent.length > 0 &&
      html`<div class="chips scroll" aria-label=${t('diary.recent')}>${recent.map((m) => html`<button type="button" class="chip-btn" key=${m.id} onClick=${() => relog(m)}>+ ${m.food}</button>`)}</div>`}
      ${MEAL_TYPES.map((type) => {
        const list = day.filter((m) => m.mealType === type).sort((a, b) => String(a.time).localeCompare(String(b.time)));
        if (!list.length) return null;
        return html`<section class="section" key=${type}>
          <h3 class="section-title">${t(`diary.types.${type}`)}</h3>
          <div class="group">${list.map(
            (m) => html`<button type="button" class="row" key=${m.id} onClick=${() => nav.push('meal', { id: m.id })}>
              <span class="main"><span class="title">${m.food}</span>
                <span class="subtitle" style="display:block">${[m.time ? formatTime(m.time) : '', m.portion].filter(Boolean).join(' · ')}</span></span>
              ${typeof m.kcal === 'number' && html`<span class="meta">${formatNumber(m.kcal)} ${t('diary.kcal')}</span>`}
            </button>`,
          )}</div>
        </section>`;
      })}
      ${!day.length && html`<div class="empty"><div class="art" aria-hidden="true">🍽️</div><p>${t('diary.empty')}</p></div>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('meal', { id: null })}>${icon('plus', { size: 20 })} ${t('diary.add')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ id: string|null, nav: Nav }} props */
function MealPage({ id, nav }) {
  const meals = /** @type {Meal[]} */ (/** @type {unknown} */ (useCollection('meals')));
  const recipes = /** @type {any[]} */ (useCollection('recipes'));
  const existing = id ? meals.find((m) => m.id === id) : undefined;
  const isToday = session.date === today();
  const [form, update, markSaved] = useForm({
    date: existing?.date ?? session.date,
    time: existing?.time ?? (isToday ? nowTime() : ''),
    mealType: existing?.mealType ?? (isToday ? mealTypeAt(new Date()) : 'lunch'),
    food: existing?.food ?? '',
    portion: existing?.portion ?? '',
    kcal: existing?.kcal ?? '',
    proteinG: existing?.proteinG ?? '',
    carbsG: existing?.carbsG ?? '',
    fatG: existing?.fatG ?? '',
    recipeId: existing?.recipeId ?? '',
    notes: existing?.notes ?? '',
  });
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const [showNutrition, setShowNutrition] = useState(Boolean(existing && (existing.kcal || existing.proteinG)));
  const ids = { food: useFieldId('ml-food'), portion: useFieldId('ml-portion'), time: useFieldId('ml-time'), recipe: useFieldId('ml-recipe'), notes: useFieldId('ml-notes') };
  const foods = [...new Set([...meals.map((m) => m.food), ...recipes.map((r) => r.title)])];

  /** Copy nutrition from the last identical food. @param {string} food */
  const onFood = (food) => {
    const last = meals.filter((m) => m.food.toLowerCase() === food.toLowerCase()).sort((a, b) => b.date.localeCompare(a.date))[0];
    update(last && !existing ? { food, portion: last.portion ?? '', kcal: last.kcal ?? '', proteinG: last.proteinG ?? '', carbsG: last.carbsG ?? '', fatG: last.fatG ?? '' } : { food });
  };
  const onSave = async () => {
    const found = validateMeal(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    await saveMeal(form, id);
    markSaved();
    toast(t('diary.saved'));
    nav.pop();
  };
  const onDelete = async () => {
    if (!id) return;
    const { token } = await deleteMeal(id);
    markSaved();
    await nav.pop();
    undoToast(t('diary.deleted'), token);
  };
  /** @param {'kcal'|'proteinG'|'carbsG'|'fatG'} key */
  const num = (key) => html`<label class="mini-field"><span>${t(`diary.fields.${key}`)}</span>
    <input class="input" type="number" min="0" inputmode="decimal" value=${form[key]} onInput=${(/** @type {Event} */ e) => update({ [key]: /** @type {HTMLInputElement} */ (e.currentTarget).value })} /></label>`;

  return html`
    <${SheetHeader} title=${id ? t('diary.editMeal') : t('diary.add')} back />
    <${SheetBody}>
      <${Segmented} label=${t('diary.mealType')} value=${form.mealType} options=${MEAL_TYPES.map((v) => ({ value: v, label: t(`diary.types.${v}`) }))} onChange=${(/** @type {any} */ mealType) => update({ mealType })} />
      <${Field} label=${t('diary.fields.food')} htmlFor=${ids.food} error=${errors.food && t(errors.food)}>
        <input id=${ids.food} class="input" list=${`${ids.food}-list`} value=${form.food} maxlength="120" autocomplete="off"
          onInput=${(/** @type {Event} */ e) => onFood(/** @type {HTMLInputElement} */ (e.currentTarget).value)} />
        <datalist id=${`${ids.food}-list`}>${foods.map((f) => html`<option key=${f} value=${f} />`)}</datalist>
      <//>
      <div class="two-cols">
        <${Field} label=${t('diary.fields.portion')} htmlFor=${ids.portion} optional>
          <${TextInput} id=${ids.portion} value=${form.portion} maxLength=${40} placeholder=${t('diary.portionPlaceholder')} onInput=${(/** @type {string} */ portion) => update({ portion })} />
        <//>
        <${Field} label=${t('diary.fields.time')} htmlFor=${ids.time} optional>
          <${DateTimeInput} id=${ids.time} type="time" value=${form.time} onInput=${(/** @type {string} */ time) => update({ time })} />
        <//>
      </div>
      <button type="button" class="link-button" style="margin-top:12px" aria-expanded=${showNutrition ? 'true' : 'false'} onClick=${() => setShowNutrition(!showNutrition)}>
        ${showNutrition ? '▾' : '▸'} ${t('diary.nutrition')}
      </button>
      ${showNutrition && html`<div class="four-cols">${num('kcal')}${num('proteinG')}${num('carbsG')}${num('fatG')}</div>`}
      ${recipes.length > 0 &&
      html`<${Field} label=${t('diary.fields.recipe')} htmlFor=${ids.recipe} optional>
        <${Select} id=${ids.recipe} value=${form.recipeId} options=${[{ value: '', label: '—' }, ...recipes.map((r) => ({ value: r.id, label: r.title }))]} onChange=${(/** @type {string} */ recipeId) => update({ recipeId })} />
      <//>`}
      <${Field} label=${t('tasks.fields.notes')} htmlFor=${ids.notes} optional>
        <${TextArea} id=${ids.notes} value=${form.notes} rows=${2} onInput=${(/** @type {string} */ notes) => update({ notes })} />
      <//>
    <//>
    <${SheetFooter}>
      ${id && html`<button type="button" class="btn btn-danger" onClick=${onDelete}>${t('common.delete')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}
