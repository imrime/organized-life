// @ts-check
// Bank / ATM: warn when this month's spending reaches 80 % of the budget, alert above 100 %.

import { appStore } from '../../core/store.js';
import { t } from '../../core/i18n.js';
import { today } from '../../core/time.js';
import { registerBadge } from '../../scene/badges.js';
import { budgetProgress, monthOf } from './model.js';

registerBadge('town.bank-atm', () => {
  const month = monthOf(today());
  const budget = /** @type {any[]} */ (appStore.all('budgets')).find((b) => b.month === month);
  if (!budget?.totalLimitMinor) return null;
  const { total } = budgetProgress(budget, /** @type {any[]} */ (appStore.all('transactions')), month);
  if (total.tone === 'over') return { text: '!', tone: 'alert', aria: t('finance.badgeOver') };
  if (total.tone === 'near') return { text: '!', tone: 'warn', aria: t('finance.badgeNear') };
  return null;
});
