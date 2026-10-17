// @ts-check
// App power modes. "nightstand" keeps the app open overnight with minimal work so in-game alarms can ring
// (docs/spec/03-ux-shell.md §5.4).

import { bus } from './bus.js';
import { unlockAudio } from './sound.js';
import { setEngineMode } from './reminders.js';

/** @type {'normal'|'nightstand'} */
let mode = 'normal';
/** @type {any} WakeLockSentinel */
let wakeLock = null;

export function powerMode() {
  return mode;
}

export function wakeLockSupported() {
  return 'wakeLock' in navigator;
}

async function acquireWakeLock() {
  if (!wakeLockSupported() || document.visibilityState !== 'visible') return false;
  try {
    wakeLock = await /** @type {any} */ (navigator).wakeLock.request('screen');
    wakeLock.addEventListener?.('release', () => {
      wakeLock = null;
    });
    return true;
  } catch {
    return false;
  }
}

function onVisibility() {
  if (mode === 'nightstand' && document.visibilityState === 'visible' && !wakeLock) acquireWakeLock();
}

/**
 * Resolves with the promise's value, or `fallback` if it takes longer than `ms` (e.g. audio resume without a gesture).
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {T} fallback
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, fallback) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

/**
 * Must be called from a user gesture (tap): unlocks audio and requests a screen wake lock.
 * @returns {Promise<{ wakeLock: boolean }>}
 */
export async function enterNightstand() {
  const [locked] = await Promise.all([withTimeout(acquireWakeLock(), 1500, false), withTimeout(unlockAudio(), 800, false)]);
  mode = 'nightstand';
  document.addEventListener('visibilitychange', onVisibility);
  setEngineMode('nightstand');
  bus.emit('power-mode', mode);
  return { wakeLock: locked };
}

export async function exitNightstand() {
  mode = 'normal';
  document.removeEventListener('visibilitychange', onVisibility);
  try {
    await wakeLock?.release();
  } catch {
    // already released
  }
  wakeLock = null;
  setEngineMode('normal');
  bus.emit('power-mode', mode);
}

/**
 * Charging state where the Battery Status API exists (Chrome/Android); null elsewhere (iOS).
 * @param {(charging: boolean) => void} onChange
 * @returns {Promise<(() => void)|null>} unsubscribe
 */
export async function watchCharging(onChange) {
  const getBattery = /** @type {any} */ (navigator).getBattery;
  if (typeof getBattery !== 'function') return null;
  try {
    const battery = await getBattery.call(navigator);
    const handler = () => onChange(Boolean(battery.charging));
    handler();
    battery.addEventListener('chargingchange', handler);
    return () => battery.removeEventListener('chargingchange', handler);
  } catch {
    return null;
  }
}
