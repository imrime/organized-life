// @ts-check
// Data migrations: pure functions over { [collection]: records[] }, applied in order of `to`.

/**
 * @typedef {Record<string, any[]>} Data
 * @typedef {{ to: number, up: (data: Data) => Data }} Migration
 */

/** @type {Migration[]} */
export const migrations = [
  // { to: 2, up(data) { …; return data; } },
];

/**
 * @param {Data} data
 * @param {number} fromVersion
 * @param {number} toVersion
 * @param {Migration[]} [list]
 * @returns {Data}
 */
export function migrate(data, fromVersion, toVersion, list = migrations) {
  return list
    .filter((m) => m.to > fromVersion && m.to <= toVersion)
    .sort((a, b) => a.to - b.to)
    .reduce((acc, m) => m.up(acc), data);
}
