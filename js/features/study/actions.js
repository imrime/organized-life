// @ts-check
// Study mutations: modules, classes and exams (calendar events), resources.

import { appStore } from '../../core/store.js';
import { newId } from '../../core/ids.js';

/**
 * @param {{ name: string, code: string, color: string, teacher: string, term: string, credits: string, links: { id?: string, label: string, url: string }[], nextActionOverride: string, notes: string }} form
 * @param {string|null} id
 */
export function saveModule(form, id) {
  return appStore.mutate('study.module', (tx) => {
    const fields = {
      name: form.name.trim(),
      code: form.code.trim(),
      color: form.color,
      teacher: form.teacher.trim(),
      term: form.term.trim(),
      credits: form.credits === '' ? null : Number(form.credits),
      links: form.links.filter((l) => l.url.trim()).map((l) => ({ id: l.id ?? newId(), label: l.label.trim() || l.url.trim(), url: l.url.trim() })),
      nextActionOverride: form.nextActionOverride.trim(),
      notes: form.notes,
    };
    if (!id) return tx.insert('studyModules', { ...fields, archived: false });
    // Module colour follows into its classes and exams in the calendar.
    tx.all('events').filter((e) => e.moduleId === id).forEach((e) => tx.patch('events', e.id, { color: fields.color }));
    return tx.patch('studyModules', id, fields);
  });
}

/** @param {string} id @param {boolean} archived */
export function setModuleArchived(id, archived) {
  return appStore.mutate('study.archive', (tx) => tx.patch('studyModules', id, { archived }));
}

/**
 * A class is one weekly recurring calendar event (kind "class") until the term end.
 * @param {{ moduleId: string, title: string, days: number[], start: string, end: string, location: string, termStart: string, termEnd: string, reminderOffsetMin: number|null, notes: string }} form
 * @param {string|null} id
 */
export function saveClass(form, id) {
  return appStore.mutate('study.class', (tx) => {
    const module = tx.get('studyModules', form.moduleId);
    const previous = id ? tx.get('events', id) : undefined;
    const fields = {
      title: form.title.trim() || module?.name || '',
      kind: 'class',
      date: form.termStart,
      allDay: false,
      start: form.start,
      end: form.end,
      recurrence: { freq: 'weekly', interval: 1, byWeekday: [...form.days].sort(), until: form.termEnd || null, exDates: previous?.recurrence?.exDates ?? [] },
      reminderOffsetMin: form.reminderOffsetMin,
      location: form.location.trim(),
      notes: form.notes,
      moduleId: form.moduleId,
      color: module?.color ?? null,
    };
    return id ? tx.patch('events', id, fields) : tx.insert('events', fields);
  });
}

/**
 * @param {{ moduleId: string, title: string, date: string, time: string, location: string, reminderOffsetMin: number|null, notes: string }} form
 * @param {string|null} id
 */
export function saveExam(form, id) {
  return appStore.mutate('study.exam', (tx) => {
    const module = tx.get('studyModules', form.moduleId);
    const fields = {
      title: form.title.trim(),
      kind: 'exam',
      date: form.date,
      allDay: !form.time,
      start: form.time || null,
      end: form.time ? addHour(form.time) : null,
      recurrence: null,
      reminderOffsetMin: form.reminderOffsetMin,
      location: form.location.trim(),
      notes: form.notes,
      moduleId: form.moduleId,
      color: module?.color ?? null,
    };
    return id ? tx.patch('events', id, fields) : tx.insert('events', fields);
  });
}

/** "09:30" → "10:30" (capped at 23:59). @param {string} time */
function addHour(time) {
  const [h, m] = time.split(':').map(Number);
  return h >= 23 ? '23:59' : `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * @param {{ moduleId: string|null, type: string, title: string, author: string, url: string, citation: string, status: string, notes: string }} form
 * @param {string|null} id
 */
export function saveResource(form, id) {
  return appStore.mutate('study.resource', (tx) => {
    const fields = { ...form, moduleId: form.moduleId || null, title: form.title.trim(), author: form.author.trim(), url: form.url.trim() || null };
    return id ? tx.patch('studyResources', id, fields) : tx.insert('studyResources', fields);
  });
}

/** @param {string} id @param {string} status */
export function setResourceStatus(id, status) {
  return appStore.mutate('study.resourceStatus', (tx) => tx.patch('studyResources', id, { status }));
}

/** @param {string} id */
export function deleteResource(id) {
  return appStore.mutate('study.resourceDelete', (tx) => tx.remove('studyResources', id));
}
