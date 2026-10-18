// @ts-check
// Shopping board and grocery shop: unchecked-items badge, board notes state.

import { appStore } from '../../core/store.js';
import { t } from '../../core/i18n.js';
import { registerBadge, registerVisualState } from '../../scene/badges.js';

const open = () => appStore.all('shoppingItems').filter((i) => !i.checked).length;

/** @param {number} n */
const badge = (n) => (n ? { text: String(n), tone: /** @type {const} */ ('neutral'), aria: t('shopping.count', { count: n }) } : null);
registerBadge('kitchen.shopping-board', () => badge(open()));
registerBadge('town.grocery-shop', () => badge(open()));
registerVisualState('kitchen.shopping-board', () => {
  const n = open();
  return n === 0 ? 'none' : n <= 3 ? 'few' : 'many';
});
