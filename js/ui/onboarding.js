// @ts-check
// First-launch onboarding (docs/spec/03-ux-shell.md §7): Welcome → You → Basics → bedroom tour.

import { html, useEffect, useRef, useState } from './lib.js';
import { t, LANGUAGES, setLanguage } from '../core/i18n.js';
import { useProfile } from './hooks.js';
import { PROFILE } from '../core/schema.js';
import { COMMON_CURRENCIES } from '../core/money.js';
import { Segmented, Select, TextInput, Field } from './controls.js';
import { CharacterFigure, outfitFrom } from '../scene/character.js';
import { LookEditor } from '../features/character/window.js';
import { appStore } from '../core/store.js';
import { updateSettings } from '../features/settings/actions.js';
import { saveCharacter } from '../features/wardrobe/actions.js';
import { requestPersistence } from '../features/settings/data.js';

export function Onboarding() {
  const settings = useProfile(PROFILE.settings);
  const character = useProfile(PROFILE.character);
  const [step, setStep] = useState(Math.min(settings.onboarding?.step ?? 0, 2));
  const [look, setLook] = useState({ name: character.name ?? '', skinTone: character.skinTone ?? 3, hairStyle: character.hairStyle ?? 'short', hairColor: character.hairColor ?? 'brown' });
  /** @type {{ current: HTMLDivElement|null }} */
  const cardRef = useRef(null);
  useEffect(() => {
    cardRef.current?.querySelector('h2')?.focus();
  }, [step]);

  if (settings.onboarding?.done) return null;
  const currencies = COMMON_CURRENCIES.includes(settings.currency) ? COMMON_CURRENCIES : [settings.currency, ...COMMON_CURRENCIES];

  const go = async (/** @type {number} */ next) => {
    if (step === 1) await saveCharacter({ ...look, name: look.name.trim() });
    if (next > 2) {
      await updateSettings({ onboarding: { step: 3, done: true } });
      requestPersistence();
      return;
    }
    await updateSettings({ onboarding: { step: next, done: false } });
    setStep(next);
  };

  return html`<div class="onboarding" role="dialog" aria-modal="true" aria-labelledby="onb-title">
    <div class="onboarding-card" ref=${cardRef}>
      <div class="onb-dots" aria-hidden="true">${[0, 1, 2].map((i) => html`<i class=${i === step ? 'on' : ''}></i>`)}</div>
      ${step === 0 &&
      html`<h2 id="onb-title" tabindex="-1">${t('onboarding.welcomeTitle')}</h2>
        <p>${t('app.tagline')}</p>
        <${Field} label=${t('settings.language')}>
          <${Segmented} label=${t('settings.language')} value=${settings.language}
            options=${Object.entries(LANGUAGES).map(([value, label]) => ({ value, label }))}
            onChange=${(/** @type {string} */ language) => { setLanguage(language); updateSettings({ language }); }} />
        <//>`}
      ${step === 1 &&
      html`<h2 id="onb-title" tabindex="-1">${t('onboarding.youTitle')}</h2>
        <div class="onb-figure"><${CharacterFigure} character=${{ ...character, ...look }} outfit=${outfitFrom(character.equipped, (id) => appStore.get('clothingItems', id))} /></div>
        <${Field} label=${t('character.name')} htmlFor="onb-name" optional>
          <${TextInput} id="onb-name" value=${look.name} maxLength=${40} placeholder=${t('character.namePlaceholder')} onInput=${(/** @type {string} */ name) => setLook({ ...look, name })} />
        <//>
        <${LookEditor} form=${look} update=${(/** @type {any} */ p) => setLook({ ...look, ...p })} compact />`}
      ${step === 2 &&
      html`<h2 id="onb-title" tabindex="-1">${t('onboarding.basicsTitle')}</h2>
        <p>${t('onboarding.basicsText')}</p>
        <${Field} label=${t('settings.currency')} htmlFor="onb-currency">
          <${Select} id="onb-currency" value=${settings.currency} options=${currencies.map((c) => ({ value: c, label: c }))} onChange=${(/** @type {string} */ currency) => updateSettings({ currency })} />
        <//>
        <${Field} label=${t('settings.weekStart')}>
          <${Segmented} label=${t('settings.weekStart')} value=${settings.weekStart}
            options=${[{ value: 1, label: t('settings.monday') }, { value: 7, label: t('settings.sunday') }]} onChange=${(/** @type {number} */ weekStart) => updateSettings({ weekStart })} />
        <//>
        <${Field} label=${t('settings.timeFormat')}>
          <${Segmented} label=${t('settings.timeFormat')} value=${settings.timeFormat}
            options=${[{ value: '24h', label: t('settings.time24') }, { value: '12h', label: t('settings.time12') }]} onChange=${(/** @type {string} */ timeFormat) => updateSettings({ timeFormat })} />
        <//>`}
      <div class="onb-actions">
        ${step > 0 && html`<button type="button" class="btn btn-ghost" onClick=${() => go(step - 1)}>${t('common.back')}</button>`}
        <span class="grow"></span>
        ${step === 1 && html`<button type="button" class="btn btn-ghost" onClick=${() => go(2)}>${t('onboarding.skip')}</button>`}
        <button type="button" class="btn btn-primary" onClick=${() => go(step + 1)}>${step === 0 ? t('onboarding.start') : step === 2 ? t('onboarding.finish') : t('tour.next')}</button>
      </div>
    </div>
  </div>`;
}
