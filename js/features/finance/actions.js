// @ts-check
// Finance mutations.

import { appStore } from '../../core/store.js';
import { shiftMonth } from './model.js';

/**
 * @param {{ type: 'expense'|'income', amountMinor: number, categoryId: string, date: string, accountId: string, note: string }} form
 * @param {string|null} id
 */
export function saveTransaction(form, id) {
  return appStore.mutate('finance.save', (tx) => {
    const fields = { type: form.type, amountMinor: form.amountMinor, categoryId: form.categoryId, date: form.date, accountId: form.accountId, note: form.note.trim() };
    return id ? tx.patch('transactions', id, fields) : tx.insert('transactions', { ...fields, source: { type: 'manual', batchId: null } });
  });
}

/** @param {string} id */
export function deleteTransaction(id) {
  return appStore.mutate('finance.delete', (tx) => tx.remove('transactions', id));
}

/** @param {string} accountId @param {number} minor */
export function setOpeningBalance(accountId, minor) {
  return appStore.mutate('finance.opening', (tx) => tx.patch('accounts', accountId, { openingBalanceMinor: minor, openingSet: true }));
}

/**
 * @param {string} month
 * @param {{ totalLimitMinor: number|null, limits: { categoryId: string, limitMinor: number }[] }} fields
 */
export function saveBudget(month, fields) {
  return appStore.mutate('finance.budget', (tx) => {
    const existing = tx.all('budgets').find((b) => b.month === month);
    const clean = { totalLimitMinor: fields.totalLimitMinor, limits: fields.limits.filter((l) => l.limitMinor > 0) };
    return existing ? tx.patch('budgets', existing.id, clean) : tx.insert('budgets', { month, ...clean });
  });
}

/**
 * A month without a budget copies the previous month's limits on first view (spec T3). Returns true when copied.
 * @param {string} month
 */
export async function ensureMonthBudget(month) {
  const budgets = appStore.all('budgets');
  if (budgets.some((b) => b.month === month)) return false;
  const previous = budgets.find((b) => b.month === shiftMonth(month, -1));
  if (!previous) return false;
  await appStore.mutate('finance.budgetCopy', (tx) => tx.insert('budgets', { month, totalLimitMinor: previous.totalLimitMinor, limits: previous.limits }), { quiet: true });
  return true;
}

/**
 * @param {{ name: string, kind: 'expense'|'income', icon: string, color: string }} form
 * @param {string|null} id
 */
export function saveCategory(form, id) {
  return appStore.mutate('finance.category', (tx) => {
    if (id) {
      const previous = tx.get('financeCategories', id);
      return tx.patch('financeCategories', id, { name: form.name.trim(), icon: form.icon, color: form.color, ...(previous?.seedKey && form.name.trim() ? { seedKey: undefined } : {}) });
    }
    return tx.insert('financeCategories', { ...form, name: form.name.trim(), archived: false, order: tx.all('financeCategories').length });
  });
}

/** @param {string} id @param {boolean} archived */
export function setCategoryArchived(id, archived) {
  return appStore.mutate('finance.categoryArchive', (tx) => tx.patch('financeCategories', id, { archived }));
}
