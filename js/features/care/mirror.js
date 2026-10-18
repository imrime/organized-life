// @ts-check
// Mirror / sink window (docs/spec/rooms/bathroom.md BA1): morning and evening care checklists with streaks.

import { html, useState } from '../../ui/lib.js';
import { t } from '../../core/i18n.js';
import { SheetHeader, SheetBody, DoneFooter } from '../../ui/sheet.js';
import { Segmented } from '../../ui/controls.js';
import { useCollection } from '../../ui/hooks.js';
import { RoutineChecklist, RoutineEditor } from '../routines/ui.js';
import { careSlotAt } from '../routines/model.js';

/** @typedef {import('../routines/model.js').Routine} Routine */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

export const MIRROR = 'bathroom.mirror-sink';

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function MirrorWindow({ page, nav }) {
  const routines = /** @type {Routine[]} */ (/** @type {unknown} */ (useCollection('routines')));
  if (page?.id === 'edit') {
    const routine = routines.find((r) => r.id === page.params?.id);
    return routine ? html`<${RoutineEditor} routine=${routine} nav=${nav} />` : null;
  }
  return html`<${MirrorRoot} routines=${routines} nav=${nav} />`;
}

/** @param {{ routines: Routine[], nav: Nav }} props */
function MirrorRoot({ routines, nav }) {
  const [slot, setSlot] = useState(() => careSlotAt(new Date()));
  const routine = routines.filter((r) => r.owner === MIRROR && r.slot === slot).sort((a, b) => a.order - b.order)[0];
  return html`
    <${SheetHeader} title=${t('objects.bathroom.mirrorSink.name')}>
      <${Segmented} label=${t('care.slot')} value=${slot}
        options=${[{ value: 'morning', label: t('care.morning') }, { value: 'evening', label: t('care.evening') }]} onChange=${setSlot} />
    <//>
    <${SheetBody}>
      ${routine
        ? html`<${RoutineChecklist} routine=${routine} onEdit=${() => nav.push('edit', { id: routine.id })} />`
        : html`<div class="empty"><div class="art" aria-hidden="true">🪥</div><p>${t('care.noRoutine')}</p></div>`}
    <//>
    <${DoneFooter} />
  `;
}
