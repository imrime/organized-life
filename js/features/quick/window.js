// @ts-check
// Quick add (docs/spec/03-ux-shell.md §10): create pages of shipped features, opened over the current room.

import { html } from '../../ui/lib.js';
import { t } from '../../core/i18n.js';
import { today } from '../../core/time.js';
import { appStore } from '../../core/store.js';
import { SheetHeader, SheetBody, DoneFooter, openWindow } from '../../ui/sheet.js';
import { todaySummary } from '../meds/model.js';

/** @typedef {{ key: string, emoji: string, window: string, objectId: string, page?: string, params?: Record<string, any>, visible?: () => boolean }} Shortcut */

/** @type {Shortcut[]} */
const SHORTCUTS = [
  { key: 'task', emoji: '✅', window: 'tasks.main', objectId: 'bedroom.desk-notebook', page: 'task', params: { id: null } },
  { key: 'event', emoji: '📅', window: 'calendar.main', objectId: 'bedroom.wall-calendar', page: 'event', params: { id: null } },
  { key: 'note', emoji: '📝', window: 'tasks.main', objectId: 'bedroom.desk-notebook', page: 'note', params: { id: null } },
  { key: 'alarm', emoji: '⏰', window: 'alarms.main', objectId: 'bedroom.alarm-clock', page: 'alarm', params: { id: null } },
  { key: 'sleep', emoji: '🛏️', window: 'sleep.main', objectId: 'bedroom.bed', page: 'log', params: { id: null } },
  {
    key: 'dose',
    emoji: '💊',
    window: 'meds.main',
    objectId: 'bedroom.medication-tray',
    visible: () => {
      const s = todaySummary(/** @type {any} */ (appStore.all('medications')), today(), (id) => /** @type {any} */ (appStore.get('doseLogs', id)), new Date());
      return s.due + s.overdue > 0;
    },
  },
];

export default function QuickWindow() {
  return html`
    <${SheetHeader} title=${t('quick.title')} />
    <${SheetBody}>
      <div class="quick-grid">
        ${SHORTCUTS.filter((s) => !s.visible || s.visible()).map(
          (s) => html`<button type="button" class="quick-item" key=${s.key}
            onClick=${() => openWindow(s.window, { sourceObjectId: s.objectId, page: s.page, params: s.params })}>
            <span class="quick-emoji" aria-hidden="true">${s.emoji}</span>
            <span>${t(`quick.items.${s.key}`)}</span>
          </button>`,
        )}
      </div>
    <//>
    <${DoneFooter} />
  `;
}
