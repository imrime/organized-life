// @ts-check
// Settings → Data & backup: export/import JSON, storage status, reset all data.

import { html, useEffect, useRef, useState } from '../../ui/lib.js';
import { t, formatDate, formatNumber } from '../../core/i18n.js';
import { appStore } from '../../core/store.js';
import { appDb, replaceAll } from '../../core/db.js';
import { SCHEMA_VERSION, PROFILE } from '../../core/schema.js';
import { buildBackup, backupFileName, parseBackup, mergeBackup } from '../../core/backup.js';
import { VERSION } from '../../version.js';
import { SheetHeader, SheetBody, SheetFooter } from '../../ui/sheet.js';
import { useProfile } from '../../ui/hooks.js';
import { toast } from '../../ui/toast.js';
import { confirmDialog, choiceDialog } from '../../ui/dialog.js';
import { updateSettings } from './actions.js';

/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

/** Asks the browser to keep our storage (call after onboarding). */
export async function requestPersistence() {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

async function exportBackup() {
  const ok = await confirmDialog({ title: t('backup.exportTitle'), message: t('backup.exportWarning'), confirmLabel: t('backup.export') });
  if (!ok) return;
  const backup = buildBackup(appStore.snapshot(), { schemaVersion: SCHEMA_VERSION, appVersion: VERSION });
  const name = backupFileName();
  const file = new File([JSON.stringify(backup)], name, { type: 'application/json' });
  // Phones: share sheet (save to Files / send). Desktop: download.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
    } catch (err) {
      if (/** @type {any} */ (err)?.name === 'AbortError') return;
      download(file);
    }
  } else download(file);
  await updateSettings({ lastBackupAt: new Date().toISOString() });
  toast(t('backup.exported'));
}

/** @param {File} file */
function download(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** @param {File} file */
async function importBackup(file) {
  const result = parseBackup(await file.text(), SCHEMA_VERSION);
  if (!result.ok) {
    toast(t(result.error));
    return;
  }
  const records = Object.values(result.counts).reduce((a, b) => a + b, 0);
  const mode = await choiceDialog({
    title: t('backup.importTitle'),
    message: t('backup.importSummary', { count: records, skipped: result.skipped }),
    choices: [
      { value: 'merge', label: t('backup.merge') },
      { value: 'replace', label: t('backup.replace'), destructive: true },
    ],
  });
  if (!mode) return;
  const data = mode === 'replace' ? result.data : mergeBackup(appStore.snapshot(), result.data);
  await replaceAll(appDb, data);
  sessionStorage.setItem('organized-life:imported', String(records));
  location.reload();
}

/** @param {{ nav: Nav }} props */
export function DataSection({ nav }) {
  const settings = useProfile(PROFILE.settings);
  const [storage, setStorage] = useState(/** @type {{ persisted: boolean|null, usage: number|null }} */ ({ persisted: null, usage: null }));
  /** @type {{ current: HTMLInputElement|null }} */
  const fileRef = useRef(null);
  useEffect(() => {
    (async () => {
      const persisted = (await navigator.storage?.persisted?.().catch(() => null)) ?? null;
      const estimate = await navigator.storage?.estimate?.().catch(() => null);
      setStorage({ persisted, usage: estimate?.usage ?? null });
    })();
  }, []);

  return html`<section class="section">
    <h3 class="section-title">${t('backup.section')}</h3>
    <div class="group">
      <button type="button" class="row" onClick=${exportBackup}>
        <span class="lead" aria-hidden="true">⬆️</span>
        <span class="main"><span class="title">${t('backup.export')}</span>
          <span class="subtitle" style="display:block">${settings.lastBackupAt ? t('backup.last', { date: formatDate(String(settings.lastBackupAt).slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' }) }) : t('backup.never')}</span></span>
      </button>
      <button type="button" class="row" onClick=${() => fileRef.current?.click()}>
        <span class="lead" aria-hidden="true">⬇️</span>
        <span class="main"><span class="title">${t('backup.import')}</span><span class="subtitle" style="display:block">${t('backup.importHelp')}</span></span>
      </button>
      <input ref=${fileRef} type="file" accept="application/json,.json" class="visually-hidden" tabindex="-1" aria-hidden="true"
        onChange=${(/** @type {Event} */ e) => {
          const input = /** @type {HTMLInputElement} */ (e.currentTarget);
          const file = input.files?.[0];
          input.value = '';
          if (file) importBackup(file);
        }} />
      <div class="row">
        <span class="lead" aria-hidden="true">💾</span>
        <span class="main"><span class="title">${t('backup.storage')}</span>
          <span class="subtitle" style="display:block">
            ${storage.persisted === true ? t('backup.persisted') : storage.persisted === false ? t('backup.notPersisted') : '—'}
            ${storage.usage !== null ? ` · ${formatNumber(storage.usage / 1_048_576, { maximumFractionDigits: 1 })} MB` : ''}
          </span></span>
      </div>
      <button type="button" class="row" onClick=${() => nav.push('reset')}>
        <span class="lead" aria-hidden="true">🗑️</span>
        <span class="main"><span class="title" style="color:var(--accent)">${t('backup.reset')}</span></span>
      </button>
    </div>
  </section>`;
}

/** Reset page: type RESET to confirm. @param {{ nav: Nav }} props */
export function ResetPage({ nav }) {
  const [text, setText] = useState('');
  const ok = text.trim().toUpperCase() === 'RESET';
  const reset = async () => {
    await replaceAll(appDb, {}, { clearMeta: true });
    location.reload();
  };
  return html`
    <${SheetHeader} title=${t('backup.reset')} back />
    <${SheetBody}>
      <p class="prose">${t('backup.resetWarning')}</p>
      <label class="field-label" for="reset-confirm" style="margin-top:16px">${t('backup.typeReset')}</label>
      <input id="reset-confirm" class="input" value=${text} autocomplete="off" onInput=${(/** @type {Event} */ e) => setText(/** @type {HTMLInputElement} */ (e.currentTarget).value)} />
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.pop()}>${t('common.cancel')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-danger solid" disabled=${!ok} onClick=${reset}>${t('backup.resetConfirm')}</button>
    <//>
  `;
}
