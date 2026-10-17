// @ts-check
// Identifiers and timestamps shared by all records.

/** @returns {string} a random UUID v4 */
export function newId() {
  return crypto.randomUUID();
}

/** @returns {string} the current instant as an ISO-8601 UTC string */
export function nowIso() {
  return new Date().toISOString();
}
