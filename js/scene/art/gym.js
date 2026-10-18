// @ts-check
// Placeholder gym art, portrait (docs/spec/rooms/gym.md §1). Safe-zone pixel coordinates (1080 × 1620).

import { html } from '../../ui/lib.js';
import { visualStateFor } from '../badges.js';

const INK = '#2B2420';
const SW = 6;

/** @param {import('../../world/locations.js').Location} loc */
export function gymArt(loc) {
  const bench = visualStateFor('gym.bench-mat');
  const bars = visualStateFor('gym.progress-board').split(',').map(Number).filter((n) => !Number.isNaN(n));
  const floorY = Math.round(loc.floorLine * 1620);

  return html`
    <rect x="-180" y="-150" width="1440" height=${floorY + 150} fill=${loc.wall} />
    <rect x="-180" y=${floorY} width="1440" height=${1770 - floorY} fill=${loc.floor} />
    <g fill=${INK} opacity="0.06">${Array.from({ length: 60 }, (_, i) => html`<circle cx=${-160 + (i % 12) * 120} cy=${floorY + 50 + Math.floor(i / 12) * 140} r="6" />`)}</g>
    <rect x="-180" y=${floorY - 6} width="1440" height="12" fill=${INK} opacity="0.08" />

    <!-- window -->
    <g>
      <rect x="65" y="97" width="281" height="259" rx="14" fill="#DCE7E8" stroke=${INK} stroke-width=${SW} />
      <path d="M205 97v259M65 226h281" stroke=${INK} stroke-width=${SW} />
    </g>

    <!-- G3 progress board -->
    <g id="obj-gym.progress-board">
      <rect x="414" y="100" width="598" height="318" rx="12" fill="#2E3B33" stroke=${INK} stroke-width=${SW} />
      <rect x="430" y="116" width="566" height="286" rx="6" fill="#36483D" />
      <path d="M460 360h300" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="3" />
      ${(bars.length ? bars : [0, 0, 0, 0, 0, 0]).map((n, i) => html`<rect x=${470 + i * 48} y=${360 - Math.max(6, n * 40)} width="30" height=${Math.max(6, n * 40)} rx="3" fill="#A8D5BA" />`)}
      <path d="M800 170l40 40 60-70" fill="none" stroke="#F3D27A" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M800 260h150M800 300h110M800 340h130" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="6" stroke-linecap="round" />
    </g>

    <!-- wall mirror (decor) -->
    <g>
      <rect x="65" y="551" width="561" height="291" rx="10" fill="#CFE0E3" stroke=${INK} stroke-width=${SW} />
      <path d="M130 600l120 200M260 600l90 160" stroke="#FFFFFF" stroke-opacity="0.6" stroke-width="14" stroke-linecap="round" />
    </g>

    <!-- G2 weights rack -->
    <g id="obj-gym.weights">
      <rect x="724" y="626" width="300" height="470" rx="12" fill="#9AA3A5" stroke=${INK} stroke-width=${SW} />
      ${[0, 1, 2].map((r) => html`<path d=${`M744 ${730 + r * 140}h260`} stroke=${INK} stroke-width="8" stroke-linecap="round" />
        ${[0, 1, 2].map((i) => html`<g transform=${`translate(${790 + i * 80} ${700 + r * 140})`}>
          <rect x="-28" y="-6" width="56" height="12" rx="4" fill="#5A5550" />
          <rect x="-40" y="-20" width="16" height="40" rx="5" fill=${['#B83C48', '#4A78B5', '#2E2B2A'][r]} stroke=${INK} stroke-width="3" />
          <rect x="24" y="-20" width="16" height="40" rx="5" fill=${['#B83C48', '#4A78B5', '#2E2B2A'][r]} stroke=${INK} stroke-width="3" />
        </g>`)}`)}
    </g>

    <!-- kettlebell, bottle -->
    <g>
      <path d="M640 1150c-40 0-50 60-10 70h60c40-10 30-70-10-70" fill="#2E2B2A" stroke=${INK} stroke-width="5" />
      <path d="M635 1150c0-30 30-30 30 0" fill="none" stroke=${INK} stroke-width="8" />
      <rect x="560" y="1110" width="34" height="90" rx="10" fill="#A7C7E7" stroke=${INK} stroke-width="5" />
    </g>

    <!-- G1 bench + mat -->
    <g id="obj-gym.bench-mat" data-state=${bench}>
      <rect x="70" y="1380" width="680" height="70" rx="14" fill="#7FA9D6" stroke=${INK} stroke-width=${SW} />
      <rect x="140" y="1230" width="440" height="56" rx="16" fill="#3A3330" stroke=${INK} stroke-width=${SW} />
      <path d="M190 1286v100M530 1286v100" stroke=${INK} stroke-width="14" stroke-linecap="round" />
      ${bench === 'done' && html`<g><path d="M600 1350h130v60H600z" fill="#FFFFFF" stroke=${INK} stroke-width="4" transform="rotate(-6 665 1380)" />
        <path d="M630 1380l20 18 40-40" fill="none" stroke="#4F8A5B" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" /></g>`}
      ${bench === 'session' && html`<rect x="300" y="1200" width="200" height="12" rx="6" fill="#F3D27A" />`}
    </g>
  `;
}
