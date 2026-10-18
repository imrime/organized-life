// @ts-check
// Medication mutations; taking a dose decrements stock (docs/spec/05-cross-system.md F-9).

import { appStore } from '../../core/store.js';
import { doseId } from './model.js';

/** @typedef {import('./model.js').Medication} Medication */

/** @param {any} v */
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

/**
 * @param {Record<string, any>} form
 * @param {string|null} id
 */
export function saveMedication(form, id) {
  return appStore.mutate('meds.save', (tx) => {
    const fields = {
      name: form.name.trim(),
      form: form.form,
      dose: form.dose.trim(),
      schedule: {
        type: form.type,
        times: form.type === 'as_needed' ? [] : [...new Set(form.times.filter(Boolean))].sort(),
        days: form.type === 'weekdays' ? [...form.days].sort() : undefined,
        everyNDays: form.type === 'interval' ? Number(form.everyNDays) : undefined,
        startDate: form.startDate,
        endDate: form.endDate || null,
      },
      instructions: form.instructions.trim(),
      stock: num(form.stock),
      dosePerIntake: num(form.dosePerIntake) ?? 1,
      refillAt: num(form.refillAt),
      color: form.color,
      active: form.active,
    };
    return id ? tx.patch('medications', id, fields) : tx.insert('medications', fields);
  });
}

/** @param {string} id @param {boolean} active */
export function setMedicationActive(id, active) {
  return appStore.mutate('meds.archive', (tx) => tx.patch('medications', id, { active }));
}

/** Deletes a medication and its history. @param {string} id */
export function deleteMedication(id) {
  return appStore.mutate('meds.delete', (tx) => {
    for (const log of tx.all('doseLogs').filter((l) => l.medicationId === id)) tx.remove('doseLogs', log.id);
    tx.remove('medications', id);
  });
}

/**
 * Marks a scheduled dose taken/skipped, or clears the mark (status null). Keeps stock consistent.
 * @param {Medication} med
 * @param {string} date
 * @param {string} time
 * @param {'taken'|'skipped'|null} status
 */
export function markDose(med, date, time, status) {
  return appStore.mutate('meds.dose', (tx) => {
    const id = doseId(med.id, date, time);
    const previous = tx.get('doseLogs', id);
    const current = /** @type {any} */ (tx.get('medications', med.id));
    const per = current?.dosePerIntake ?? 1;
    let delta = 0;
    if (previous?.status === 'taken') delta += per;
    if (status === 'taken') delta -= per;
    if (status) {
      const fields = { medicationId: med.id, date, scheduledTime: time, status, at: new Date().toISOString() };
      if (previous) tx.patch('doseLogs', id, fields);
      else tx.insert('doseLogs', { id, ...fields });
    } else if (previous) tx.purge('doseLogs', id);
    if (delta && typeof current?.stock === 'number') tx.patch('medications', med.id, { stock: Math.max(0, current.stock + delta) });
  });
}

/** As-needed dose taken now. @param {Medication} med @param {string} date */
export function logAsNeeded(med, date) {
  return appStore.mutate('meds.asNeeded', (tx) => {
    tx.insert('doseLogs', { medicationId: med.id, date, scheduledTime: null, status: 'taken', at: new Date().toISOString() });
    const current = /** @type {any} */ (tx.get('medications', med.id));
    if (typeof current?.stock === 'number') tx.patch('medications', med.id, { stock: Math.max(0, current.stock - (current.dosePerIntake ?? 1)) });
  });
}
