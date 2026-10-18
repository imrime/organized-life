// @ts-check
// Room tour on the first visit to each location (docs/spec/03-ux-shell.md §4.4).

import { html, useEffect, useLayoutEffect, useRef, useState } from './lib.js';
import { getUi, setUi, useUi } from './ui-state.js';
import { t } from '../core/i18n.js';
import { appStore } from '../core/store.js';
import { PROFILE } from '../core/schema.js';
import { objectsInRoom, readingOrder } from '../world/objects.js';
import { windows } from '../windows.js';
import { updateSettings } from '../features/settings/actions.js';

/** @typedef {{ selector: string|null, title: string, text: string, note?: string }} TourStep */

const SHELL_STEPS = [
  { selector: '.location-button', key: 'map' },
  { selector: '.bar-button.left', key: 'objects' },
  { selector: '.fab', key: 'quick' },
  { selector: '.bar-button.right', key: 'me' },
];

/**
 * @param {string} locationId
 * @returns {TourStep[]}
 */
export function tourSteps(locationId) {
  /** @type {TourStep[]} */
  const steps = readingOrder(objectsInRoom(locationId)).map((obj) => ({
    selector: `.hit[data-object="${obj.id}"]`,
    title: t(obj.labelKey),
    text: t(obj.descriptionKey),
    note: windows[obj.window] ? undefined : t('common.comingSoon'),
  }));
  if (locationId === 'bedroom') {
    for (const s of SHELL_STEPS) steps.push({ selector: s.selector, title: t(`tour.shell.${s.key}.name`), text: t(`tour.shell.${s.key}.desc`) });
  }
  steps.push({ selector: null, title: t('tour.finalTitle', { room: t(`locations.${locationId}.name`) }), text: t('tour.finalText') });
  return steps;
}

/** Starts the tour for the current location if it hasn't been seen and nothing else is in front. */
export function maybeStartTour() {
  const ui = getUi();
  if (ui.tour || ui.sheet || ui.nightstand || ui.dialog || ui.ringing?.length) return;
  const settings = appStore.profile(PROFILE.settings);
  if (!settings?.onboarding?.done) return;
  const seen = /** @type {string[]} */ (settings?.toursSeen ?? []);
  if (seen.includes(ui.locationId)) return;
  if (!objectsInRoom(ui.locationId).length) return;
  setUi({ tour: { locationId: ui.locationId, step: 0 } });
}

/** Replays a location's tour (Objects list "Tour" button). */
/** @param {string} locationId */
export function replayTour(locationId) {
  setUi({ tour: { locationId, step: 0 } });
}

async function finishTour() {
  const tour = getUi().tour;
  setUi({ tour: null });
  if (!tour) return;
  const seen = /** @type {string[]} */ (appStore.profile(PROFILE.settings)?.toursSeen ?? []);
  if (!seen.includes(tour.locationId)) await updateSettings({ toursSeen: [...seen, tour.locationId] });
}

/** @param {number} step */
function goTo(step) {
  const tour = getUi().tour;
  if (tour) setUi({ tour: { ...tour, step } });
}

export function RoomTour() {
  const { tour, locationId } = useUi();
  if (!tour || tour.locationId !== locationId) return null;
  return html`<${TourOverlay} key=${tour.locationId} tour=${tour} />`;
}

/** @param {{ tour: { locationId: string, step: number } }} props */
function TourOverlay({ tour }) {
  const steps = tourSteps(tour.locationId);
  const step = steps[Math.min(tour.step, steps.length - 1)];
  const last = tour.step >= steps.length - 1;
  /** @type {{ current: HTMLDivElement|null }} */
  const rootRef = useRef(null);
  /** @type {{ current: HTMLDivElement|null }} */
  const cardRef = useRef(null);
  const [rect, setRect] = useState(/** @type {{ left: number, top: number, width: number, height: number }|null} */ (null));
  const [cardTop, setCardTop] = useState(/** @type {number|null} */ (null));

  useLayoutEffect(() => {
    const measure = () => {
      const app = rootRef.current?.parentElement;
      const target = step.selector ? /** @type {HTMLElement|null} */ (document.querySelector(step.selector)) : null;
      if (!app || !target) {
        setRect(null);
        return;
      }
      const a = app.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      const pad = 10;
      setRect({ left: r.left - a.left - pad, top: r.top - a.top - pad, width: r.width + pad * 2, height: r.height + pad * 2 });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [tour.step, tour.locationId]);

  // Place the card below the spotlight when it fits, otherwise above.
  useLayoutEffect(() => {
    const app = rootRef.current;
    const card = cardRef.current;
    if (!app || !card) return;
    const height = card.offsetHeight;
    const appHeight = app.offsetHeight;
    if (!rect) {
      setCardTop(Math.max(16, (appHeight - height) / 2));
      return;
    }
    const below = rect.top + rect.height + 14;
    const above = rect.top - 14 - height;
    setCardTop(below + height < appHeight - 12 ? below : Math.max(12, above));
  }, [rect, tour.step]);

  useEffect(() => {
    cardRef.current?.focus();
    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      if (e.key === 'Escape') finishTour();
      if (e.key === 'ArrowRight') last ? finishTour() : goTo(tour.step + 1);
      if (e.key === 'ArrowLeft' && tour.step > 0) goTo(tour.step - 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tour.step]);

  const next = () => (last ? finishTour() : goTo(tour.step + 1));

  return html`<div class="tour" ref=${rootRef}>
    ${rect
      ? html`<button
          type="button"
          class="tour-spot"
          style=${`left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`}
          aria-label=${t('tour.next')}
          onClick=${next}
        ></button>`
      : html`<div class="tour-dim"></div>`}
    <div
      class="tour-card"
      ref=${cardRef}
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-labelledby="tour-title"
      tabindex="-1"
      style=${cardTop === null ? 'visibility:hidden' : `top:${cardTop}px`}
    >
      <div class="tour-head">
        <h2 id="tour-title">${step.title}</h2>
        <span class="tour-count">${t('tour.count', { n: tour.step + 1, total: steps.length })}</span>
      </div>
      <p>${step.text}</p>
      ${step.note && html`<p class="tour-note">${step.note}</p>`}
      <div class="tour-actions">
        ${!last && html`<button type="button" class="btn btn-ghost" onClick=${finishTour}>${t('tour.skip')}</button>`}
        <span class="grow"></span>
        ${tour.step > 0 && html`<button type="button" class="btn" onClick=${() => goTo(tour.step - 1)}>${t('tour.back')}</button>`}
        <button type="button" class="btn btn-primary" onClick=${next}>${last ? t('tour.gotIt') : t('tour.next')}</button>
      </div>
    </div>
  </div>`;
}
