// @ts-check
// Clothing templates and colours (docs/spec/04-data-model.md §3.12). Pure data.

/** @typedef {'top'|'bottom'|'dress'|'outerwear'|'shoes'|'accessory'} Slot */

/** @type {Record<string, string>} ColorKey → hex */
export const COLORS = {
  white: '#F4F1EC',
  cream: '#EFE3C8',
  beige: '#D8C3A0',
  grey: '#9A9A9A',
  black: '#2E2B2A',
  navy: '#2C3E63',
  denim: '#4A6A9A',
  blue: '#4A78B5',
  green: '#4F8A5B',
  olive: '#7A7F45',
  yellow: '#E8C24A',
  orange: '#E08A3C',
  red: '#C4413E',
  pink: '#E79AB0',
  purple: '#8B67A8',
  brown: '#7A5235',
};

/** @type {Record<Slot, string[]>} */
export const TEMPLATES = {
  top: ['tshirt', 'longsleeve', 'shirt', 'blouse', 'sweater', 'hoodie', 'tank'],
  bottom: ['jeans', 'trousers', 'shorts', 'skirt', 'leggings', 'joggers'],
  dress: ['dress', 'jumpsuit'],
  outerwear: ['jacket', 'coat', 'blazer', 'cardigan', 'raincoat'],
  shoes: ['sneakers', 'boots', 'heels', 'sandals', 'loafers'],
  accessory: ['cap', 'beanie', 'scarf', 'bag', 'watch'],
};

/** @type {Slot[]} */
export const SLOTS = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'];

/** @param {string} template @returns {Slot} */
export function slotOf(template) {
  return /** @type {Slot} */ (SLOTS.find((slot) => TEMPLATES[slot].includes(template)) ?? 'top');
}

/** Default laundry group from colour (spec §3.12). @param {string} color */
export function laundryGroupFor(color) {
  if (['white', 'cream'].includes(color)) return 'whites';
  if (['grey', 'beige', 'yellow', 'pink'].includes(color)) return 'lights';
  if (['black', 'navy', 'denim', 'brown'].includes(color)) return 'darks';
  return 'colours';
}

/** Default care: shoes and accessories are not washed. @param {Slot} slot */
export function defaultCare(slot) {
  return slot === 'shoes' || slot === 'accessory' ? 'no_wash' : 'normal';
}

/**
 * Applies a new item to an outfit selection: a dress replaces top+bottom and vice versa.
 * @param {Record<string, string|null|undefined>} selection
 * @param {Slot} slot
 * @param {string|null} id
 */
export function wearInSlot(selection, slot, id) {
  const next = { ...selection, [slot]: id };
  if (id && slot === 'dress') {
    next.top = null;
    next.bottom = null;
  }
  if (id && (slot === 'top' || slot === 'bottom')) next.dress = null;
  return next;
}
