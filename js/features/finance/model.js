// @ts-check
// Money logic (pure, integer minor units). docs/spec/rooms/town.md T3, 04-data-model.md §3.16.

/**
 * @typedef {{ id: string, name?: string, seedKey?: string, type: string, openingBalanceMinor: number, openingSet?: boolean, archived: boolean }} Account
 * @typedef {{ id: string, accountId: string, type: 'expense'|'income', amountMinor: number, categoryId: string, date: string, note?: string, source: { type: string, batchId?: string|null } }} Transaction
 * @typedef {{ id: string, name?: string, seedKey?: string, kind: 'expense'|'income', icon: string, color: string, archived: boolean, order: number }} FinanceCategory
 * @typedef {{ id: string, month: string, totalLimitMinor?: number|null, limits: { categoryId: string, limitMinor: number }[] }} Budget
 */

/** @param {Transaction} tx */
const signed = (tx) => (tx.type === 'income' ? tx.amountMinor : -tx.amountMinor);

/**
 * @param {Account} account
 * @param {Transaction[]} transactions
 */
export function accountBalance(account, transactions) {
  return transactions.filter((tx) => tx.accountId === account.id).reduce((sum, tx) => sum + signed(tx), account.openingBalanceMinor);
}

/** @param {Account[]} accounts @param {Transaction[]} transactions */
export function totalBalance(accounts, transactions) {
  return accounts.filter((a) => !a.archived).reduce((sum, a) => sum + accountBalance(a, transactions), 0);
}

/** "YYYY-MM" of a LocalDate. @param {string} date */
export const monthOf = (date) => date.slice(0, 7);

/** @param {string} month @param {number} delta */
export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** @param {Transaction[]} transactions @param {string} month */
export function monthTotals(transactions, month) {
  let spent = 0;
  let income = 0;
  for (const tx of transactions) {
    if (monthOf(tx.date) !== month) continue;
    if (tx.type === 'income') income += tx.amountMinor;
    else spent += tx.amountMinor;
  }
  return { spent, income };
}

/**
 * Spending (or income) per category for a month, largest first.
 * @param {Transaction[]} transactions
 * @param {string} month
 * @param {'expense'|'income'} [type]
 */
export function byCategory(transactions, month, type = 'expense') {
  /** @type {Map<string, number>} */
  const map = new Map();
  for (const tx of transactions) {
    if (tx.type !== type || monthOf(tx.date) !== month) continue;
    map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amountMinor);
  }
  return [...map.entries()].map(([categoryId, amountMinor]) => ({ categoryId, amountMinor })).sort((a, b) => b.amountMinor - a.amountMinor);
}

/** @param {number} spent @param {number|null|undefined} limit */
export function budgetTone(spent, limit) {
  if (!limit) return 'none';
  if (spent > limit) return 'over';
  if (spent >= limit * 0.8) return 'near';
  return 'ok';
}

/**
 * @param {Budget|undefined} budget
 * @param {Transaction[]} transactions
 * @param {string} month
 */
export function budgetProgress(budget, transactions, month) {
  const { spent } = monthTotals(transactions, month);
  const cats = new Map(byCategory(transactions, month).map((c) => [c.categoryId, c.amountMinor]));
  return {
    total: { limit: budget?.totalLimitMinor ?? null, spent, tone: budgetTone(spent, budget?.totalLimitMinor) },
    categories: (budget?.limits ?? []).map((l) => {
      const s = cats.get(l.categoryId) ?? 0;
      return { categoryId: l.categoryId, limit: l.limitMinor, spent: s, tone: budgetTone(s, l.limitMinor) };
    }),
  };
}

/**
 * @param {{ type: string, amountMinor: number|null, categoryId: string, date: string, accountId: string }} form
 * @returns {Record<string, string>}
 */
export function validateTransaction(form) {
  /** @type {Record<string, string>} */
  const errors = {};
  if (!(typeof form.amountMinor === 'number' && form.amountMinor > 0)) errors.amount = 'finance.errors.amount';
  if (!form.categoryId) errors.category = 'form.errors.required';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) errors.date = 'form.errors.date';
  return errors;
}

/**
 * Transactions grouped by day (newest first) for a month.
 * @param {Transaction[]} transactions
 * @param {string} month
 * @param {(tx: Transaction) => boolean} [filter]
 */
export function groupByDay(transactions, month, filter = () => true) {
  /** @type {Map<string, Transaction[]>} */
  const map = new Map();
  for (const tx of transactions.filter((t) => monthOf(t.date) === month && filter(t)).sort((a, b) => b.date.localeCompare(a.date))) {
    const list = map.get(tx.date) ?? [];
    list.push(tx);
    map.set(tx.date, list);
  }
  return [...map.entries()].map(([date, items]) => ({ date, items }));
}
