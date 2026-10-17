// @ts-check
// Root component: portrait column with bars, stage and overlay hosts.

import { html, useEffect, useState } from './lib.js';
import { useUi } from './ui-state.js';
import { useProfile } from './hooks.js';
import { PROFILE } from '../core/schema.js';
import { setLanguage, setTimeFormat } from '../core/i18n.js';
import { TopBar, BottomBar } from './bars.js';
import { NextTaskStrip } from './next-task-strip.js';
import { Stage } from '../scene/stage.js';
import { SheetHost } from './sheet.js';
import { Toasts } from './toast.js';
import { DialogHost } from './dialog.js';
import { AlarmOverlay } from './alarm-overlay.js';
import { Nightstand } from './nightstand.js';
import { RoomTour, maybeStartTour } from './room-tour.js';

const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

/** Applies language, time format, text size and motion preference from settings. */
function useDisplaySettings(/** @type {Record<string, any>} */ settings) {
  // Language must be set before children render so t() resolves correctly.
  setLanguage(settings.language ?? 'en');
  setTimeFormat(settings.timeFormat ?? '24h');
  const [systemReduce, setSystemReduce] = useState(Boolean(motionQuery?.matches));

  useEffect(() => {
    if (!motionQuery) return undefined;
    const onChange = () => setSystemReduce(motionQuery.matches);
    motionQuery.addEventListener('change', onChange);
    return () => motionQuery.removeEventListener('change', onChange);
  }, []);

  const reduce = settings.reduceMotion === 'on' || (settings.reduceMotion !== 'off' && systemReduce);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.textSize = settings.textSize ?? 'M';
    root.dataset.motion = reduce ? 'reduce' : 'full';
  }, [settings.textSize, reduce]);
}

export function App() {
  const settings = useProfile(PROFILE.settings);
  useDisplaySettings(settings);
  const { locationId, sheet, dialog, nightstand, tour, ringing } = useUi();
  const blocked = Boolean(sheet || dialog || tour || ringing?.length);

  // First visit to a location runs its room tour (after the travel banner).
  useEffect(() => {
    const timer = setTimeout(maybeStartTour, 650);
    return () => clearTimeout(timer);
  }, [locationId, Boolean(sheet), nightstand, (settings.toursSeen ?? []).length]);

  if (nightstand) {
    // Low-power mode: scene, bars and sheets are unmounted.
    return html`<div class="app night"><${Nightstand} /><${AlarmOverlay} /></div>`;
  }

  return html`<div class="app">
    <div class="app-main" inert=${blocked}>
      <${TopBar} locationId=${locationId} />
      <${NextTaskStrip} />
      <${Stage} locationId=${locationId} settings=${settings} />
      <${BottomBar} />
    </div>
    <${SheetHost} />
    <${RoomTour} />
    <${Toasts} />
    <${DialogHost} />
    <${AlarmOverlay} />
  </div>`;
}
