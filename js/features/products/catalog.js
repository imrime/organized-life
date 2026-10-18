// @ts-check
// Product, shop and finance categories plus first-run seed lists (docs/spec/04-data-model.md §3.8–3.9, §3.16, §6). Pure data.

export const FOOD_CATEGORIES = ['dairy', 'meat_fish', 'produce', 'bakery', 'frozen', 'drinks', 'grains', 'canned', 'spices', 'snacks', 'baking', 'sauces', 'other_food'];
export const BATH_CATEGORIES = ['skincare', 'hygiene', 'haircare', 'cosmetics', 'cleaning', 'paper', 'first_aid', 'other_bath'];
export const PANTRY_CATEGORIES = ['grains', 'canned', 'spices', 'snacks', 'drinks', 'baking', 'sauces', 'other_food'];

/** Aisle order of the shopping list. */
export const SHOP_CATEGORIES = ['produce', 'bakery', 'dairy', 'meat_fish', 'frozen', 'pantry', 'drinks', 'snacks', 'household', 'personal_care', 'pharmacy', 'hobby', 'other'];

/** Shop aisle for an inventory/product category. @param {string} category */
export function shopCategoryFor(category) {
  if (['dairy', 'meat_fish', 'produce', 'bakery', 'frozen', 'drinks', 'snacks'].includes(category)) return category;
  if (['grains', 'canned', 'spices', 'baking', 'sauces', 'other_food'].includes(category)) return 'pantry';
  if (['skincare', 'hygiene', 'haircare', 'cosmetics'].includes(category)) return 'personal_care';
  if (category === 'first_aid') return 'pharmacy';
  if (['cleaning', 'paper', 'household'].includes(category)) return 'household';
  return 'other';
}

/** Finance category id for a shop aisle (grocery checkout split). @param {string} shopCategory */
export function financeCategoryFor(shopCategory) {
  if (shopCategory === 'household') return 'cat-household';
  if (shopCategory === 'personal_care') return 'cat-personal';
  if (shopCategory === 'pharmacy') return 'cat-health';
  if (shopCategory === 'hobby') return 'cat-entertainment';
  if (shopCategory === 'other') return 'cat-other';
  return 'cat-groceries';
}

/** Default storage for a category. @param {string} category */
export function locationFor(category) {
  if (['dairy', 'meat_fish', 'produce'].includes(category)) return 'fridge';
  if (category === 'frozen') return 'freezer';
  if (BATH_CATEGORIES.includes(category)) return 'bathroom';
  if (category === 'household') return 'none';
  return 'pantry';
}

/** Typical shelf life after purchase, in days (null = long-life). @param {string} category */
export function shelfLifeFor(category) {
  return /** @type {Record<string, number>} */ ({ dairy: 7, meat_fish: 3, produce: 6, bakery: 4, frozen: 90 })[category] ?? null;
}

/** @typedef {[string, string, string, number, number|null]} SeedProduct key, category, unit, qty, shelfLifeDays */
/** @type {SeedProduct[]} */
export const SEED_PRODUCTS = [
  ['milk', 'dairy', 'l', 1, 7], ['eggs', 'dairy', 'pcs', 10, 21], ['butter', 'dairy', 'g', 200, 30], ['cheese', 'dairy', 'g', 200, 14],
  ['yogurt', 'dairy', 'pcs', 4, 10], ['cream', 'dairy', 'ml', 200, 7], ['cottage', 'dairy', 'g', 200, 5],
  ['chicken', 'meat_fish', 'g', 500, 2], ['beef', 'meat_fish', 'g', 500, 3], ['fish', 'meat_fish', 'g', 400, 2], ['ham', 'meat_fish', 'g', 150, 5],
  ['apples', 'produce', 'kg', 1, 14], ['bananas', 'produce', 'pcs', 6, 5], ['tomatoes', 'produce', 'kg', 0.5, 6], ['cucumbers', 'produce', 'pcs', 3, 7],
  ['potatoes', 'produce', 'kg', 2, 30], ['onions', 'produce', 'kg', 1, 30], ['carrots', 'produce', 'kg', 1, 21], ['lemons', 'produce', 'pcs', 3, 14],
  ['lettuce', 'produce', 'pcs', 1, 5], ['garlic', 'produce', 'pcs', 1, 30], ['peppers', 'produce', 'pcs', 3, 7],
  ['bread', 'bakery', 'pcs', 1, 4], ['buns', 'bakery', 'pcs', 4, 3],
  ['frozenVeg', 'frozen', 'g', 400, 180], ['iceCream', 'frozen', 'pcs', 1, 180], ['frozenBerries', 'frozen', 'g', 300, 180],
  ['water', 'drinks', 'l', 1.5, null], ['juice', 'drinks', 'l', 1, null], ['coffee', 'drinks', 'g', 250, null], ['tea', 'drinks', 'pack', 1, null],
  ['rice', 'grains', 'kg', 1, null], ['pasta', 'grains', 'g', 500, null], ['oats', 'grains', 'g', 500, null], ['buckwheat', 'grains', 'kg', 1, null], ['flour', 'baking', 'kg', 1, null],
  ['sugar', 'baking', 'kg', 1, null], ['salt', 'spices', 'kg', 1, null], ['pepper', 'spices', 'pack', 1, null], ['oil', 'sauces', 'l', 1, null],
  ['tomatoSauce', 'sauces', 'pcs', 1, null], ['beans', 'canned', 'pcs', 1, null], ['tuna', 'canned', 'pcs', 1, null], ['honey', 'sauces', 'pcs', 1, null],
  ['chocolate', 'snacks', 'pcs', 1, null], ['cookies', 'snacks', 'pack', 1, null], ['nuts', 'snacks', 'g', 200, null],
  ['toothpaste', 'hygiene', 'pcs', 1, null], ['shampoo', 'haircare', 'pcs', 1, null], ['showerGel', 'hygiene', 'pcs', 1, null], ['soap', 'hygiene', 'pcs', 1, null],
  ['deodorant', 'hygiene', 'pcs', 1, null], ['faceCream', 'skincare', 'pcs', 1, null], ['toiletPaper', 'paper', 'pack', 1, null], ['paperTowels', 'paper', 'pack', 1, null],
  ['dishSoap', 'cleaning', 'pcs', 1, null], ['laundryDetergent', 'cleaning', 'pcs', 1, null], ['trashBags', 'household', 'pack', 1, null], ['sponges', 'household', 'pack', 1, null],
  ['plasters', 'first_aid', 'pack', 1, null], ['painkillers', 'first_aid', 'pack', 1, null],
];

/** @type {[string, 'expense'|'income', string, string][]} id, kind, icon, color */
export const SEED_FINANCE_CATEGORIES = [
  ['cat-groceries', 'expense', '🛒', 'green'], ['cat-household', 'expense', '🧽', 'blue'], ['cat-personal', 'expense', '🧴', 'pink'],
  ['cat-health', 'expense', '💊', 'red'], ['cat-clothing', 'expense', '👕', 'purple'], ['cat-eatingout', 'expense', '🍽️', 'orange'],
  ['cat-transport', 'expense', '🚌', 'navy'], ['cat-housing', 'expense', '🏠', 'brown'], ['cat-entertainment', 'expense', '🎬', 'yellow'],
  ['cat-education', 'expense', '📚', 'olive'], ['cat-sport', 'expense', '🏋️', 'denim'], ['cat-gifts', 'expense', '🎁', 'red'],
  ['cat-other', 'expense', '•', 'grey'],
  ['cat-salary', 'income', '💼', 'green'], ['cat-scholarship', 'income', '🎓', 'blue'], ['cat-giftsin', 'income', '🎁', 'pink'], ['cat-otherin', 'income', '•', 'grey'],
];
