// @ts-check
// Placeholder bedroom art, portrait (docs/spec/rooms/bedroom.md §1). Safe-zone pixel coordinates (1080 × 1620).
// Replaced by owner-provided art later (docs/spec/08-art-delivery.md); object groups keep their ids and states.

import { html } from '../../ui/lib.js';
import { bareRoom } from './common.js';
import { visualStateFor } from '../badges.js';

const INK = '#2B2420';
const SW = 6;

/** @param {import('../../world/locations.js').Location} loc */
export function bedroomArt(loc) {
  const clock = visualStateFor('bedroom.alarm-clock');
  const bed = visualStateFor('bedroom.bed');
  const tray = visualStateFor('bedroom.medication-tray');
  const lids = ['#E8B4B8', '#F3D27A', '#A8D5BA', '#A7C7E7', '#D7B9E8', '#F5B88A', '#C9E4A5'];

  return html`
    ${bareRoom(loc)}

    <!-- window -->
    <g>
      <rect x="65" y="97" width="367" height="324" rx="14" fill="#DCE7E8" stroke=${INK} stroke-width=${SW} />
      <path d="M248 97V421M65 259H432" stroke=${INK} stroke-width=${SW} />
      <path d="M80 112c40 60 40 150 0 290" fill="none" stroke="#FFFFFF" stroke-opacity="0.6" stroke-width="10" />
      <rect x="45" y="421" width="407" height="22" rx="6" fill="#F3EDE6" stroke=${INK} stroke-width=${SW} />
    </g>

    <!-- framed picture -->
    <g>
      <rect x="478" y="190" width="110" height="130" rx="6" fill="#F7F1E8" stroke=${INK} stroke-width=${SW} />
      <path d="M492 300l28-45 22 30 16-18 22 33z" fill="#A8C3A0" stroke=${INK} stroke-width="3" />
      <circle cx="560" cy="228" r="12" fill="#F3D27A" />
    </g>

    <!-- B2 wall calendar -->
    <g id="obj-bedroom.wall-calendar">
      <circle cx="788" cy="128" r="9" fill=${INK} />
      <path d="M788 128L700 152M788 128L876 152" stroke=${INK} stroke-width="3" />
      <rect x="646" y="150" width="284" height="245" rx="10" fill="#FFFFFF" stroke=${INK} stroke-width=${SW} />
      <path d="M646 220V160a10 10 0 0110-10h264a10 10 0 0110 10v60z" fill="#B83C48" stroke=${INK} stroke-width=${SW} />
      <circle cx="700" cy="152" r="7" fill="#F8F6F1" stroke=${INK} stroke-width="3" />
      <circle cx="876" cy="152" r="7" fill="#F8F6F1" stroke=${INK} stroke-width="3" />
    </g>

    <!-- B6 medication tray on a wall shelf -->
    <g id="obj-bedroom.medication-tray" data-state=${tray}>
      <rect x="740" y="760" width="270" height="16" rx="4" fill="#9C775B" stroke=${INK} stroke-width="5" />
      <path d="M770 776l18 30M980 776l-18 30" stroke=${INK} stroke-width="5" />
      <rect x="770" y="690" width="210" height="70" rx="10" fill="#F7F3EE" stroke=${INK} stroke-width="5" />
      ${lids.map(
        (color, i) => html`<rect
          x=${780 + i * 28.5}
          y="700"
          width="22"
          height="50"
          rx="5"
          fill=${tray === 'empty' || (tray === 'partial' && i % 2) ? '#FFFFFF' : color}
          stroke=${INK}
          stroke-width="3"
        />`,
      )}
    </g>

    <!-- B4 wardrobe -->
    <g id="obj-bedroom.wardrobe">
      <ellipse cx="205" cy="1104" rx="170" ry="16" fill=${INK} opacity="0.12" />
      <rect x="55" y="500" width="300" height="590" rx="10" fill="#B78C6A" stroke=${INK} stroke-width=${SW} />
      <rect x="43" y="486" width="324" height="32" rx="8" fill="#A47A58" stroke=${INK} stroke-width=${SW} />
      <path d="M205 518V1090" stroke=${INK} stroke-width=${SW} />
      <rect x="82" y="545" width="100" height="500" rx="6" fill="none" stroke=${INK} stroke-opacity="0.25" stroke-width="4" />
      <rect x="228" y="545" width="100" height="500" rx="6" fill="none" stroke=${INK} stroke-opacity="0.25" stroke-width="4" />
      <rect x="186" y="760" width="10" height="56" rx="5" fill="#F3D27A" stroke=${INK} stroke-width="3" />
      <rect x="214" y="760" width="10" height="56" rx="5" fill="#F3D27A" stroke=${INK} stroke-width="3" />
      <rect x="70" y="1088" width="26" height="16" fill="#8E6A50" stroke=${INK} stroke-width="4" />
      <rect x="314" y="1088" width="26" height="16" fill="#8E6A50" stroke=${INK} stroke-width="4" />
    </g>

    <!-- rug -->
    <ellipse cx="420" cy="1135" rx="200" ry="38" fill="#D9B9A8" stroke=${INK} stroke-opacity="0.3" stroke-width="4" />

    <!-- B5 desk with notebook -->
    <g id="obj-bedroom.desk-notebook">
      <rect x="425" y="824" width="18" height="178" fill="#8E6A50" stroke=${INK} stroke-width="5" />
      <rect x="679" y="824" width="18" height="178" fill="#8E6A50" stroke=${INK} stroke-width="5" />
      <rect x="560" y="824" width="120" height="62" rx="4" fill="#A98263" stroke=${INK} stroke-width="5" />
      <circle cx="620" cy="855" r="6" fill=${INK} />
      <rect x="410" y="800" width="302" height="26" rx="6" fill="#9C775B" stroke=${INK} stroke-width=${SW} />
      <path d="M445 798l70-24 70 24z" fill="#FFFFFF" stroke=${INK} stroke-width="4" />
      <path d="M515 774v24" stroke=${INK} stroke-width="3" />
      <rect x="440" y="790" width="150" height="10" rx="3" fill="#B83C48" stroke=${INK} stroke-width="3" />
      <rect x="630" y="746" width="44" height="54" rx="6" fill="#A7C7E7" stroke=${INK} stroke-width="4" />
      <path d="M640 746l-6-34M652 746l2-40M664 746l8-30" stroke=${INK} stroke-width="5" stroke-linecap="round" />
    </g>

    <!-- nightstand -->
    <g>
      <rect x="745" y="1026" width="260" height="210" rx="6" fill="#9C775B" stroke=${INK} stroke-width=${SW} />
      <path d="M745 1120H1005" stroke=${INK} stroke-width="5" />
      <circle cx="875" cy="1078" r="8" fill="#F3D27A" stroke=${INK} stroke-width="3" />
      <circle cx="875" cy="1176" r="8" fill="#F3D27A" stroke=${INK} stroke-width="3" />
      <rect x="730" y="1004" width="290" height="24" rx="6" fill="#8E6A50" stroke=${INK} stroke-width=${SW} />
    </g>

    <!-- B1 alarm clock (digits are drawn by the app over the face) -->
    <g id="obj-bedroom.alarm-clock" data-state=${clock}>
      <path d="M828 990l-14 14M898 990l14 14" stroke=${INK} stroke-width="7" stroke-linecap="round" />
      <circle cx="822" cy="878" r="21" fill="#B07D35" stroke=${INK} stroke-width="5" />
      <circle cx="904" cy="878" r="21" fill="#B07D35" stroke=${INK} stroke-width="5" />
      <rect x="856" y="852" width="14" height="16" rx="3" fill=${INK} />
      <circle cx="863" cy="932" r="64" fill="#C99A50" stroke=${INK} stroke-width=${SW} />
      <circle cx="863" cy="932" r="50" fill="#FBF6EC" stroke=${INK} stroke-width="3" />
      ${clock === 'armed' && html`<circle cx="913" cy="886" r="9" fill="#B83C48" stroke=${INK} stroke-width="3" />`}
    </g>

    <!-- B3 bed -->
    <g id="obj-bedroom.bed" data-state=${bed}>
      <ellipse cx="370" cy="1545" rx="320" ry="18" fill=${INK} opacity="0.12" />
      <rect x="100" y="1470" width="24" height="70" fill="#8E6A50" stroke=${INK} stroke-width="5" />
      <rect x="640" y="1470" width="24" height="70" fill="#8E6A50" stroke=${INK} stroke-width="5" />
      <rect x="43" y="1190" width="70" height="330" rx="16" fill="#B98A86" stroke=${INK} stroke-width=${SW} />
      <rect x="90" y="1330" width="595" height="150" rx="20" fill="#D5B5B0" stroke=${INK} stroke-width=${SW} />
      <rect x="120" y="1282" width="175" height="74" rx="32" fill="#FFFFFF" stroke=${INK} stroke-width=${SW} />
      ${bed === 'turned-down'
        ? html`<rect x="380" y="1300" width="300" height="150" rx="20" fill="#B56B71" stroke=${INK} stroke-width=${SW} />
            <path d="M380 1300l60 0-30 150" fill="#F2E6E4" stroke=${INK} stroke-width="4" />`
        : html`<rect x="300" y="1300" width="380" height="150" rx="20" fill="#B56B71" stroke=${INK} stroke-width=${SW} />
            <path d="M330 1330H650" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="8" stroke-linecap="round" />`}
      ${bed === 'slept' && html`<circle cx="640" cy="1270" r="22" fill="#4F7A5A" /><path d="M630 1270l8 8 14-16" fill="none" stroke="#fff" stroke-width="5" />`}
    </g>
  `;
}
