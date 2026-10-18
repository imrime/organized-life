// @ts-check
// Mirror (fogged/clear + remaining-steps badge) and shower (curtain, steam) scene feedback.
// Routine reminders themselves come from the shared "routine" reminder source (sleep/register.js).

import { appStore } from '../../core/store.js';
import { t } from '../../core/i18n.js';
import { today, combine } from '../../core/time.js';
import { registerBadge, registerVisualState } from '../../scene/badges.js';
import { careSlotAt, isActiveOn, isComplete, runId } from '../routines/model.js';

const MIRROR = 'bathroom.mirror-sink';
const SHOWER = 'bathroom.bath-shower';
const routines = () => /** @type {import('../routines/model.js').Routine[]} */ (/** @type {unknown} */ (appStore.all('routines')));
const runOf = (/** @type {string} */ id, /** @type {string} */ date) => /** @type {any} */ (appStore.get('routineRuns', runId(id, date)));

/** The current slot's care routine at the mirror. @param {Date} now */
function currentCare(now) {
  const slot = careSlotAt(now);
  return routines().filter((r) => r.owner === MIRROR && r.slot === slot && r.enabled).sort((a, b) => a.order - b.order)[0];
}

registerVisualState(MIRROR, () => {
  const r = currentCare(new Date());
  if (!r) return 'clear';
  return isComplete(r, runOf(r.id, today())) ? 'clear' : 'fogged';
});

registerBadge(MIRROR, () => {
  const now = new Date();
  const r = currentCare(now);
  const day = today();
  if (!r || !isActiveOn(r, day)) return null;
  const run = runOf(r.id, day);
  if (isComplete(r, run)) return null;
  const from = r.reminderTime ?? (r.slot === 'morning' ? '09:00' : '21:00');
  if (combine(day, from) > now) return null;
  const left = r.steps.length - (run?.doneStepIds.length ?? 0);
  return left > 0 ? { text: String(left), tone: 'info', aria: t('care.badgeSteps', { count: left }) } : null;
});

registerVisualState(SHOWER, () => {
  const day = today();
  const habits = routines().filter((r) => r.owner === SHOWER);
  const recent = habits.some((r) => {
    const at = runOf(r.id, day)?.completedAt;
    return at && Date.now() - new Date(at).getTime() < 2 * 60_000;
  });
  if (recent) return 'steam';
  return habits.some((r) => isActiveOn(r, day) && !isComplete(r, runOf(r.id, day))) ? 'open' : 'closed';
});
