// @ts-check
// Wardrobe: "new" sparkle badge after purchases; clothing shop mannequin.

import { appStore } from '../../core/store.js';
import { t } from '../../core/i18n.js';
import { registerBadge, registerVisualState } from '../../scene/badges.js';

registerBadge('bedroom.wardrobe', () =>
  appStore.all('clothingItems').some((i) => i.isNew) ? { text: '✨', tone: 'info', aria: t('wardrobe.badgeNew') } : null,
);

// Clothing shop mannequin wears the most recently bought item: "slot|template|color".
registerVisualState('town.clothing-shop', () => {
  const bought = appStore.all('clothingItems').filter((i) => i.purchasedAt).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  return bought ? `${bought.slot}|${bought.template}|${bought.color}` : 'default';
});
