// @ts-check
// Placeholder town art, portrait (docs/spec/rooms/town.md §1). Safe-zone pixel coordinates (1080 × 1620).

import { html } from '../../ui/lib.js';

const INK = '#2B2420';
const SW = 6;

/** @param {{ x: number, y: number, w: number, h: number, awning: string, sign: any, id: string }} b */
function shop({ x, y, w, h, awning, sign, id }) {
  const stripes = Math.round(w / 60);
  return html`<g id=${`obj-${id}`}>
    <ellipse cx=${x + w / 2} cy=${y + h + 6} rx=${w / 2 + 10} ry="12" fill=${INK} opacity="0.12" />
    <rect x=${x} y=${y + 50} width=${w} height=${h - 50} fill="#FBF6EC" stroke=${INK} stroke-width=${SW} />
    <path d=${`M${x - 14} ${y + 50}h${w + 28}l-20-60H${x + 6}z`} fill=${awning} stroke=${INK} stroke-width=${SW} stroke-linejoin="round" />
    ${Array.from({ length: stripes }, (_, i) => html`<path d=${`M${x - 14 + i * ((w + 28) / stripes)} ${y + 50}h${(w + 28) / stripes / 2}`} stroke="#FFFFFF" stroke-opacity="0.6" stroke-width="10" />`)}
    <rect x=${x + 30} y=${y + 110} width=${w * 0.5} height=${h * 0.42} rx="8" fill="#DCE7E8" stroke=${INK} stroke-width="5" />
    <g transform=${`translate(${x + 30 + w * 0.25} ${y + 110 + h * 0.21})`}>${sign}</g>
    <rect x=${x + w * 0.66} y=${y + h * 0.42} width=${w * 0.24} height=${h * 0.58} rx="6" fill="#A98263" stroke=${INK} stroke-width="5" />
    <circle cx=${x + w * 0.7} cy=${y + h * 0.72} r="6" fill="#F3D27A" />
  </g>`;
}

export function townArt() {
  const apple = html`<circle cx="-30" cy="10" r="26" fill="#C4413E" stroke=${INK} stroke-width="4" /><circle cx="22" cy="14" r="22" fill="#E8C24A" stroke=${INK} stroke-width="4" /><path d="M-30-16c4-10 10-12 16-12" stroke=${INK} stroke-width="4" fill="none" />`;
  const shirt = html`<path d="M-36-30h72l20 22-16 14-8-8v52h-64v-52l-8 8-16-14z" fill="#4F8A5B" stroke=${INK} stroke-width="4" stroke-linejoin="round" />`;
  return html`
    <rect x="-180" y="-150" width="1440" height="733" fill="#DDE7E6" />
    <rect x="-180" y="583" width="1440" height="1187" fill="#C4B19A" />
    <rect x="-180" y="1160" width="1440" height="200" fill="#9C9488" />
    <path d="M-180 1260H1260" stroke="#F3EDE6" stroke-width="10" stroke-dasharray="60 50" />
    <rect x="-180" y="1150" width="1440" height="14" fill="#B5A58E" />
    <g fill="#FFFFFF" opacity="0.85"><ellipse cx="120" cy="40" rx="80" ry="28" /><ellipse cx="180" cy="20" rx="60" ry="30" /><ellipse cx="560" cy="60" rx="70" ry="24" /></g>

    <!-- T4 park -->
    <g id="obj-town.park">
      <ellipse cx="280" cy="460" rx="240" ry="90" fill="#9DC08B" stroke=${INK} stroke-width="5" />
      ${[[120, 330, 60], [230, 290, 72], [400, 320, 58]].map(([x, y, r]) => html`<rect x=${x - 8} y=${y + r - 20} width="16" height="70" fill="#8E6A50" stroke=${INK} stroke-width="4" />
        <circle cx=${x} cy=${y} r=${r} fill="#6FA368" stroke=${INK} stroke-width="5" />`)}
      <ellipse cx="300" cy="470" rx="60" ry="18" fill="#A7C7E7" stroke=${INK} stroke-width="4" />
      <path d="M300 470v-40" stroke="#A7C7E7" stroke-width="10" stroke-linecap="round" />
      <rect x="380" y="470" width="100" height="14" rx="4" fill="#A98263" stroke=${INK} stroke-width="4" />
    </g>

    <!-- T3 bank / ATM -->
    <g id="obj-town.bank-atm">
      <rect x="610" y="190" width="420" height="390" fill="#FBF6EC" stroke=${INK} stroke-width=${SW} />
      <path d="M590 190L820 100l230 90z" fill="#C99A50" stroke=${INK} stroke-width=${SW} stroke-linejoin="round" />
      ${[0, 1, 2, 3].map((i) => html`<rect x=${650 + i * 95} y="240" width="30" height="230" fill="#EFE3C8" stroke=${INK} stroke-width="4" />`)}
      <rect x="760" y="480" width="120" height="100" rx="8" fill="#3A3330" stroke=${INK} stroke-width="5" />
      <rect x="776" y="494" width="88" height="44" rx="4" fill="#A7C7E7" />
      <circle cx="820" cy="150" r="22" fill="#F3D27A" stroke=${INK} stroke-width="4" />
    </g>

    ${shop({ x: 40, y: 640, w: 490, h: 490, awning: '#B83C48', sign: apple, id: 'town.grocery-shop' })}
    ${shop({ x: 556, y: 640, w: 490, h: 490, awning: '#667E66', sign: shirt, id: 'town.clothing-shop' })}

    <!-- T5 map sign -->
    <g id="obj-town.map-sign">
      <rect x="497" y="1260" width="20" height="290" fill="#8E6A50" stroke=${INK} stroke-width="5" />
      <path d="M430 1270h150l30 30-30 30H430z" fill="#F3D27A" stroke=${INK} stroke-width="5" stroke-linejoin="round" />
      <path d="M590 1360H440l-30 30 30 30h150z" fill="#A7C7E7" stroke=${INK} stroke-width="5" stroke-linejoin="round" />
      <ellipse cx="507" cy="1552" rx="50" ry="10" fill=${INK} opacity="0.15" />
    </g>
  `;
}
