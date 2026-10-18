// @ts-check
// Bootstrap (docs/spec/02-architecture.md §3).

import { VERSION, BUILD } from './version.js';
import { html, render } from './ui/lib.js';
import { setLanguage, t } from './core/i18n.js';
import { openDb, loadAll, writeOps, getMeta, putMeta, setAppDb } from './core/db.js';
import { createStore, setAppStore } from './core/store.js';
import { SCHEMA_VERSION, PROFILE, PURGE_AFTER_DAYS, COLLECTIONS, META_STORE } from './core/schema.js';
import { migrate } from './core/migrations.js';
import { applySeeds, SEED_VERSION } from './core/seed.js';
import { registerServiceWorker } from './core/sw-register.js';
import { parseHash, windowFromTarget } from './core/router.js';
import { setUi } from './ui/ui-state.js';
import { initHistory, openWindow } from './ui/sheet.js';
import { toast } from './ui/toast.js';
import { App } from './ui/app.js';
import { locationById, isVisible } from './world/locations.js';
import { objectBySlug } from './world/objects.js';
import { updateSettings } from './features/settings/actions.js';
import { startReminderEngine } from './core/reminders.js';
import { reminderState, markFired, purgeOldReminderState } from './core/reminder-state.js';
import { unlockAudioOnFirstGesture, playChime } from './core/sound.js';
import { ringAlarms } from './ui/alarm-overlay.js';
import { openObject } from './ui/navigation.js';
import './features/register.js';
import { maybeShowMorning } from './features/sleep/register.js';
import { startNightstand } from './ui/nightstand.js';

const root = /** @type {HTMLElement} */ (document.getElementById('app'));

/** @param {Record<string, any[]>} data */
const isEmpty = (data) => Object.values(data).every((records) => records.length === 0);

/**
 * Runs pending data migrations, keeping a pre-migration snapshot in meta.
 * @param {IDBDatabase} db
 * @param {Record<string, any[]>} raw
 */
async function migrateIfNeeded(db, raw) {
  const schema = await getMeta(db, 'schema');
  if (!schema) {
    await putMeta(db, { id: 'schema', version: SCHEMA_VERSION });
    return raw;
  }
  if (schema.version >= SCHEMA_VERSION) return raw;
  await putMeta(db, { id: 'preMigrationBackup', fromVersion: schema.version, data: raw });
  const data = migrate(raw, schema.version, SCHEMA_VERSION);
  const ops = COLLECTIONS.flatMap((name) => (data[name] ?? []).map((value) => ({ collection: name, key: value.id, value })));
  ops.push({ collection: META_STORE, key: 'schema', value: { id: 'schema', version: SCHEMA_VERSION } });
  await writeOps(db, ops);
  return data;
}

async function boot() {
  const db = await openDb();
  setAppDb(db);
  const raw = await loadAll(db);
  const firstLaunch = isEmpty(raw);
  const data = await migrateIfNeeded(db, raw);

  const store = createStore({ persist: (ops) => writeOps(db, ops), freeze: BUILD === 'dev' });
  store.load(data);
  setAppStore(store);

  const seed = await getMeta(db, 'seed');
  const seedFrom = seed?.version ?? 0;
  if (seedFrom < SEED_VERSION) {
    await store.mutate('seed', (tx) => applySeeds(tx, seedFrom, { locales: navigator.languages ?? [navigator.language], version: VERSION }), {
      quiet: true,
    });
    await putMeta(db, { id: 'seed', version: SEED_VERSION });
  }
  if (firstLaunch) await putMeta(db, { id: 'install', installId: crypto.randomUUID(), firstLaunchAt: new Date().toISOString() });

  const cutoff = new Date(Date.now() - PURGE_AFTER_DAYS * 86_400_000).toISOString();
  await store.purgeDeleted(cutoff);

  const settings = /** @type {Record<string, any>} */ (store.profile(PROFILE.settings) ?? {});
  setLanguage(settings.language ?? 'en');

  // Initial route: deep link → last location → bedroom.
  const route = parseHash(location.hash);
  const fromHash = locationById(route.locationId);
  const fromSettings = locationById(settings.lastLocationId);
  const start = [fromHash, fromSettings, locationById('bedroom')].find((loc) => loc && isVisible(loc, settings));
  setUi({ locationId: start?.id ?? 'bedroom' });
  initHistory();

  render(html`<${App} />`, root);

  unlockAudioOnFirstGesture();
  await purgeOldReminderState();
  const watched = ['alarms', 'events', 'tasks', 'reminderState', 'medications', 'doseLogs', 'routines', 'routineRuns', 'profile'];
  startReminderEngine({
    stateOf: reminderState,
    markFired,
    onAlarm: ringAlarms,
    onReminder: (inst) => {
      playChime(/** @type {number} */ (store.profile(PROFILE.settings)?.alarmVolume ?? 0.6));
      if (inst.data?.action === 'nightstand') {
        toast(`🌙 ${inst.title}`, { actionLabel: t('nightstand.start'), onAction: () => startNightstand() });
      } else {
        toast(`🔔 ${inst.title}`, { actionLabel: t('common.open'), onAction: () => inst.objectId && openObject(inst.objectId) });
      }
    },
    subscribe: (listener) => store.subscribe((touched) => watched.some((c) => touched.has(c)) && listener()),
  });

  // Deep link to a window (object slug or ~system window).
  if (fromHash && start === fromHash && route.target) {
    const obj = objectBySlug(fromHash.id, route.target);
    const windowId = obj ? obj.window : windowFromTarget(route.target);
    if (windowId) openWindow(windowId, { props: obj?.windowProps ?? {}, sourceObjectId: obj?.id ?? null, page: route.page ?? undefined, params: route.pageId ? { id: route.pageId } : undefined });
  }

  const imported = sessionStorage.getItem('organized-life:imported');
  if (imported) {
    sessionStorage.removeItem('organized-life:imported');
    toast(t('backup.imported', { count: Number(imported) }));
  }
  if (!route.target) setTimeout(maybeShowMorning, 800);

  if (!firstLaunch && settings.lastSeenVersion !== VERSION) {
    toast(t('app.updated', { version: VERSION }));
  }
  if (settings.lastSeenVersion !== VERSION) updateSettings({ lastSeenVersion: VERSION }).catch(() => undefined);

  registerServiceWorker().catch((err) => console.warn('Service worker registration failed', err));
}

/** @param {unknown} err */
function renderFatal(err) {
  console.error(err);
  render(
    html`<div class="fatal" role="alert">
      <h1>${t('errors.fatalTitle')}</h1>
      <p>${t('errors.fatalText')}</p>
      <button type="button" class="btn btn-primary" onClick=${() => location.reload()}>${t('common.retry')}</button>
    </div>`,
    root,
  );
}

boot().catch(renderFatal);
