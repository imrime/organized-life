// @ts-check
// Settings window (docs/spec/03-ux-shell.md §12). Every control saves immediately.

import { html, useRef, useState } from '../../ui/lib.js';
import { t, LANGUAGES } from '../../core/i18n.js';
import { SheetHeader, SheetBody, DoneFooter } from '../../ui/sheet.js';
import { Segmented, Select, Switch, FieldRow } from '../../ui/controls.js';
import { useProfile } from '../../ui/hooks.js';
import { PROFILE, SCHEMA_VERSION, COLLECTIONS } from '../../core/schema.js';
import { COMMON_CURRENCIES } from '../../core/money.js';
import { VERSION, BUILD } from '../../version.js';
import { appStore } from '../../core/store.js';
import { updateSettings } from './actions.js';

export default function SettingsWindow() {
  const settings = useProfile(PROFILE.settings);
  const currencies = COMMON_CURRENCIES.includes(settings.currency) ? COMMON_CURRENCIES : [settings.currency, ...COMMON_CURRENCIES];

  return html`
    <${SheetHeader} title=${t('settings.title')} />
    <${SheetBody}>
      <section class="section">
        <h3 class="section-title">${t('settings.sections.language')}</h3>
        <div class="group">
          <${FieldRow} label=${t('settings.language')} stacked>
            <${Segmented}
              label=${t('settings.language')}
              value=${settings.language}
              options=${Object.entries(LANGUAGES).map(([value, label]) => ({ value, label }))}
              onChange=${(/** @type {string} */ language) => updateSettings({ language })}
            />
          <//>
          <${FieldRow} label=${t('settings.currency')} htmlFor="set-currency">
            <${Select}
              id="set-currency"
              value=${settings.currency}
              options=${currencies.map((code) => ({ value: code, label: code }))}
              onChange=${(/** @type {string} */ currency) => updateSettings({ currency })}
            />
          <//>
          <${FieldRow} label=${t('settings.weekStart')} stacked>
            <${Segmented}
              label=${t('settings.weekStart')}
              value=${settings.weekStart}
              options=${[
                { value: 1, label: t('settings.monday') },
                { value: 7, label: t('settings.sunday') },
              ]}
              onChange=${(/** @type {number} */ weekStart) => updateSettings({ weekStart })}
            />
          <//>
          <${FieldRow} label=${t('settings.timeFormat')} stacked>
            <${Segmented}
              label=${t('settings.timeFormat')}
              value=${settings.timeFormat}
              options=${[
                { value: '24h', label: t('settings.time24') },
                { value: '12h', label: t('settings.time12') },
              ]}
              onChange=${(/** @type {string} */ timeFormat) => updateSettings({ timeFormat })}
            />
          <//>
          <${FieldRow} label=${t('settings.units')} stacked>
            <${Segmented}
              label=${t('settings.units')}
              value=${settings.units}
              options=${[
                { value: 'metric', label: t('settings.metric') },
                { value: 'imperial', label: t('settings.imperial') },
              ]}
              onChange=${(/** @type {string} */ units) => updateSettings({ units })}
            />
          <//>
        </div>
      </section>

      <section class="section">
        <h3 class="section-title">${t('settings.sections.display')}</h3>
        <div class="group">
          <${FieldRow} label=${t('settings.textSize')} stacked>
            <${Segmented}
              label=${t('settings.textSize')}
              value=${settings.textSize}
              options=${['S', 'M', 'L', 'XL'].map((value) => ({ value, label: t(`settings.textSizes.${value}`) }))}
              onChange=${(/** @type {string} */ textSize) => updateSettings({ textSize })}
            />
          <//>
          <${FieldRow} label=${t('settings.reduceMotion')} stacked>
            <${Segmented}
              label=${t('settings.reduceMotion')}
              value=${settings.reduceMotion}
              options=${['system', 'on', 'off'].map((value) => ({ value, label: t(`settings.motion.${value}`) }))}
              onChange=${(/** @type {string} */ reduceMotion) => updateSettings({ reduceMotion })}
            />
          <//>
          <${FieldRow} label=${t('settings.showHints')} help=${t('settings.showHintsHelp')}>
            <${Switch}
              label=${t('settings.showHints')}
              checked=${Boolean(settings.showHints)}
              onChange=${(/** @type {boolean} */ showHints) => updateSettings({ showHints })}
            />
          <//>
        </div>
      </section>

      <${About} />
    <//>
    <${DoneFooter} />
  `;
}

/** Version footer; tapping it five times reveals developer info. */
function About() {
  const [taps, setTaps] = useState(0);
  const last = useRef(0);
  const onTap = () => {
    const now = Date.now();
    setTaps(now - last.current < 800 ? taps + 1 : 1);
    last.current = now;
  };
  const records = COLLECTIONS.reduce((sum, name) => sum + appStore.all(name).length, 0);
  return html`<section class="section about" aria-label=${t('settings.sections.about')}>
    <p>${t('settings.privacy')}</p>
    <p class="version" onClick=${onTap}>${t('settings.version', { version: VERSION, build: BUILD })}</p>
    ${taps >= 5 && html`<p>${t('settings.developer', { schema: SCHEMA_VERSION, records })}</p>`}
  </section>`;
}
