// @ts-check
// Park: running-walk badge (elapsed minutes) and strip item.

import { appStore } from '../../core/store.js';
import { t } from '../../core/i18n.js';
import { registerBadge, registerVisualState } from '../../scene/badges.js';
import { registerStripProvider } from '../../ui/next-task-strip.js';
import { openObject } from '../../ui/navigation.js';
import { runningWalk, elapsedMin } from './model.js';

const PARK = 'town.park';
const walks = () => /** @type {import('./model.js').Walk[]} */ (/** @type {unknown} */ (appStore.all('walks')));

registerVisualState(PARK, () => (runningWalk(walks()) ? 'walking' : 'default'));

registerBadge(PARK, () => {
  const walk = runningWalk(walks());
  if (!walk) return null;
  const min = elapsedMin(walk, new Date());
  return { text: `${min}'`, tone: 'info', aria: t('walks.badge', { minutes: min }) };
});

registerStripProvider('walks', (now) => {
  const walk = runningWalk(walks());
  return walk ? [{ key: `walk:${walk.id}`, rank: 6, emoji: '🚶', text: t('strip.walking', { minutes: elapsedMin(walk, now) }), open: () => openObject(PARK) }] : [];
});
