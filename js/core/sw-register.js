// @ts-check
// Registers the service worker on https only; on localhost removes any worker and caches.

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (location.protocol === 'https:' && !isLocal) {
    await navigator.serviceWorker.register('./sw.js', { scope: './' });
    return;
  }
  // Development: never mix versions — drop any previously installed worker and its caches.
  for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister();
  if ('caches' in window) for (const key of await caches.keys()) await caches.delete(key);
}
