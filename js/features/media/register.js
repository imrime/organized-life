// @ts-check
// Entertainment room feedback: TV shows what you're watching, console LED, spinning record, easel canvas.
// No badges or reminders here on purpose (spec P-8: leisure should not feel like an obligation).

import { appStore } from '../../core/store.js';
import { t } from '../../core/i18n.js';
import { registerDisplay, registerVisualState } from '../../scene/badges.js';
import { nowWatching } from './model.js';

const media = () => /** @type {import('./model.js').MediaItem[]} */ (/** @type {unknown} */ (appStore.all('media')));

registerDisplay('entertainment.television', () => {
  const item = nowWatching(media());
  return item ? { lines: [`▶ ${item.title}`], aria: t('media.tvNow', { title: item.title }) } : null;
});
registerVisualState('entertainment.television', () => (nowWatching(media()) ? 'on' : 'idle'));

registerVisualState('entertainment.game-console', () => (media().some((m) => m.kind === 'game' && m.status === 'playing') ? 'on' : 'off'));

registerVisualState('entertainment.music-player', () =>
  appStore.all('playlists').some((p) => p.nowPlaying) || media().some((m) => m.nowPlaying) ? 'playing' : 'stopped',
);

registerVisualState('entertainment.art-supplies', () => (appStore.all('creativeProjects').some((p) => p.status === 'in_progress') ? 'sketch' : 'blank'));
