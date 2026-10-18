// @ts-check
// Character panel (docs/spec/03-ux-shell.md §11): name and look; outfits are changed in the wardrobe.

import { html } from '../../ui/lib.js';
import { t } from '../../core/i18n.js';
import { appStore } from '../../core/store.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { Field, Switch, TextInput, useForm, useFieldId } from '../../ui/controls.js';
import { useProfile } from '../../ui/hooks.js';
import { PROFILE } from '../../core/schema.js';
import { toast } from '../../ui/toast.js';
import { openObject } from '../../ui/navigation.js';
import { CharacterFigure, SKIN_TONES, HAIR_STYLES, HAIR_COLORS, outfitFrom } from '../../scene/character.js';
import { saveCharacter } from '../wardrobe/actions.js';

/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

/** Look editor, also used by onboarding. @param {{ form: Record<string, any>, update: (p: Record<string, any>) => void, compact?: boolean }} props */
export function LookEditor({ form, update, compact = false }) {
  return html`
    <${Field} label=${t('character.skin')}>
      <div class="swatches" role="radiogroup" aria-label=${t('character.skin')}>
        ${SKIN_TONES.map((c, i) => html`<button type="button" key=${c} role="radio" aria-checked=${form.skinTone === i + 1 ? 'true' : 'false'}
          aria-label=${t('character.toneN', { n: i + 1 })} style=${`background:${c}`} onClick=${() => update({ skinTone: i + 1 })}></button>`)}
      </div>
    <//>
    <${Field} label=${t('character.hairStyle')}>
      <div class="chips">
        ${HAIR_STYLES.map((s) => html`<button type="button" class="chip-btn" key=${s} aria-pressed=${form.hairStyle === s ? 'true' : 'false'} onClick=${() => update({ hairStyle: s })}>
          ${t(`character.hair.${s}`)}</button>`)}
      </div>
    <//>
    <${Field} label=${t('character.hairColor')}>
      <div class="swatches" role="radiogroup" aria-label=${t('character.hairColor')}>
        ${Object.entries(HAIR_COLORS).map(([k, c]) => html`<button type="button" key=${k} role="radio" aria-checked=${form.hairColor === k ? 'true' : 'false'}
          aria-label=${t(`character.hairColors.${k}`)} style=${`background:${c}`} onClick=${() => update({ hairColor: k })}></button>`)}
      </div>
    <//>
    ${!compact &&
    html`<div class="group" style="margin-top:16px">
      <div class="row"><span class="main title">${t('character.glasses')}</span>
        <${Switch} label=${t('character.glasses')} checked=${Boolean(form.glasses)} onChange=${(/** @type {boolean} */ glasses) => update({ glasses })} /></div>
    </div>`}
  `;
}

/** @param {{ nav: Nav }} args */
export default function CharacterWindow({ nav }) {
  const character = useProfile(PROFILE.character);
  const [form, update, markSaved] = useForm({
    name: character.name ?? '',
    skinTone: character.skinTone ?? 3,
    hairStyle: character.hairStyle ?? 'short',
    hairColor: character.hairColor ?? 'brown',
    glasses: Boolean(character.glasses),
  });
  const nameId = useFieldId('ch-name');
  const onSave = async () => {
    await saveCharacter({ ...form, name: form.name.trim() });
    markSaved();
    toast(t('common.saved'));
    nav.close();
  };
  return html`
    <${SheetHeader} title=${form.name.trim() || t('character.title')} />
    <${SheetBody}>
      <div class="preview"><div class="preview-figure">
        <${CharacterFigure} character=${{ ...character, ...form }} outfit=${outfitFrom(character.equipped, (id) => appStore.get('clothingItems', id))} />
      </div></div>
      <${Field} label=${t('character.name')} htmlFor=${nameId} optional>
        <${TextInput} id=${nameId} value=${form.name} maxLength=${40} placeholder=${t('character.namePlaceholder')} onInput=${(/** @type {string} */ name) => update({ name })} />
      <//>
      <${LookEditor} form=${form} update=${update} />
      <button type="button" class="btn wide" style="margin-top:16px" onClick=${async () => { if (await nav.close()) openObject('bedroom.wardrobe'); }}>👕 ${t('character.openWardrobe')}</button>
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.close()}>${t('common.cancel')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}
