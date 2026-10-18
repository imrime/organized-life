// @ts-check
// Wardrobe: "new" sparkle badge after purchases.

import { appStore } from '../../core/store.js';
import { t } from '../../core/i18n.js';
import { registerBadge } from '../../scene/badges.js';

registerBadge('bedroom.wardrobe', () =>
  appStore.all('clothingItems').some((i) => i.isNew) ? { text: '✨', tone: 'info', aria: t('wardrobe.badgeNew') } : null,
);
