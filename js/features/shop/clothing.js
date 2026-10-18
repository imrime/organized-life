// @ts-check
// Clothing shop (docs/spec/rooms/town.md T2): try on templates and colours, then buy into the wardrobe.

import { html, useState } from '../../ui/lib.js';
import { t, nameOf } from '../../core/i18n.js';
import { today } from '../../core/time.js';
import { appStore } from '../../core/store.js';
import { PROFILE } from '../../core/schema.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Segmented, Select, TextInput, DateTimeInput, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection, useProfile } from '../../ui/hooks.js';
import { undoToast } from '../../ui/toast.js';
import { MoneyInput } from '../../ui/money.js';
import { CharacterFigure, GarmentIcon, outfitFrom } from '../../scene/character.js';
import { COLORS, TEMPLATES, SLOTS, laundryGroupFor, defaultCare, wearInSlot } from '../wardrobe/catalog.js';
import { buyClothing } from './clothing-actions.js';

/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */
/** @typedef {import('../wardrobe/catalog.js').Slot} Slot */

/** Try-on survives the purchase page and back. */
const session = { slot: /** @type {Slot} */ ('top'), template: 'tshirt', color: 'green' };

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function ClothingShopWindow({ page, nav }) {
  if (page?.id === 'buy') return html`<${BuyPage} nav=${nav} />`;
  return html`<${ShopRoot} nav=${nav} />`;
}

/** "Green hoodie" @param {string} template @param {string} color */
export const autoName = (template, color) => `${t(`colors.${color}`)} ${t(`wardrobe.templates.${template}`).toLowerCase()}`;

/** Equipped outfit with the tried item swapped in (preview only — never saved). @param {Record<string, any>} equipped */
function previewOutfit(equipped) {
  const getItem = (/** @type {string} */ id) => appStore.get('clothingItems', id);
  const base = outfitFrom(wearInSlot(equipped ?? {}, session.slot, null), getItem);
  return { ...base, [session.slot]: { template: session.template, color: session.color } };
}

/** @param {{ nav: Nav }} props */
function ShopRoot({ nav }) {
  const character = useProfile(PROFILE.character);
  useCollection('clothingItems');
  const [, setTick] = useState(0);
  /** @param {Partial<typeof session>} patch */
  const set = (patch) => {
    Object.assign(session, patch);
    setTick((n) => n + 1);
  };

  return html`
    <${SheetHeader} title=${t('objects.town.clothingShop.name')} />
    <${SheetBody}>
      <div class="preview shop-preview">
        <div class="preview-figure"><${CharacterFigure} character=${character} outfit=${previewOutfit(character.equipped)} /></div>
        <div class="preview-actions">
          <p class="title">${autoName(session.template, session.color)}</p>
          <p class="field-help">${t('clothingShop.tryOnHint')}</p>
        </div>
      </div>
      <div class="chips scroll" role="group" aria-label=${t('wardrobe.category')}>
        ${SLOTS.map((s) => html`<button type="button" class="chip-btn" key=${s} aria-pressed=${session.slot === s ? 'true' : 'false'}
          onClick=${() => set({ slot: s, template: TEMPLATES[s][0] })}>${t(`wardrobe.filters.${s}`)}</button>`)}
      </div>
      <div class="template-grid" role="radiogroup" aria-label=${t('wardrobe.template')}>
        ${TEMPLATES[session.slot].map((tpl) => html`<button type="button" key=${tpl} role="radio" aria-checked=${session.template === tpl ? 'true' : 'false'} onClick=${() => set({ template: tpl })}>
          <${GarmentIcon} template=${tpl} color=${session.color} slot=${session.slot} /><span>${t(`wardrobe.templates.${tpl}`)}</span>
        </button>`)}
      </div>
      <div class="swatches" role="radiogroup" aria-label=${t('wardrobe.color')} style="margin-top:12px">
        ${Object.keys(COLORS).map((c) => html`<button type="button" key=${c} role="radio" aria-checked=${session.color === c ? 'true' : 'false'} aria-label=${t(`colors.${c}`)}
          style=${`background:${COLORS[c]}`} onClick=${() => set({ color: c })}></button>`)}
      </div>
    <//>
    <${SheetFooter}>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.push('buy')}>${t('clothingShop.buy')}</button>
    <//>
  `;
}

/** @param {{ nav: Nav }} props */
function BuyPage({ nav }) {
  const accounts = /** @type {any[]} */ (useCollection('accounts')).filter((a) => !a.archived);
  const { slot, template, color } = session;
  const [form, update, markSaved] = useForm({
    name: autoName(template, color),
    priceMinor: /** @type {number|null} */ (null),
    date: today(),
    accountId: accounts[0]?.id ?? 'acc-wallet',
    laundryGroup: laundryGroupFor(color),
    care: defaultCare(slot),
    season: 'all',
  });
  const [tried, setTried] = useState(false);
  const ids = { name: useFieldId('cs-name'), price: useFieldId('cs-price'), date: useFieldId('cs-date'), care: useFieldId('cs-care') };
  const invalid = { name: !form.name.trim(), price: form.priceMinor === null || form.priceMinor < 0 };

  const onBuy = async (/** @type {boolean} */ wear) => {
    setTried(true);
    if (invalid.name || invalid.price) return;
    const { token } = await buyClothing({ ...form, priceMinor: /** @type {number} */ (form.priceMinor), slot, template, color, wear });
    markSaved();
    await nav.pop();
    undoToast(t(wear ? 'clothingShop.boughtWearing' : 'clothingShop.bought', { name: form.name.trim() }), token);
  };

  return html`
    <${SheetHeader} title=${t('clothingShop.purchase')} back />
    <${SheetBody}>
      <div class="garment-preview"><${GarmentIcon} template=${template} color=${color} slot=${slot} /></div>
      <${Field} label=${t('tasks.fields.name')} htmlFor=${ids.name} error=${tried && invalid.name ? t('form.errors.required') : undefined}>
        <${TextInput} id=${ids.name} value=${form.name} maxLength=${60} invalid=${tried && invalid.name} onInput=${(/** @type {string} */ name) => update({ name })} />
      <//>
      <div class="two-cols">
        <${Field} label=${t('clothingShop.price')} htmlFor=${ids.price} help=${form.priceMinor === 0 ? t('clothingShop.gift') : undefined}
          error=${tried && invalid.price ? t('clothingShop.priceRequired') : undefined}>
          <${MoneyInput} id=${ids.price} valueMinor=${form.priceMinor} invalid=${tried && invalid.price} onChange=${(/** @type {number|null} */ priceMinor) => update({ priceMinor })} />
        <//>
        <${Field} label=${t('clothingShop.date')} htmlFor=${ids.date}>
          <${DateTimeInput} id=${ids.date} type="date" value=${form.date} onInput=${(/** @type {string} */ date) => update({ date })} />
        <//>
      </div>
      ${accounts.length > 1 &&
      html`<${Field} label=${t('clothingShop.account')}>
        <${Select} value=${form.accountId} label=${t('clothingShop.account')} options=${accounts.map((a) => ({ value: a.id, label: nameOf(a) }))} onChange=${(/** @type {string} */ accountId) => update({ accountId })} />
      <//>`}
      <${Field} label=${t('wardrobe.laundryGroup')}>
        <${Segmented} label=${t('wardrobe.laundryGroup')} value=${form.laundryGroup}
          options=${['whites', 'lights', 'darks', 'colours'].map((g) => ({ value: g, label: t(`wardrobe.groups.${g}`) }))} onChange=${(/** @type {string} */ laundryGroup) => update({ laundryGroup })} />
      <//>
      <div class="two-cols">
        <${Field} label=${t('wardrobe.care')} htmlFor=${ids.care}>
          <${Select} id=${ids.care} value=${form.care} options=${['normal', 'delicate', 'wool', 'hand_wash', 'no_wash'].map((c) => ({ value: c, label: t(`wardrobe.cares.${c}`) }))} onChange=${(/** @type {string} */ care) => update({ care })} />
        <//>
        <${Field} label=${t('wardrobe.season')}>
          <${Select} value=${form.season} label=${t('wardrobe.season')} options=${['all', 'summer', 'mid', 'winter'].map((s) => ({ value: s, label: t(`wardrobe.seasons.${s}`) }))} onChange=${(/** @type {string} */ season) => update({ season })} />
        <//>
      </div>
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => onBuy(false)}>${t('clothingShop.buyLater')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => onBuy(true)}>${t('clothingShop.buyWear')}</button>
    <//>
  `;
}
