// @ts-check
import { describe, it, expect } from '../harness.js';
import { effectiveExpiry, expiryState, stockLevel, isLow, mergeTarget, suggestedExpiry, stepFor, expiringItems } from '../../js/features/inventory/model.js';
import { parseQuickAdd, findOpenItem, suggestions, estimateTotal, aisles } from '../../js/features/shopping/model.js';
import { linesTotal, splitByCategory, validateCheckout, destinationCounts } from '../../js/features/checkout/model.js';
import { accountBalance, shiftMonth, monthTotals, byCategory, budgetTone, validateTransaction, groupByDay } from '../../js/features/finance/model.js';
import { mealTypeAt, daySummary, recentFoods, validateMeal } from '../../js/features/diary/model.js';
import { roundScaled, scaledQuantity, availability, missingIngredients, validateRecipe } from '../../js/features/recipes/model.js';
import { findProduct, searchProducts } from '../../js/features/products/model.js';
import { SEED_PRODUCTS, shopCategoryFor, financeCategoryFor, locationFor } from '../../js/features/products/catalog.js';

/** @param {any} i */
const item = (i) => ({ id: 'i', name: 'Milk', productId: null, location: 'fridge', quantity: 1, unit: 'l', expiryDate: null, openedAt: null, useWithinMonths: null, lowStockAt: null, ...i });
/** @param {any} t */
const tx = (t) => ({ id: 'x', type: 'expense', accountId: 'acc', categoryId: 'cat-groceries', amountMinor: 100, date: '2026-10-10', ...t });

describe('inventory', () => {
  it('uses the earlier of expiry date and period-after-opening', () => {
    expect(effectiveExpiry(item({ expiryDate: '2027-01-01', openedAt: '2026-10-01', useWithinMonths: 1 }))).toBe('2026-11-01');
    expect(effectiveExpiry(item({ expiryDate: '2026-10-20', openedAt: '2026-10-01', useWithinMonths: 6 }))).toBe('2026-10-20');
    expect(effectiveExpiry(item({}))).toBe(null);
  });
  it('classifies expiry relative to today', () => {
    const today = '2026-10-18';
    expect(expiryState(item({ expiryDate: '2026-10-17' }), today)).toBe('expired');
    expect(expiryState(item({ expiryDate: '2026-10-18' }), today)).toBe('today');
    expect(expiryState(item({ expiryDate: '2026-10-19' }), today)).toBe('tomorrow');
    expect(expiryState(item({ expiryDate: '2026-10-20' }), today)).toBe('soon');
    expect(expiryState(item({ expiryDate: '2026-11-20' }), today)).toBe('later');
    expect(expiryState(item({}), today)).toBe('none');
    expect(expiringItems([item({ id: 'a', expiryDate: '2026-10-19' }), item({ id: 'b', expiryDate: '2026-10-25' })], today).map((i) => i.id)).toEqual(['a']);
  });
  it('reports stock levels only when a threshold is set', () => {
    expect(stockLevel(item({ quantity: 1 }))).toBe(null);
    expect(stockLevel(item({ quantity: 0, lowStockAt: 1 }))).toBe('out');
    expect(stockLevel(item({ quantity: 1, lowStockAt: 1 }))).toBe('low');
    expect(stockLevel(item({ quantity: 2, lowStockAt: 1 }))).toBe('ok');
    expect(isLow(item({ quantity: 0, lowStockAt: 1 }))).toBe(true);
  });
  it('merges only identical batches', () => {
    const stock = [item({ id: 'a', expiryDate: '2026-10-25' })];
    expect(mergeTarget(stock, item({ name: ' milk ', expiryDate: '2026-10-25' }))?.id).toBe('a');
    expect(mergeTarget(stock, item({ expiryDate: '2026-10-26' }))).toBe(undefined);
    expect(mergeTarget(stock, item({ expiryDate: '2026-10-25', location: 'pantry' }))).toBe(undefined);
  });
  it('suggests expiry and stepper steps', () => {
    expect(suggestedExpiry('2026-10-18', 7)).toBe('2026-10-25');
    expect(suggestedExpiry('2026-10-18', null)).toBe(null);
    expect(stepFor('g')).toBe(100);
    expect(stepFor('kg')).toBe(0.1);
    expect(stepFor('pcs')).toBe(1);
  });
});

describe('products', () => {
  it('maps catalog categories to shop aisles, finance categories and places', () => {
    expect(SEED_PRODUCTS.length > 50).toBe(true);
    expect(financeCategoryFor('dairy')).toBe('cat-groceries');
    expect(locationFor('dairy')).toBe('fridge');
    expect(typeof shopCategoryFor('dairy')).toBe('string');
  });
  it('finds and searches by display name', () => {
    const products = [{ id: 'a', name: 'Apples', favorite: false }, { id: 'b', name: 'Bananas', favorite: true }, { id: 'c', name: 'Pineapple', favorite: false }];
    /** @param {any} p */
    const nameOf = (p) => p.name;
    expect(findProduct(/** @type {any} */ (products), ' apples ', nameOf)?.id).toBe('a');
    expect(findProduct(/** @type {any} */ (products), '', nameOf)).toBe(undefined);
    expect(searchProducts(/** @type {any} */ (products), 'app', nameOf).map((p) => p.id)).toEqual(['a', 'c']);
  });
});

describe('shopping', () => {
  it('parses quick-add text in English and Russian', () => {
    expect(parseQuickAdd('2 kg apples')).toEqual({ name: 'apples', quantity: 2, unit: 'kg' });
    expect(parseQuickAdd('3 eggs')).toEqual({ name: 'eggs', quantity: 3, unit: null });
    expect(parseQuickAdd('apples 2')).toEqual({ name: 'apples', quantity: 2, unit: null });
    expect(parseQuickAdd('молоко 1,5 л')).toEqual({ name: 'молоко', quantity: 1.5, unit: 'l' });
    expect(parseQuickAdd('bread')).toEqual({ name: 'bread', quantity: null, unit: null });
  });
  it('suggests low stock and refills that are not already on the list', () => {
    const inventory = [item({ id: 'low', name: 'Rice', quantity: 0, lowStockAt: 1 }), item({ id: 'ok', name: 'Pasta', quantity: 5, lowStockAt: 1 })];
    const meds = [{ id: 'm', name: 'Vitamin D', active: true, stock: 2, refillAt: 5 }];
    const shopping = /** @type {any[]} */ ([]);
    const s = suggestions({ inventory: /** @type {any} */ (inventory), meds, shopping, productOf: () => undefined });
    expect(s.map((e) => e.key)).toEqual(['low:low', 'refill:m']);
    const listed = /** @type {any[]} */ ([{ id: 's', name: 'rice', checked: false }]);
    expect(suggestions({ inventory: /** @type {any} */ (inventory), meds: [], shopping: listed, productOf: () => undefined }).length).toBe(0);
    expect(findOpenItem(listed, { name: 'Rice' })?.id).toBe('s');
  });
  it('estimates totals from explicit and last prices', () => {
    const items = /** @type {any[]} */ ([
      { id: 'a', name: 'A', quantity: 1, unit: 'pcs', estPriceMinor: 200, checked: false },
      { id: 'b', name: 'B', quantity: 2, unit: 'pcs', productId: 'p', checked: false },
      { id: 'c', name: 'C', quantity: 1, unit: 'pcs', checked: false },
    ]);
    const est = estimateTotal(items, () => ({ lastPriceMinor: 100, defaultQty: 1, defaultUnit: 'pcs' }));
    expect(est.total >= 200).toBe(true);
    expect(est.approx).toBe(true);
  });
  it('groups open items into aisles', () => {
    const groups = aisles(/** @type {any} */ ([{ id: 'a', name: 'A', shopCategory: 'bakery', priority: 'normal', checked: false }, { id: 'b', name: 'B', shopCategory: 'bakery', priority: 'normal', checked: true }]));
    const bakery = groups.find((g) => g.key === 'bakery');
    expect(bakery?.items.length).toBe(1);
  });
});

describe('checkout', () => {
  const lines = /** @type {any[]} */ ([
    { financeCategoryId: 'cat-groceries', priceMinor: 300, quantity: 1, destination: 'fridge' },
    { financeCategoryId: 'cat-groceries', priceMinor: 100, quantity: 1, destination: 'pantry' },
    { financeCategoryId: 'cat-personal', priceMinor: 100, quantity: 1, destination: 'bathroom' },
  ]);
  it('splits the actual total by category so parts add up exactly', () => {
    expect(linesTotal(lines)).toBe(500);
    const split = splitByCategory(lines, 451);
    expect(split.reduce((s, g) => s + g.amountMinor, 0)).toBe(451);
    expect(split.map((g) => g.financeCategoryId)).toEqual(['cat-groceries', 'cat-personal']);
    expect(splitByCategory(lines, 500).map((g) => g.amountMinor)).toEqual([400, 100]);
  });
  it('validates lines and the paid total', () => {
    expect(validateCheckout([], 0).lines).toBe('checkout.errors.empty');
    expect(validateCheckout([{ ...lines[0], quantity: 0 }], 100).lines).toBe('checkout.errors.quantity');
    expect(validateCheckout(lines, null).total).toBe('checkout.errors.total');
    expect(validateCheckout(lines, 500)).toEqual({});
    expect(destinationCounts(lines)).toEqual({ fridge: 1, pantry: 1, bathroom: 1 });
  });
});

describe('finance', () => {
  const txs = [tx({ amountMinor: 1000 }), tx({ type: 'income', amountMinor: 5000, categoryId: 'cat-salary' }), tx({ amountMinor: 500, date: '2026-09-30' }), tx({ accountId: 'other', amountMinor: 50 })];
  it('computes balances from the opening balance', () => {
    expect(accountBalance(/** @type {any} */ ({ id: 'acc', openingBalanceMinor: 2000 }), /** @type {any} */ (txs))).toBe(2000 - 1000 + 5000 - 500);
  });
  it('shifts months across years', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
  it('totals a month and groups by category', () => {
    expect(monthTotals(/** @type {any} */ (txs), '2026-10')).toEqual({ spent: 1050, income: 5000 });
    expect(byCategory(/** @type {any} */ (txs), '2026-10')).toEqual([{ categoryId: 'cat-groceries', amountMinor: 1050 }]);
    expect(groupByDay(/** @type {any} */ (txs), '2026-09').length).toBe(1);
  });
  it('rates budget use', () => {
    expect(budgetTone(10, 0)).toBe('none');
    expect(budgetTone(70, 100)).toBe('ok');
    expect(budgetTone(80, 100)).toBe('near');
    expect(budgetTone(101, 100)).toBe('over');
  });
  it('requires a positive amount', () => {
    expect(Boolean(validateTransaction(/** @type {any} */ ({ amountMinor: 0, type: 'expense', accountId: 'a', categoryId: 'c', date: '2026-10-18' })).amount)).toBe(true);
  });
});

describe('diary', () => {
  it('defaults the meal type by time of day', () => {
    expect(mealTypeAt(new Date(2026, 9, 18, 8, 0))).toBe('breakfast');
    expect(mealTypeAt(new Date(2026, 9, 18, 13, 0))).toBe('lunch');
    expect(mealTypeAt(new Date(2026, 9, 18, 19, 0))).toBe('dinner');
  });
  it('summarises a day and lists recent distinct foods', () => {
    const meals = /** @type {any[]} */ ([
      { id: '1', date: '2026-10-18', time: '08:00', mealType: 'breakfast', food: 'Oats', kcal: 300 },
      { id: '2', date: '2026-10-18', time: '13:00', mealType: 'lunch', food: 'oats' },
      { id: '3', date: '2026-10-18', time: '16:00', mealType: 'snack', food: 'Apple', kcal: 80 },
    ]);
    const s = daySummary(meals);
    expect(s.mainMeals).toBe(2);
    expect(s.totals.kcal).toBe(380);
    expect(s.has.proteinG).toBe(false);
    expect(recentFoods(meals).map((m) => m.id)).toEqual(['3', '2']);
    expect(validateMeal({ food: ' ' }).food).toBe('form.errors.required');
  });
});

describe('recipes', () => {
  it('scales and rounds ingredient quantities', () => {
    expect(roundScaled(1.3, 'pcs')).toBe(1.5);
    expect(roundScaled(123, 'g')).toBe(125);
    expect(scaledQuantity({ name: 'Eggs', quantity: 2, unit: 'pcs' }, 2, 3)).toBe(3);
    expect(scaledQuantity({ name: 'Salt', quantity: null, unit: null }, 2, 3)).toBe(null);
  });
  it('checks availability with unit conversion', () => {
    const stock = /** @type {any[]} */ ([item({ name: 'Flour', location: 'pantry', quantity: 0.2, unit: 'kg' }), item({ name: 'Eggs', location: 'fridge', quantity: 6, unit: 'pcs' })]);
    expect(availability({ name: 'Flour', quantity: 500, unit: 'g' }, 500, stock)).toEqual({ state: 'partial', missing: 300 });
    expect(availability({ name: 'Eggs', quantity: 2, unit: 'pcs' }, 2, stock).state).toBe('have');
    expect(availability({ name: 'Milk', quantity: 1, unit: 'l' }, 1, stock).state).toBe('missing');
    const recipe = /** @type {any} */ ({ servings: 2, ingredients: [{ name: 'Eggs', quantity: 4, unit: 'pcs' }, { name: 'Milk', quantity: 0.2, unit: 'l' }, { name: 'Chives', optional: true }] });
    const missing = missingIngredients(recipe, 2, stock);
    expect(missing.map((m) => m.ing.name)).toEqual(['Milk']);
    expect(missing.find((m) => m.ing.name === 'Milk')?.state).toBe('missing');
  });
  it('requires a title', () => {
    expect(Boolean(validateRecipe(/** @type {any} */ ({ title: '', servings: 2, ingredients: [] })).title)).toBe(true);
  });
});
