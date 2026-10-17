// @ts-check
// Placeholder window for objects and panels that ship in later phases.

import { html } from '../../ui/lib.js';
import { t } from '../../core/i18n.js';
import { SheetHeader, SheetBody, DoneFooter } from '../../ui/sheet.js';
import { objectById } from '../../world/objects.js';

/** @param {{ props: Record<string, any>, sheet: import('../../ui/ui-state.js').SheetState }} args */
export default function ComingSoonWindow({ props, sheet }) {
  const obj = sheet.sourceObjectId ? objectById(sheet.sourceObjectId) : undefined;
  const title = obj ? t(obj.labelKey) : t(props.titleKey ?? 'common.comingSoon');
  return html`
    <${SheetHeader} title=${title} />
    <${SheetBody}>
      <div class="empty">
        <div class="art" aria-hidden="true">🚧</div>
        ${obj && html`<p><strong>${t(obj.descriptionKey)}</strong></p>`}
        <p>${t('common.comingSoonText')}</p>
      </div>
    <//>
    <${DoneFooter} />
  `;
}
