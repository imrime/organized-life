// @ts-check
// Quantity units and conversions.

/** @typedef {'pcs'|'g'|'kg'|'ml'|'l'|'pack'} Unit */

/** @type {Unit[]} */
export const UNITS = ['pcs', 'g', 'kg', 'ml', 'l', 'pack'];

/** @type {Record<Unit, {base: string, factor: number}>} */
const BASE = {
  pcs: { base: 'pcs', factor: 1 },
  pack: { base: 'pack', factor: 1 },
  g: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 },
};

/**
 * @param {Unit} a
 * @param {Unit} b
 */
export function comparable(a, b) {
  return BASE[a].base === BASE[b].base;
}

/**
 * Converts a quantity; returns null when the units measure different things.
 * @param {number} quantity
 * @param {Unit} from
 * @param {Unit} to
 * @returns {number|null}
 */
export function convert(quantity, from, to) {
  if (!comparable(from, to)) return null;
  return (quantity * BASE[from].factor) / BASE[to].factor;
}

const LB_PER_KG = 2.20462;

/** @param {number} kg */
export function kgToLb(kg) {
  return Math.round(kg * LB_PER_KG * 2) / 2;
}

/** @param {number} lb */
export function lbToKg(lb) {
  return lb / LB_PER_KG;
}
