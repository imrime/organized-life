// @ts-check
// Backup file format and validation (pure). docs/spec/04-data-model.md §7.

import { COLLECTIONS } from './schema.js';
import { migrate } from './migrations.js';

export const BACKUP_APP = 'organized-life';
export const BACKUP_FORMAT = 1;
/** Transient state that is not worth restoring. */
const EXCLUDED = new Set(['reminderState']);

/**
 * @param {Record<string, any[]>} snapshot all records incl. soft-deleted
 * @param {{ schemaVersion: number, appVersion: string, now?: Date }} meta
 */
export function buildBackup(snapshot, { schemaVersion, appVersion, now = new Date() }) {
  /** @type {Record<string, any[]>} */
  const data = {};
  for (const name of COLLECTIONS) if (!EXCLUDED.has(name)) data[name] = snapshot[name] ?? [];
  return { app: BACKUP_APP, format: BACKUP_FORMAT, schemaVersion, appVersion, exportedAt: now.toISOString(), data };
}

/** @param {Date} now */
export function backupFileName(now = new Date()) {
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `organized-life-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/**
 * Parses and validates a backup file; migrates older schemas.
 * @param {string} text
 * @param {number} currentSchema
 * @returns {{ ok: true, data: Record<string, any[]>, counts: Record<string, number>, skipped: number, total: number } | { ok: false, error: string }}
 */
export function parseBackup(text, currentSchema) {
  /** @type {any} */
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'backup.errors.notJson' };
  }
  if (!json || json.app !== BACKUP_APP || typeof json.data !== 'object') return { ok: false, error: 'backup.errors.notBackup' };
  if (typeof json.schemaVersion !== 'number' || json.schemaVersion > currentSchema) return { ok: false, error: 'backup.errors.newer' };
  /** @type {Record<string, any[]>} */
  const clean = {};
  let skipped = 0;
  let total = 0;
  for (const name of COLLECTIONS) {
    if (EXCLUDED.has(name)) continue;
    const records = Array.isArray(json.data[name]) ? json.data[name] : [];
    clean[name] = records.filter((r) => {
      const ok = r && typeof r === 'object' && typeof r.id === 'string' && typeof r.createdAt === 'string' && typeof r.updatedAt === 'string';
      if (!ok) skipped++;
      return ok;
    });
    total += clean[name].length;
  }
  const data = migrate(clean, json.schemaVersion, currentSchema);
  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.filter((r) => !r.deletedAt).length]));
  return { ok: true, data, counts, skipped, total };
}

/**
 * Merge by id: the newer updatedAt wins.
 * @param {Record<string, any[]>} current
 * @param {Record<string, any[]>} incoming
 */
export function mergeBackup(current, incoming) {
  /** @type {Record<string, any[]>} */
  const out = {};
  for (const name of COLLECTIONS) {
    const map = new Map((current[name] ?? []).map((r) => [r.id, r]));
    for (const r of incoming[name] ?? []) {
      const mine = map.get(r.id);
      if (!mine || String(r.updatedAt) > String(mine.updatedAt)) map.set(r.id, r);
    }
    out[name] = [...map.values()];
  }
  return out;
}
