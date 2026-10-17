// @ts-check
// Nightstand mode: black screen, dim clock, minimal work (docs/spec/03-ux-shell.md §5.4).
// The scene, bars and sheets are unmounted while this is shown.

import { html, useEffect, useRef, useState } from './lib.js';
import { setUi } from './ui-state.js';
import { t, formatTime } from '../core/i18n.js';
import { nowTime } from '../core/time.js';
import { appStore } from '../core/store.js';
import { enterNightstand, exitNightstand, watchCharging } from '../core/power.js';
import { nextAlarm } from '../features/alarms/model.js';
import { toast } from './toast.js';
import { closeSheet } from './sheet.js';

/** Whether the last start obtained a screen wake lock (shown as a hint when it didn't). */
let wakeLockOk = true;

/** Starts Nightstand mode. Must be called from a tap (audio unlock + wake lock need a user gesture). */
export async function startNightstand() {
  const { wakeLock } = await enterNightstand();
  wakeLockOk = wakeLock;
  await closeSheet({ force: true });
  setUi({ nightstand: true });
  return wakeLock;
}

async function stopNightstand() {
  await exitNightstand();
  setUi({ nightstand: false });
  if (nextAlarm(/** @type {any} */ (appStore.all('alarms')), new Date())) toast(t('nightstand.exitWarning'));
}

export function Nightstand() {
  const [clock, setClock] = useState(nowTime());
  const [shift, setShift] = useState({ x: 0, y: 0 });
  const [charging, setCharging] = useState(/** @type {boolean|null} */ (null));
  const [noWakeLockHint, setNoWakeLockHint] = useState(!wakeLockOk);
  const lastTap = useRef(0);
  const pressTimer = useRef(/** @type {ReturnType<typeof setTimeout>|undefined} */ (undefined));

  // One wake-up per minute, aligned to the minute boundary.
  useEffect(() => {
    /** @type {ReturnType<typeof setTimeout>} */
    let timer;
    let minutes = 0;
    const tick = () => {
      setClock(nowTime());
      if (++minutes % 5 === 0) setShift({ x: Math.round(Math.random() * 24 - 12), y: Math.round(Math.random() * 24 - 12) });
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 20);
    };
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 20);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    /** @type {(() => void)|null} */
    let off = null;
    watchCharging(setCharging).then((unsubscribe) => {
      off = unsubscribe;
    });
    return () => off?.();
  }, []);

  const upcoming = nextAlarm(/** @type {any} */ (appStore.all('alarms')), new Date());

  const onPointerDown = () => {
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(stopNightstand, 800);
  };
  const onPointerUp = () => {
    clearTimeout(pressTimer.current);
    const now = Date.now();
    if (now - lastTap.current < 400) stopNightstand();
    lastTap.current = now;
  };

  return html`<div
    class="nightstand"
    role="dialog"
    aria-modal="true"
    aria-label=${t('nightstand.title')}
    onPointerDown=${onPointerDown}
    onPointerUp=${onPointerUp}
    onPointerCancel=${() => clearTimeout(pressTimer.current)}
  >
    <div class="nightstand-clock" style=${`transform: translate(${shift.x}px, ${shift.y}px)`}>
      <div class="nightstand-time">${formatTime(clock)}</div>
      <div class="nightstand-next">
        ${upcoming ? t('nightstand.nextAlarm', { time: formatTime(upcoming.alarm.time) }) : t('nightstand.noAlarm')}
      </div>
    </div>
    ${charging === false && html`<div class="nightstand-hint">🔌 ${t('nightstand.connectCharger')}</div>`}
    ${noWakeLockHint &&
    html`<div class="nightstand-card" onPointerDown=${(/** @type {Event} */ e) => e.stopPropagation()} onPointerUp=${(/** @type {Event} */ e) => e.stopPropagation()}>
      <p>${t('nightstand.noWakeLock')}</p>
      <button type="button" class="btn" onClick=${() => setNoWakeLockHint(false)}>${t('common.ok')}</button>
    </div>`}
    <div class="nightstand-exit">${t('nightstand.exitHint')}</div>
    <button type="button" class="visually-hidden" onClick=${stopNightstand}>${t('nightstand.exit')}</button>
  </div>`;
}
