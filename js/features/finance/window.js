// @ts-check
// Bank / ATM window (docs/spec/rooms/town.md T3): Overview · Transactions · Budget.

import { html, useEffect, useState } from '../../ui/lib.js';
import { t, nameOf, formatDate, intlLocale } from '../../core/i18n.js';
import { today } from '../../core/time.js';
import { SheetHeader, SheetBody, SheetFooter, DoneFooter } from '../../ui/sheet.js';
import { Field, Segmented, Select, TextInput, DateTimeInput, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection } from '../../ui/hooks.js';
import { undoToast, toast } from '../../ui/toast.js';
import { confirmDialog } from '../../ui/dialog.js';
import { icon } from '../../ui/icons.js';
import { money, MoneyInput } from '../../ui/money.js';
import { COLORS } from '../wardrobe/catalog.js';
import { totalBalance, monthTotals, byCategory, budgetProgress, monthOf, shiftMonth, groupByDay, validateTransaction } from './model.js';
import { saveTransaction, deleteTransaction, setOpeningBalance, saveBudget, ensureMonthBudget, saveCategory, setCategoryArchived } from './actions.js';

/** @typedef {import('./model.js').Transaction} Transaction */
/** @typedef {import('./model.js').FinanceCategory} FinanceCategory */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

const session = { tab: 'overview', month: monthOf(today()) };
const SOURCE_ICON = /** @type {Record<string, string>} */ ({ grocery: '🛒', clothing: '👕' });

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function FinanceWindow({ page, nav }) {
  if (page?.id === 'tx') return html`<${TxPage} id=${page.params?.id ?? null} type=${page.params?.type ?? 'expense'} nav=${nav} />`;
  if (page?.id === 'categories') return html`<${CategoriesPage} nav=${nav} />`;
  if (page?.id === 'category') return html`<${CategoryPage} id=${page.params?.id ?? null} kind=${page.params?.kind ?? 'expense'} nav=${nav} />`;
  if (page?.id === 'opening') return html`<${OpeningPage} nav=${nav} />`;
  return html`<${FinanceRoot} nav=${nav} />`;
}

/** @param {string} month */
const monthTitle = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(intlLocale(), { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
};

/** @param {{ month: string, onChange: (m: string) => void }} props */
function MonthSwitcher({ month, onChange }) {
  return html`<div class="cal-nav">
    <button type="button" class="icon-button" onClick=${() => onChange(shiftMonth(month, -1))} aria-label=${t('calendar.previous')}>${icon('back')}</button>
    <div class="cal-title">${monthTitle(month)}</div>
    <button type="button" class="icon-button" onClick=${() => onChange(shiftMonth(month, 1))} aria-label=${t('calendar.next')}>${icon('chevron')}</button>
  </div>`;
}

/** @param {{ nav: Nav }} props */
function FinanceRoot({ nav }) {
  const accounts = /** @type {any[]} */ (useCollection('accounts'));
  const [tab, setTab] = useState(session.tab);
  const [month, setMonth] = useState(session.month);
  const choose = (/** @type {string} */ v) => { session.tab = v; setTab(v); };
  const changeMonth = (/** @type {string} */ m) => { session.month = m; setMonth(m); };
  const wallet = accounts.find((a) => a.id === 'acc-wallet');

  // First open: ask for the current balance once.
  useEffect(() => {
    if (wallet && !wallet.openingSet) nav.push('opening');
  }, []);

  return html`
    <${SheetHeader} title=${t('objects.town.bankAtm.name')}>
      <${Segmented} label=${t('finance.sections')} value=${tab}
        options=${[{ value: 'overview', label: t('finance.overview') }, { value: 'transactions', label: t('finance.transactions') }, { value: 'budget', label: t('finance.budget') }]}
        onChange=${choose} />
    <//>
    ${tab === 'overview' && html`<${Overview} nav=${nav} />`}
    ${tab === 'transactions' && html`<${TransactionsTab} nav=${nav} month=${month} onMonth=${changeMonth} />`}
    ${tab === 'budget' && html`<${BudgetTab} nav=${nav} month=${month} onMonth=${changeMonth} />`}
  `;
}

/** @param {{ tx: Transaction, categories: FinanceCategory[], nav: Nav }} props */
function TxRow({ tx, categories, nav }) {
  const cat = categories.find((c) => c.id === tx.categoryId);
  return html`<button type="button" class="row" onClick=${() => nav.push('tx', { id: tx.id })}>
    <span class="lead" aria-hidden="true" style=${`background:${COLORS[cat?.color ?? 'grey']}33`}>${cat?.icon ?? '•'}</span>
    <span class="main"><span class="title">${tx.note || nameOf(cat)}</span>
      <span class="subtitle" style="display:block">${tx.note ? nameOf(cat) : ''}${SOURCE_ICON[tx.source?.type] ? ` ${SOURCE_ICON[tx.source.type]}` : ''}</span></span>
    <span class=${`amount ${tx.type}`}>${tx.type === 'income' ? '+' : '−'}${money(tx.amountMinor)}</span>
  </button>`;
}

/** @param {{ nav: Nav }} props */
function Overview({ nav }) {
  const accounts = /** @type {any[]} */ (useCollection('accounts'));
  const transactions = /** @type {Transaction[]} */ (/** @type {unknown} */ (useCollection('transactions')));
  const categories = /** @type {FinanceCategory[]} */ (/** @type {unknown} */ (useCollection('financeCategories')));
  const budgets = /** @type {any[]} */ (useCollection('budgets'));
  const month = monthOf(today());
  const { spent, income } = monthTotals(transactions, month);
  const budget = budgets.find((b) => b.month === month);
  const top = byCategory(transactions, month).slice(0, 5);
  const max = Math.max(1, ...top.map((c) => c.amountMinor));
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 5);

  return html`
    <${SheetBody}>
      <div class="hero">
        <div class="hero-sub">${t('finance.balance')}</div>
        <div class="hero-big small">${money(totalBalance(accounts, transactions))}</div>
      </div>
      <div class="stat-row">
        <div class="stat"><span>${t('finance.spent')}</span><b>${money(spent)}</b></div>
        <div class="stat"><span>${t('finance.income')}</span><b>${money(income)}</b></div>
        ${budget?.totalLimitMinor ? html`<div class="stat"><span>${t('finance.left')}</span><b class=${spent > budget.totalLimitMinor ? 'over' : ''}>${money(budget.totalLimitMinor - spent)}</b></div>` : null}
      </div>
      <div class="inline" style="margin:12px 0">
        <button type="button" class="btn wide" onClick=${() => nav.push('tx', { id: null, type: 'expense' })}>− ${t('finance.addExpense')}</button>
        <button type="button" class="btn wide" onClick=${() => nav.push('tx', { id: null, type: 'income' })}>+ ${t('finance.addIncome')}</button>
      </div>
      ${top.length > 0 &&
      html`<section class="section">
        <h3 class="section-title">${t('finance.topCategories')}</h3>
        <div class="group bars">
          ${top.map((c) => {
            const cat = categories.find((x) => x.id === c.categoryId);
            return html`<div class="row bar-row" key=${c.categoryId}>
              <span class="main"><span class="title">${cat?.icon} ${nameOf(cat)}</span>
                <span class="bar"><i style=${`width:${(c.amountMinor / max) * 100}%;background:${COLORS[cat?.color ?? 'grey']}`}></i></span></span>
              <span class="meta">${money(c.amountMinor)}</span>
            </div>`;
          })}
        </div>
      </section>`}
      <section class="section">
        <h3 class="section-title">${t('finance.recent')}</h3>
        ${recent.length
          ? html`<div class="group">${recent.map((tx) => html`<${TxRow} key=${tx.id} tx=${tx} categories=${categories} nav=${nav} />`)}</div>`
          : html`<p class="empty small">${t('finance.noTransactions')}</p>`}
      </section>
    <//>
    <${DoneFooter} />
  `;
}

/** @param {{ nav: Nav, month: string, onMonth: (m: string) => void }} props */
function TransactionsTab({ nav, month, onMonth }) {
  const transactions = /** @type {Transaction[]} */ (/** @type {unknown} */ (useCollection('transactions')));
  const categories = /** @type {FinanceCategory[]} */ (/** @type {unknown} */ (useCollection('financeCategories')));
  const [filter, setFilter] = useState('all');
  const days = groupByDay(transactions, month, (tx) => filter === 'all' || tx.type === filter || tx.categoryId === filter);
  return html`
    <${SheetBody}>
      <${MonthSwitcher} month=${month} onChange=${onMonth} />
      <${Select} value=${filter} label=${t('finance.filter')}
        options=${[
          { value: 'all', label: t('finance.all') },
          { value: 'expense', label: t('finance.expenses') },
          { value: 'income', label: t('finance.incomes') },
          ...categories.filter((c) => !c.archived).map((c) => ({ value: c.id, label: `${c.icon} ${nameOf(c)}` })),
        ]}
        onChange=${setFilter} />
      ${days.map(
        (d) => html`<section class="section" key=${d.date}>
          <h3 class="section-title">${formatDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</h3>
          <div class="group">${d.items.map((tx) => html`<${TxRow} key=${tx.id} tx=${tx} categories=${categories} nav=${nav} />`)}</div>
        </section>`,
      )}
      ${!days.length && html`<div class="empty"><div class="art" aria-hidden="true">🧾</div><p>${t('finance.noTransactions')}</p></div>`}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('tx', { id: null, type: 'expense' })}>${icon('plus', { size: 20 })} ${t('finance.add')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ nav: Nav, month: string, onMonth: (m: string) => void }} props */
function BudgetTab({ nav, month, onMonth }) {
  const transactions = /** @type {Transaction[]} */ (/** @type {unknown} */ (useCollection('transactions')));
  const categories = /** @type {FinanceCategory[]} */ (/** @type {unknown} */ (useCollection('financeCategories')));
  const budgets = /** @type {any[]} */ (useCollection('budgets'));
  const budget = budgets.find((b) => b.month === month);
  const [editing, setEditing] = useState(false);
  const [total, setTotal] = useState(/** @type {number|null} */ (null));
  const [limits, setLimits] = useState(/** @type {Record<string, number|null>} */ ({}));

  useEffect(() => {
    ensureMonthBudget(month).then((copied) => copied && toast(t('finance.budgetCopied', { month: monthTitle(shiftMonth(month, -1)) })));
  }, [month]);

  const progress = budgetProgress(budget, transactions, month);
  const expenseCats = categories.filter((c) => c.kind === 'expense' && !c.archived);
  const startEdit = () => {
    setTotal(budget?.totalLimitMinor ?? null);
    setLimits(Object.fromEntries((budget?.limits ?? []).map((/** @type {any} */ l) => [l.categoryId, l.limitMinor])));
    setEditing(true);
  };
  const save = async () => {
    await saveBudget(month, {
      totalLimitMinor: total,
      limits: Object.entries(limits).filter(([, v]) => typeof v === 'number' && v > 0).map(([categoryId, limitMinor]) => ({ categoryId, limitMinor: /** @type {number} */ (limitMinor) })),
    });
    setEditing(false);
    toast(t('finance.budgetSaved'));
  };
  /** @param {number} spent @param {number|null} limit @param {string} tone */
  const meter = (spent, limit, tone) => html`<span class="bar"><i class=${`tone-${tone}`} style=${`width:${limit ? Math.min(100, (spent / limit) * 100) : 0}%`}></i></span>`;

  return html`
    <${SheetBody}>
      <${MonthSwitcher} month=${month} onChange=${onMonth} />
      ${editing
        ? html`<${Field} label=${t('finance.totalLimit')} htmlFor="b-total" optional>
              <${MoneyInput} id="b-total" valueMinor=${total} onChange=${setTotal} />
            <//>
            <h3 class="section-title" style="margin-top:16px">${t('finance.categoryLimits')}</h3>
            <div class="group">${expenseCats.map(
              (c) => html`<div class="row" key=${c.id}><span class="main title">${c.icon} ${nameOf(c)}</span>
                <div style="width:45%"><${MoneyInput} id=${`b-${c.id}`} valueMinor=${limits[c.id] ?? null} label=${nameOf(c)} onChange=${(/** @type {number|null} */ v) => setLimits({ ...limits, [c.id]: v })} /></div></div>`,
            )}</div>`
        : html`<div class="budget-total">
              <div class="row"><span class="main"><span class="title">${t('finance.total')}</span>
                ${meter(progress.total.spent, progress.total.limit, progress.total.tone)}</span>
                <span class="meta">${money(progress.total.spent)}${progress.total.limit ? ` / ${money(progress.total.limit)}` : ''}</span></div>
            </div>
            ${progress.categories.length > 0 &&
            html`<div class="group" style="margin-top:12px">${progress.categories.map((p) => {
              const c = categories.find((x) => x.id === p.categoryId);
              return html`<div class="row" key=${p.categoryId}><span class="main"><span class="title">${c?.icon} ${nameOf(c)}</span>${meter(p.spent, p.limit, p.tone)}</span>
                <span class="meta">${money(p.spent)} / ${money(p.limit)}</span></div>`;
            })}</div>`}
            ${!budget && html`<p class="empty small">${t('finance.noBudget')}</p>`}
            <button type="button" class="btn btn-ghost" style="margin-top:12px" onClick=${() => nav.push('categories')}>${t('finance.manageCategories')}</button>`}
    <//>
    <${SheetFooter}>
      ${editing
        ? html`<button type="button" class="btn" onClick=${() => setEditing(false)}>${t('common.cancel')}</button><span class="grow"></span><button type="button" class="btn btn-primary" onClick=${save}>${t('common.save')}</button>`
        : html`<button type="button" class="btn" onClick=${startEdit}>${t(budget ? 'finance.editBudget' : 'finance.setBudget')}</button><span class="grow"></span><button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>`}
    <//>
  `;
}

/** @param {{ id: string|null, type: 'expense'|'income', nav: Nav }} props */
function TxPage({ id, type, nav }) {
  const transactions = /** @type {Transaction[]} */ (/** @type {unknown} */ (useCollection('transactions')));
  const categories = /** @type {FinanceCategory[]} */ (/** @type {unknown} */ (useCollection('financeCategories')));
  const accounts = /** @type {any[]} */ (useCollection('accounts')).filter((a) => !a.archived);
  const existing = id ? transactions.find((x) => x.id === id) : undefined;
  const startType = existing?.type ?? type;
  const [form, update, markSaved] = useForm({
    type: startType,
    amountMinor: existing?.amountMinor ?? /** @type {number|null} */ (null),
    categoryId: existing?.categoryId ?? (startType === 'income' ? 'cat-salary' : 'cat-other'),
    date: existing?.date ?? today(),
    accountId: existing?.accountId ?? accounts[0]?.id ?? 'acc-wallet',
    note: existing?.note ?? '',
  });
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const ids = { amount: useFieldId('tx-amount'), cat: useFieldId('tx-cat'), date: useFieldId('tx-date'), acc: useFieldId('tx-acc'), note: useFieldId('tx-note') };
  const cats = categories.filter((c) => c.kind === form.type && (!c.archived || c.id === form.categoryId));

  const onSave = async () => {
    const found = validateTransaction(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    await saveTransaction(/** @type {any} */ (form), id);
    markSaved();
    toast(t('finance.saved'));
    nav.pop();
  };
  const onDelete = async () => {
    if (!id || !existing) return;
    if (existing.source?.type !== 'manual' && !(await confirmDialog({ title: t('finance.deleteLinked'), message: t('finance.deleteLinkedMessage'), confirmLabel: t('common.delete'), destructive: true }))) return;
    const { token } = await deleteTransaction(id);
    markSaved();
    await nav.pop();
    undoToast(t('finance.deleted'), token);
  };
  return html`
    <${SheetHeader} title=${id ? t('finance.editTx') : t(form.type === 'income' ? 'finance.addIncome' : 'finance.addExpense')} back />
    <${SheetBody}>
      <${Segmented} label=${t('finance.type')} value=${form.type}
        options=${[{ value: 'expense', label: t('finance.expense') }, { value: 'income', label: t('finance.incomeOne') }]}
        onChange=${(/** @type {any} */ v) => update({ type: v, categoryId: v === 'income' ? 'cat-salary' : 'cat-other' })} />
      <${Field} label=${t('finance.amount')} htmlFor=${ids.amount} error=${errors.amount && t(errors.amount)}>
        <${MoneyInput} id=${ids.amount} valueMinor=${form.amountMinor} invalid=${Boolean(errors.amount)} onChange=${(/** @type {number|null} */ amountMinor) => update({ amountMinor })} />
      <//>
      <${Field} label=${t('finance.category')} htmlFor=${ids.cat}>
        <${Select} id=${ids.cat} value=${form.categoryId} options=${cats.map((c) => ({ value: c.id, label: `${c.icon} ${nameOf(c)}` }))} onChange=${(/** @type {string} */ categoryId) => update({ categoryId })} />
      <//>
      <div class="two-cols">
        <${Field} label=${t('calendar.fields.date')} htmlFor=${ids.date} error=${errors.date && t(errors.date)}>
          <${DateTimeInput} id=${ids.date} type="date" value=${form.date} onInput=${(/** @type {string} */ date) => update({ date })} />
        <//>
        <${Field} label=${t('checkout.account')} htmlFor=${ids.acc}>
          <${Select} id=${ids.acc} value=${form.accountId} options=${accounts.map((a) => ({ value: a.id, label: nameOf(a) }))} onChange=${(/** @type {string} */ accountId) => update({ accountId })} />
        <//>
      </div>
      <${Field} label=${t('shopping.note')} htmlFor=${ids.note} optional>
        <${TextInput} id=${ids.note} value=${form.note} maxLength=${80} onInput=${(/** @type {string} */ note) => update({ note })} />
      <//>
    <//>
    <${SheetFooter}>
      ${id && html`<button type="button" class="btn btn-danger" onClick=${onDelete}>${t('common.delete')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}

/** @param {{ nav: Nav }} props */
function OpeningPage({ nav }) {
  const [amount, setAmount] = useState(/** @type {number|null} */ (null));
  const save = async (/** @type {number} */ minor) => {
    await setOpeningBalance('acc-wallet', minor);
    nav.pop();
  };
  return html`
    <${SheetHeader} title=${t('finance.openingTitle')} />
    <${SheetBody}>
      <p class="prose">${t('finance.openingText')}</p>
      <${Field} label=${t('finance.currentBalance')} htmlFor="open-amount">
        <${MoneyInput} id="open-amount" valueMinor=${amount} onChange=${setAmount} />
      <//>
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => save(0)}>${t('onboarding.skip')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => save(amount ?? 0)}>${t('common.save')}</button>
    <//>
  `;
}

/** @param {{ nav: Nav }} props */
function CategoriesPage({ nav }) {
  const categories = /** @type {FinanceCategory[]} */ (/** @type {unknown} */ (useCollection('financeCategories')));
  /** @param {'expense'|'income'} kind */
  const list = (kind) => categories.filter((c) => c.kind === kind).sort((a, b) => a.order - b.order);
  return html`
    <${SheetHeader} title=${t('finance.categories')} back />
    <${SheetBody}>
      ${['expense', 'income'].map(
        (kind) => html`<section class="section" key=${kind}>
          <h3 class="section-title">${t(kind === 'expense' ? 'finance.expenses' : 'finance.incomes')}</h3>
          <div class="group">${list(/** @type {any} */ (kind)).map(
            (c) => html`<div class="row" key=${c.id}>
              <button type="button" class="row-hit" onClick=${() => nav.push('category', { id: c.id })}>
                <span class="lead" aria-hidden="true">${c.icon}</span>
                <span class=${`main title${c.archived ? ' done' : ''}`}>${nameOf(c)}</span>
              </button>
              <button type="button" class="btn btn-small" onClick=${() => setCategoryArchived(c.id, !c.archived)}>${t(c.archived ? 'finance.restore' : 'finance.archive')}</button>
            </div>`,
          )}</div>
        </section>`,
      )}
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('category', { id: null, kind: 'expense' })}>${icon('plus', { size: 20 })} ${t('finance.newCategory')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.pop()}>${t('common.done')}</button>
    <//>
  `;
}

const ICONS = ['🛒', '🧽', '🧴', '💊', '👕', '🍽️', '🚌', '🏠', '🎬', '📚', '🏋️', '🎁', '☕', '🐾', '✈️', '💡', '📱', '💼', '🎓', '•'];

/** @param {{ id: string|null, kind: 'expense'|'income', nav: Nav }} props */
function CategoryPage({ id, kind, nav }) {
  const categories = /** @type {FinanceCategory[]} */ (/** @type {unknown} */ (useCollection('financeCategories')));
  const existing = id ? categories.find((c) => c.id === id) : undefined;
  const [form, update, markSaved] = useForm({ name: existing ? nameOf(existing) : '', kind: existing?.kind ?? kind, icon: existing?.icon ?? '•', color: existing?.color ?? 'grey' });
  const onSave = async () => {
    if (!form.name.trim()) return;
    const keepSeed = existing?.seedKey && form.name === nameOf(existing);
    await saveCategory({ ...form, name: keepSeed ? '' : form.name }, id);
    markSaved();
    nav.pop();
  };
  return html`
    <${SheetHeader} title=${id ? t('finance.category') : t('finance.newCategory')} back />
    <${SheetBody}>
      ${!id && html`<${Segmented} label=${t('finance.type')} value=${form.kind} options=${[{ value: 'expense', label: t('finance.expense') }, { value: 'income', label: t('finance.incomeOne') }]} onChange=${(/** @type {any} */ v) => update({ kind: v })} />`}
      <${Field} label=${t('inventory.fields.name')} htmlFor="cat-name">
        <${TextInput} id="cat-name" value=${form.name} maxLength=${40} onInput=${(/** @type {string} */ name) => update({ name })} />
      <//>
      <${Field} label=${t('finance.icon')}>
        <div class="icon-grid">${ICONS.map((i) => html`<button type="button" key=${i} aria-pressed=${form.icon === i ? 'true' : 'false'} onClick=${() => update({ icon: i })}>${i}</button>`)}</div>
      <//>
    <//>
    <${SheetFooter}><span class="grow"></span><button type="button" class="btn btn-primary" disabled=${!form.name.trim()} onClick=${onSave}>${t('common.save')}</button><//>
  `;
}
