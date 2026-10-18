// @ts-check
// Placeholder bathroom art, portrait (docs/spec/rooms/bathroom.md §1). Safe-zone pixel coordinates (1080 × 1620).

import { html } from '../../ui/lib.js';
import { visualStateFor } from '../badges.js';

const INK = '#2B2420';
const SW = 6;

/** @param {import('../../world/locations.js').Location} loc */
export function bathroomArt(loc) {
  const mirror = visualStateFor('bathroom.mirror-sink');
  const shower = visualStateFor('bathroom.bath-shower');
  const machine = visualStateFor('bathroom.washing-machine');
  const basket = visualStateFor('bathroom.laundry-basket');
  const floorY = Math.round(loc.floorLine * 1620);
  const heap = basket === 'full' ? 3 : basket === 'some' ? 2 : 0;

  return html`
    <rect x="-180" y="-150" width="1440" height=${floorY + 150} fill=${loc.wall} />
    <!-- wall tiles below the mid line -->
    <rect x="-180" y="620" width="1440" height=${floorY - 620} fill="#E8EFEE" />
    <g stroke=${INK} stroke-opacity="0.07" stroke-width="3">
      ${Array.from({ length: 18 }, (_, i) => html`<line x1=${-180 + i * 80} y1="620" x2=${-180 + i * 80} y2=${floorY} />`)}
      ${Array.from({ length: 5 }, (_, i) => html`<line x1="-180" y1=${620 + i * 80} x2="1260" y2=${620 + i * 80} />`)}
    </g>
    <rect x="-180" y=${floorY} width="1440" height=${1770 - floorY} fill=${loc.floor} />
    <g stroke=${INK} stroke-opacity="0.09" stroke-width="3">
      ${Array.from({ length: 12 }, (_, i) => html`<line x1=${-180 + i * 130} y1=${floorY} x2=${-180 + i * 130} y2="1770" />`)}
      ${Array.from({ length: 7 }, (_, i) => html`<line x1="-180" y1=${floorY + 40 + i * 120} x2="1260" y2=${floorY + 40 + i * 120} />`)}
    </g>

    <!-- small window -->
    <g>
      <rect x="929" y="97" width="108" height="195" rx="10" fill="#DCE7E8" stroke=${INK} stroke-width=${SW} />
      <path d="M983 97v195" stroke=${INK} stroke-width="4" />
    </g>

    <!-- towel rail -->
    <g>
      <path d="M518 530h195" stroke="#9AA3A5" stroke-width="10" stroke-linecap="round" />
      <path d="M545 530h90v120c-30 10-60 10-90 0z" fill="#A8D5BA" stroke=${INK} stroke-width="5" stroke-linejoin="round" />
      <path d="M545 610h90" stroke="#FFFFFF" stroke-opacity="0.7" stroke-width="8" />
    </g>

    <!-- BA1 mirror and sink -->
    <g id="obj-bathroom.mirror-sink" data-state=${mirror}>
      <rect x="90" y="110" width="340" height="320" rx="160" fill="#CFE0E3" stroke=${INK} stroke-width=${SW} />
      <path d="M150 180c40-40 90-50 130-40" stroke="#FFFFFF" stroke-opacity="0.8" stroke-width="12" stroke-linecap="round" fill="none" />
      ${mirror === 'fogged'
        ? html`<rect x="96" y="116" width="328" height="308" rx="154" fill="#FFFFFF" opacity="0.55" />
            <path d="M190 300c20-20 50-20 70 0" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round" fill="none" opacity="0.8" />`
        : html`<g fill="#F3D27A" stroke=${INK} stroke-width="3">
            <path d="M370 170l8 20 20 8-20 8-8 20-8-20-20-8 20-8z" /><path d="M140 340l6 14 14 6-14 6-6 14-6-14-14-6 14-6z" />
          </g>`}
      <rect x="70" y="470" width="380" height="52" rx="18" fill="#FFFFFF" stroke=${INK} stroke-width=${SW} />
      <ellipse cx="260" cy="482" rx="110" ry="14" fill="#DCE7E8" stroke=${INK} stroke-width="4" />
      <path d="M260 470v-40h40" fill="none" stroke="#9AA3A5" stroke-width="10" stroke-linecap="round" />
      <rect x="95" y="522" width="330" height="250" rx="10" fill="#B9C8D3" stroke=${INK} stroke-width=${SW} />
      <path d="M260 522v250" stroke=${INK} stroke-width="4" />
      <rect x="230" y="620" width="8" height="50" rx="4" fill="#F3D27A" /><rect x="282" y="620" width="8" height="50" rx="4" fill="#F3D27A" />
      <rect x="110" y="430" width="34" height="40" rx="8" fill="#E8B4B8" stroke=${INK} stroke-width="4" />
      <rect x="380" y="438" width="20" height="32" rx="6" fill="#A7C7E7" stroke=${INK} stroke-width="4" />
    </g>

    <!-- BA2 cabinet -->
    <g id="obj-bathroom.cabinet">
      <rect x="562" y="113" width="324" height="292" rx="12" fill="#F7F3EC" stroke=${INK} stroke-width=${SW} />
      <path d="M724 113v292" stroke=${INK} stroke-width="5" />
      <rect x="700" y="230" width="8" height="50" rx="4" fill="#F3D27A" stroke=${INK} stroke-width="3" />
      <rect x="740" y="230" width="8" height="50" rx="4" fill="#F3D27A" stroke=${INK} stroke-width="3" />
      <path d="M582 133h120v252H582z" fill="#DCE7E8" opacity="0.6" />
      <path d="M520 405h408" stroke=${INK} stroke-width="5" />
      ${[[590, '#E79AB0'], [630, '#A8D5BA'], [800, '#A7C7E7'], [840, '#F3D27A']].map(([x, c]) => html`<rect x=${x} y="365" width="28" height="40" rx="6" fill=${c} stroke=${INK} stroke-width="4" />`)}
    </g>

    <!-- BA4 washing machine -->
    <g id="obj-bathroom.washing-machine" data-state=${machine}>
      <ellipse cx="902" cy="1140" rx="150" ry="12" fill=${INK} opacity="0.12" />
      <rect x="760" y="716" width="284" height="418" rx="22" fill="#FFFFFF" stroke=${INK} stroke-width=${SW} />
      <path d="M760 800h284" stroke=${INK} stroke-width="5" />
      <rect x="784" y="736" width="90" height="40" rx="8" fill="#DCE7E8" stroke=${INK} stroke-width="4" />
      <circle cx="980" cy="756" r="16" fill="#E8E2D6" stroke=${INK} stroke-width="4" />
      <circle cx="928" cy="756" r="8" fill=${machine === 'done' ? '#4F8A5B' : machine === 'running' ? '#E8C24A' : '#C9C3B8'} />
      <circle cx="902" cy="960" r="118" fill="#E8E2D6" stroke=${INK} stroke-width=${SW} />
      <circle cx="902" cy="960" r="88" fill=${machine === 'running' ? '#7FA9D6' : '#CFE0E3'} stroke=${INK} stroke-width="5" />
      ${machine === 'running' &&
      html`<g class="drum-spin"><path d="M840 960a62 62 0 0 1 124 0" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" opacity="0.8" />
        <circle cx="880" cy="990" r="10" fill="#FFFFFF" opacity="0.8" /><circle cx="930" cy="940" r="7" fill="#FFFFFF" opacity="0.8" /></g>`}
      ${machine === 'done' && html`<path d="M870 960l24 24 42-48" fill="none" stroke="#4F8A5B" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" />`}
    </g>

    <!-- BA5 laundry basket -->
    <g id="obj-bathroom.laundry-basket" data-state=${basket}>
      <ellipse cx="621" cy="1120" rx="88" ry="10" fill=${INK} opacity="0.12" />
      ${heap >= 1 && html`<path d="M560 950c20-40 110-40 122 0" fill="#E79AB0" stroke=${INK} stroke-width="4" />`}
      ${heap >= 2 && html`<path d="M552 930c30-50 70-30 80 0M600 940c20-50 80-40 84 4" fill="#4A78B5" stroke=${INK} stroke-width="4" />`}
      ${heap >= 3 && html`<path d="M572 900c20-40 80-50 100-4" fill="#E8C24A" stroke=${INK} stroke-width="4" /><path d="M640 890l30-40" stroke=${INK} stroke-width="8" stroke-linecap="round" />`}
      <path d="M548 950h146l-16 168H564z" fill="#D9B48C" stroke=${INK} stroke-width=${SW} stroke-linejoin="round" />
      <g stroke=${INK} stroke-opacity="0.35" stroke-width="3">
        <path d="M556 990h130M560 1030h122M563 1070h116" />
      </g>
    </g>

    <!-- BA3 bath / shower -->
    <g id="obj-bathroom.bath-shower" data-state=${shower}>
      <path d="M120 1010V1180" stroke="#9AA3A5" stroke-width="10" />
      <path d="M120 1010h60" stroke="#9AA3A5" stroke-width="10" stroke-linecap="round" />
      <path d="M170 1000h40l-8 24h-24z" fill="#C9D3D6" stroke=${INK} stroke-width="4" />
      <path d="M40 1100H520" stroke="#9AA3A5" stroke-width="8" stroke-linecap="round" />
      ${shower === 'closed'
        ? html`<path d="M50 1100h460v110c-40 14-80-6-115 0s-80 14-115 0-80-6-115 0-80 14-115 0z" fill="#A7C7E7" stroke=${INK} stroke-width="5" opacity="0.92" />`
        : html`<path d="M50 1100h70v110c-24 10-48 6-70 0z" fill="#A7C7E7" stroke=${INK} stroke-width="5" />`}
      <path d="M50 1220h680c0 130-80 200-180 200H230c-100 0-180-70-180-200z" fill="#FFFFFF" stroke=${INK} stroke-width=${SW} stroke-linejoin="round" />
      <rect x="40" y="1200" width="700" height="34" rx="16" fill="#F7F3EC" stroke=${INK} stroke-width=${SW} />
      <path d="M160 1420v40M620 1420v40" stroke=${INK} stroke-width="10" stroke-linecap="round" />
      ${shower === 'steam' &&
      html`<g fill="none" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round" opacity="0.85">
        <path d="M250 1180c-30-40 30-60 0-110" /><path d="M380 1170c-30-40 30-60 0-110" /><path d="M510 1180c-30-40 30-60 0-110" />
      </g>`}
      <rect x="760" y="1450" width="200" height="40" rx="14" fill="#E8B4B8" stroke=${INK} stroke-width="4" opacity="0.9" />
    </g>

    <!-- plant on the machine -->
    <g transform="translate(-60 86)">
      <rect x="990" y="560" width="60" height="70" rx="8" fill="#C99A50" stroke=${INK} stroke-width="5" />
      <path d="M1020 560c-30-40-20-80 0-90 20 10 30 50 0 90zM1020 560c10-40 40-50 50-40-6 20-30 40-50 40z" fill="#7FB07A" stroke=${INK} stroke-width="4" />
    </g>
  `;
}
