// @ts-check
// Placeholder kitchen art, portrait (docs/spec/rooms/kitchen.md §1). Safe-zone pixel coordinates (1080 × 1620).

import { html } from '../../ui/lib.js';
import { bareRoom } from './common.js';
import { visualStateFor } from '../badges.js';

const INK = '#2B2420';
const SW = 6;

/** @param {import('../../world/locations.js').Location} loc */
export function kitchenArt(loc) {
  const board = visualStateFor('kitchen.shopping-board');
  const plates = Number(visualStateFor('kitchen.dining-table').replace('plates-', '')) || 0;
  const fridge = visualStateFor('kitchen.refrigerator');
  const notes = board === 'many' ? 5 : board === 'few' ? 2 : 0;
  const noteColors = ['#F3D27A', '#F5B88A', '#A8D5BA', '#A7C7E7', '#E8B4B8'];

  return html`
    ${bareRoom(loc)}
    <!-- tiles behind the counter -->
    <rect x="43" y="660" width="648" height="56" fill="#F3F1EA" opacity="0.7" />
    <g stroke=${INK} stroke-opacity="0.12" stroke-width="2">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => html`<line x1=${43 + i * 72} y1="660" x2=${43 + i * 72} y2="716" />`)}</g>

    <!-- window -->
    <g>
      <rect x="65" y="97" width="302" height="292" rx="14" fill="#DCE7E8" stroke=${INK} stroke-width=${SW} />
      <path d="M216 97V389M65 243H367" stroke=${INK} stroke-width=${SW} />
      <rect x="45" y="389" width="342" height="22" rx="6" fill="#F3EDE6" stroke=${INK} stroke-width=${SW} />
      <path d="M100 389c0-30 20-40 30-40s30 10 30 40" fill="#7FB07A" stroke=${INK} stroke-width="4" />
    </g>

    <!-- K3 shopping board -->
    <g id="obj-kitchen.shopping-board" data-state=${board}>
      <rect x="432" y="97" width="389" height="292" rx="12" fill="#D9B48C" stroke=${INK} stroke-width=${SW} />
      <rect x="452" y="117" width="349" height="252" rx="6" fill="#E3C49F" />
      ${Array.from({ length: notes }, (_, i) => html`<g transform=${`rotate(${(i % 2 ? 4 : -5)} ${500 + (i % 3) * 110} ${170 + Math.floor(i / 3) * 110})`}>
        <rect x=${460 + (i % 3) * 110} y=${130 + Math.floor(i / 3) * 110} width="86" height="86" fill=${noteColors[i]} stroke=${INK} stroke-width="3" />
        <circle cx=${503 + (i % 3) * 110} cy=${138 + Math.floor(i / 3) * 110} r="6" fill="#B83C48" />
        <path d=${`M${474 + (i % 3) * 110} ${170 + Math.floor(i / 3) * 110}h56M${474 + (i % 3) * 110} ${188 + Math.floor(i / 3) * 110}h40`} stroke=${INK} stroke-opacity="0.4" stroke-width="4" />
      </g>`)}
    </g>

    <!-- shelf with K2 recipe book -->
    <rect x="65" y="632" width="324" height="20" rx="4" fill="#9C775B" stroke=${INK} stroke-width="5" />
    <g id="obj-kitchen.recipe-book">
      <rect x="96" y="520" width="150" height="112" rx="6" fill="#B83C48" stroke=${INK} stroke-width=${SW} />
      <rect x="112" y="540" width="118" height="30" rx="4" fill="#F8F6F1" opacity="0.85" />
      <path d="M232 520v112" stroke=${INK} stroke-width="4" />
      <rect x="258" y="548" width="34" height="84" rx="4" fill="#A7C7E7" stroke=${INK} stroke-width="5" />
      <rect x="296" y="560" width="30" height="72" rx="4" fill="#F3D27A" stroke=${INK} stroke-width="5" />
    </g>

    <!-- counter top with stove and sink -->
    <rect x="43" y="713" width="648" height="40" rx="6" fill="#E8E2D6" stroke=${INK} stroke-width=${SW} />
    <rect x="90" y="690" width="200" height="26" rx="6" fill="#3A3330" stroke=${INK} stroke-width="5" />
    <circle cx="140" cy="703" r="9" fill="#6B625B" /><circle cx="240" cy="703" r="9" fill="#6B625B" />
    <rect x="420" y="700" width="170" height="16" rx="6" fill="#C9D3D6" stroke=${INK} stroke-width="4" />
    <path d="M560 700v-46h-30" fill="none" stroke=${INK} stroke-width="6" stroke-linecap="round" />
    <rect x="43" y="753" width="648" height="90" fill="#B9C8B6" stroke=${INK} stroke-width=${SW} />

    <!-- K5 kitchen cabinets -->
    <g id="obj-kitchen.cabinets">
      <rect x="43" y="842" width="648" height="227" rx="6" fill="#9DB09A" stroke=${INK} stroke-width=${SW} />
      ${[0, 1, 2, 3].map((i) => html`<rect x=${60 + i * 158} y="860" width="140" height="190" rx="6" fill="#B3C4B0" stroke=${INK} stroke-width="4" />
        <rect x=${i % 2 ? 72 + i * 158 : 182 + i * 158} y="930" width="8" height="48" rx="4" fill="#F3D27A" stroke=${INK} stroke-width="3" />`)}
    </g>

    <!-- K1 refrigerator -->
    <g id="obj-kitchen.refrigerator" data-state=${fridge}>
      <ellipse cx="902" cy="1172" rx="150" ry="14" fill=${INK} opacity="0.12" />
      <rect x="756" y="486" width="292" height="680" rx="22" fill="#FFFFFF" stroke=${INK} stroke-width=${SW} />
      <path d="M756 720H1048" stroke=${INK} stroke-width=${SW} />
      <rect x="780" y="560" width="14" height="120" rx="7" fill="#C9D3D6" stroke=${INK} stroke-width="3" />
      <rect x="780" y="760" width="14" height="200" rx="7" fill="#C9D3D6" stroke=${INK} stroke-width="3" />
      <circle cx="960" cy="800" r="16" fill="#B83C48" /><rect x="930" y="840" width="54" height="40" rx="4" fill="#F3D27A" transform="rotate(6 957 860)" />
      ${fridge === 'empty' && html`<rect x="836" y="1080" width="160" height="12" rx="6" fill="#A7C7E7" opacity="0.6" />`}
    </g>

    <!-- K4 dining table with chairs -->
    <g id="obj-kitchen.dining-table" data-state=${`plates-${plates}`}>
      <rect x="180" y="1170" width="70" height="200" rx="10" fill="#C99A50" stroke=${INK} stroke-width="5" />
      <rect x="660" y="1170" width="70" height="200" rx="10" fill="#C99A50" stroke=${INK} stroke-width="5" />
      <ellipse cx="453" cy="1520" rx="310" ry="18" fill=${INK} opacity="0.12" />
      <rect x="190" y="1300" width="20" height="210" fill="#8E6A50" stroke=${INK} stroke-width="5" />
      <rect x="696" y="1300" width="20" height="210" fill="#8E6A50" stroke=${INK} stroke-width="5" />
      <rect x="151" y="1256" width="605" height="50" rx="16" fill="#A98263" stroke=${INK} stroke-width=${SW} />
      ${[0, 1, 2].slice(0, plates).map((i) => html`<ellipse cx=${300 + i * 160} cy="1250" rx="54" ry="16" fill="#FFFFFF" stroke=${INK} stroke-width="4" />
        <ellipse cx=${300 + i * 160} cy="1246" rx="28" ry="8" fill="#F5B88A" />`)}
      ${!plates && html`<ellipse cx="453" cy="1246" rx="60" ry="18" fill="#F8F6F1" stroke=${INK} stroke-width="4" />
        <circle cx="430" cy="1228" r="16" fill="#C4413E" stroke=${INK} stroke-width="3" /><circle cx="462" cy="1224" r="16" fill="#E8C24A" stroke=${INK} stroke-width="3" /><circle cx="490" cy="1230" r="14" fill="#7FB07A" stroke=${INK} stroke-width="3" />`}
    </g>
  `;
}
