// Service worker for Organized Life (docs/spec/06-pwa-release.md §2).
// CACHE is replaced in CI with the commit SHA so every deploy gets a fresh code cache.
const CACHE = 'organized-life-dev';
const IMMUTABLE_CACHE = 'organized-life-immutable';

// App shell and code: network-first, cached for offline use.
// Add every new module here — `python3 tools/check_sw_assets.py` verifies (and `--fix` rewrites) this list.
// <assets>
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/base.css',
  './css/components.css',
  './css/scene.css',
  './css/sheet.css',
  './css/shell.css',
  './css/tokens.css',
  './js/asset-manifest.js',
  './js/main.js',
  './js/version.js',
  './js/windows.js',
  './js/core/backup.js',
  './js/core/bus.js',
  './js/core/db.js',
  './js/core/i18n.js',
  './js/core/ids.js',
  './js/core/migrations.js',
  './js/core/money.js',
  './js/core/power.js',
  './js/core/reminder-state.js',
  './js/core/reminders.js',
  './js/core/router.js',
  './js/core/schema.js',
  './js/core/seed.js',
  './js/core/sound.js',
  './js/core/store.js',
  './js/core/sw-register.js',
  './js/core/text.js',
  './js/core/time.js',
  './js/core/units.js',
  './js/features/register.js',
  './js/features/achievements/model.js',
  './js/features/achievements/register.js',
  './js/features/achievements/stats.js',
  './js/features/alarms/actions.js',
  './js/features/alarms/model.js',
  './js/features/alarms/register.js',
  './js/features/alarms/window.js',
  './js/features/calendar/actions.js',
  './js/features/calendar/model.js',
  './js/features/calendar/register.js',
  './js/features/calendar/window.js',
  './js/features/care/mirror.js',
  './js/features/care/register.js',
  './js/features/care/shower.js',
  './js/features/character/window.js',
  './js/features/checkout/actions.js',
  './js/features/checkout/model.js',
  './js/features/checkout/page.js',
  './js/features/coming-soon/window.js',
  './js/features/creative/actions.js',
  './js/features/creative/model.js',
  './js/features/creative/window.js',
  './js/features/diary/actions.js',
  './js/features/diary/model.js',
  './js/features/diary/register.js',
  './js/features/diary/window.js',
  './js/features/finance/actions.js',
  './js/features/finance/model.js',
  './js/features/finance/register.js',
  './js/features/finance/window.js',
  './js/features/inventory/actions.js',
  './js/features/inventory/model.js',
  './js/features/inventory/register.js',
  './js/features/inventory/window.js',
  './js/features/laundry/actions.js',
  './js/features/laundry/basket.js',
  './js/features/laundry/machine.js',
  './js/features/laundry/model.js',
  './js/features/laundry/register.js',
  './js/features/map/window.js',
  './js/features/media/actions.js',
  './js/features/media/games.js',
  './js/features/media/item-page.js',
  './js/features/media/model.js',
  './js/features/media/music.js',
  './js/features/media/register.js',
  './js/features/media/screen.js',
  './js/features/media/shelf.js',
  './js/features/media/ui.js',
  './js/features/meds/actions.js',
  './js/features/meds/model.js',
  './js/features/meds/register.js',
  './js/features/meds/window.js',
  './js/features/products/catalog.js',
  './js/features/products/model.js',
  './js/features/products/ui.js',
  './js/features/quick/window.js',
  './js/features/recipes/actions.js',
  './js/features/recipes/model.js',
  './js/features/recipes/window.js',
  './js/features/routines/actions.js',
  './js/features/routines/model.js',
  './js/features/routines/ui.js',
  './js/features/settings/actions.js',
  './js/features/settings/data.js',
  './js/features/settings/window.js',
  './js/features/shop/clothing-actions.js',
  './js/features/shop/clothing.js',
  './js/features/shop/grocery.js',
  './js/features/shopping/actions.js',
  './js/features/shopping/model.js',
  './js/features/shopping/register.js',
  './js/features/shopping/window.js',
  './js/features/sleep/actions.js',
  './js/features/sleep/model.js',
  './js/features/sleep/register.js',
  './js/features/sleep/window.js',
  './js/features/tasks/actions.js',
  './js/features/tasks/model.js',
  './js/features/tasks/register.js',
  './js/features/tasks/window.js',
  './js/features/walks/actions.js',
  './js/features/walks/model.js',
  './js/features/walks/register.js',
  './js/features/walks/window.js',
  './js/features/wardrobe/actions.js',
  './js/features/wardrobe/catalog.js',
  './js/features/wardrobe/register.js',
  './js/features/wardrobe/window.js',
  './js/features/world-list/window.js',
  './js/i18n/en.bathroom.js',
  './js/i18n/en.bedroom.js',
  './js/i18n/en.js',
  './js/i18n/en.kitchen.js',
  './js/i18n/en.leisure.js',
  './js/i18n/merge.js',
  './js/i18n/ru.bathroom.js',
  './js/i18n/ru.bedroom.js',
  './js/i18n/ru.js',
  './js/i18n/ru.kitchen.js',
  './js/i18n/ru.leisure.js',
  './js/scene/badges.js',
  './js/scene/character.js',
  './js/scene/hit-layer.js',
  './js/scene/stage.js',
  './js/scene/art/bathroom.js',
  './js/scene/art/bedroom.js',
  './js/scene/art/common.js',
  './js/scene/art/entertainment.js',
  './js/scene/art/index.js',
  './js/scene/art/kitchen.js',
  './js/scene/art/town.js',
  './js/ui/alarm-overlay.js',
  './js/ui/app.js',
  './js/ui/bars.js',
  './js/ui/controls.js',
  './js/ui/dialog.js',
  './js/ui/hooks.js',
  './js/ui/icons.js',
  './js/ui/lib.js',
  './js/ui/money.js',
  './js/ui/navigation.js',
  './js/ui/next-task-strip.js',
  './js/ui/nightstand.js',
  './js/ui/onboarding.js',
  './js/ui/room-tour.js',
  './js/ui/save-status.js',
  './js/ui/sheet.js',
  './js/ui/toast.js',
  './js/ui/ui-state.js',
  './js/world/locations.js',
  './js/world/objects.js',
  './js/world/types.js',
  './js/world/rooms/bathroom.js',
  './js/world/rooms/bedroom.js',
  './js/world/rooms/entertainment.js',
  './js/world/rooms/kitchen.js',
  './js/world/rooms/town.js',
  './icons/apple-touch-icon-180.png',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];
// </assets>

// Content-hashed and versioned files: cache-first. Generated by tools/hash_assets.py — do not edit by hand.
// <immutable-assets>
const IMMUTABLE_ASSETS = [
  './js/vendor/htm-preact-standalone-3.1.1.mjs',
];
// </immutable-assets>

const scoped = (path) => new URL(path, self.registration.scope).href;
const isImmutable = (url) => /\.[0-9a-f]{8}\.[a-z0-9]+$/.test(url.pathname) || url.pathname.includes('/js/vendor/');

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const code = await caches.open(CACHE);
      await code.addAll(ASSETS.map((path) => new Request(path, { cache: 'reload' })));
      const immutable = await caches.open(IMMUTABLE_CACHE);
      for (const path of IMMUTABLE_ASSETS) {
        if (!(await immutable.match(scoped(path)))) await immutable.add(path);
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('organized-life-') && key !== CACHE && key !== IMMUTABLE_CACHE) await caches.delete(key);
      }
      const immutable = await caches.open(IMMUTABLE_CACHE);
      const keep = new Set(IMMUTABLE_ASSETS.map(scoped));
      for (const request of await immutable.keys()) {
        if (!keep.has(request.url)) await immutable.delete(request);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(isImmutable(url) ? cacheFirst(request) : networkFirst(request));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await caches.match(scoped('./index.html'));
      if (shell) return shell;
    }
    return Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(IMMUTABLE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}
