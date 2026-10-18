// @ts-check
// Placeholder entertainment room art, portrait (docs/spec/rooms/entertainment.md §1). Safe-zone pixel coordinates (1080 × 1620).

import { html } from '../../ui/lib.js';
import { bareRoom } from './common.js';
import { visualStateFor } from '../badges.js';

const INK = '#2B2420';
const SW = 6;

/** @param {import('../../world/locations.js').Location} loc */
export function entertainmentArt(loc) {
  const tv = visualStateFor('entertainment.television');
  const consoleOn = visualStateFor('entertainment.game-console') === 'on';
  const playing = visualStateFor('entertainment.music-player') === 'playing';
  const easel = visualStateFor('entertainment.art-supplies');
  const trophies = visualStateFor('entertainment.bookshelf');
  const cups = trophies === 'trophies-many' ? 3 : trophies === 'trophies-some' ? 1 : 0;
  const spines = ['#B83C48', '#4A78B5', '#E8C24A', '#4F8A5B', '#8B67A8', '#E08A3C', '#2C3E63', '#E79AB0'];

  return html`
    ${bareRoom(loc)}
    <!-- rug -->
    <ellipse cx="420" cy="1200" rx="380" ry="70" fill="#D8A7B1" opacity="0.6" stroke=${INK} stroke-width="4" />

    <!-- posters -->
    <rect x="880" y="120" width="130" height="180" rx="6" fill="#F3D27A" stroke=${INK} stroke-width="5" transform="rotate(4 945 210)" />
    <path d="M905 260l30-60 25 40 20-25 20 45z" fill="#E08A3C" transform="rotate(4 945 210)" />

    <!-- E1 television -->
    <g id="obj-entertainment.television" data-state=${tv}>
      <rect x="330" y="100" width="506" height="312" rx="18" fill="#2E2B2A" stroke=${INK} stroke-width=${SW} />
      <rect x="352" y="122" width="462" height="268" rx="8" fill=${tv === 'on' ? '#3C5A7A' : '#46545E'} />
      ${tv === 'on'
        ? html`<path d="M352 300l120-80 90 60 110-90 142 110v90H352z" fill="#5E7B8C" opacity="0.7" />`
        : html`<ellipse cx="583" cy="256" rx="160" ry="70" fill="#FFFFFF" opacity="0.08" />`}
      <path d="M583 412v30" stroke=${INK} stroke-width="8" />
    </g>

    <!-- TV stand -->
    <rect x="324" y="810" width="454" height="160" rx="10" fill="#A98263" stroke=${INK} stroke-width=${SW} />
    <path d="M551 810v160" stroke=${INK} stroke-width="4" />
    <rect x="360" y="850" width="160" height="80" rx="6" fill="#C9A27F" stroke=${INK} stroke-width="4" />
    <rect x="582" y="850" width="160" height="80" rx="6" fill="#C9A27F" stroke=${INK} stroke-width="4" />

    <!-- E2 game console -->
    <g id="obj-entertainment.game-console" data-state=${consoleOn ? 'on' : 'off'}>
      <rect x="420" y="740" width="170" height="70" rx="10" fill="#F4F1EC" stroke=${INK} stroke-width=${SW} />
      <circle cx="565" cy="775" r="9" fill=${consoleOn ? '#4F8A5B' : '#C9C3B8'} stroke=${INK} stroke-width="3" />
      <path d="M620 790c0-26 18-36 34-36h18c16 0 34 10 34 36 0 14-10 20-20 20-8 0-12-6-20-6h-6c-8 0-12 6-20 6-10 0-20-6-20-20z" fill="#9A9A9A" stroke=${INK} stroke-width="5" />
    </g>

    <!-- E5 bookshelf -->
    <g id="obj-entertainment.bookshelf" data-state=${trophies}>
      <rect x="48" y="330" width="230" height="736" rx="10" fill="#9C775B" stroke=${INK} stroke-width=${SW} />
      ${[0, 1, 2, 3].map((r) => html`<rect x="64" y=${350 + r * 176} width="198" height="156" fill="#7E5D45" />
        ${spines.slice(0, 5 + (r % 3)).map((c, i) => html`<rect x=${70 + i * 30} y=${(r === 0 ? 412 : 380) + r * 176} width="24" height=${r === 0 ? 94 : 126 - (i % 3) * 14} rx="3" fill=${c} stroke=${INK} stroke-width="3" />`)}`)}
      ${Array.from({ length: cups }, (_, i) => html`<g transform=${`translate(${92 + i * 58} 352)`}>
        <path d="M0 0h36v18c0 14-8 22-18 22S0 32 0 18z" fill="#E8C24A" stroke=${INK} stroke-width="3" />
        <path d="M12 40h12v10H12zM6 50h24v8H6z" fill="#E8C24A" stroke=${INK} stroke-width="3" />
      </g>`)}
    </g>

    <!-- E4 art supplies (easel) -->
    <g id="obj-entertainment.art-supplies" data-state=${easel}>
      <path d="M930 530L850 960M930 530l80 430M930 530v440" stroke="#8E6A50" stroke-width="12" stroke-linecap="round" />
      <rect x="850" y="560" width="160" height="200" rx="4" fill="#FFFFFF" stroke=${INK} stroke-width=${SW} />
      ${easel === 'sketch' &&
      html`<g fill="none" stroke-linecap="round" stroke-width="6">
        <path d="M875 720c20-60 50-100 80-80s30 60 40 40" stroke="#4A78B5" />
        <circle cx="960" cy="610" r="22" stroke="#E8C24A" />
        <path d="M875 700h110" stroke="#4F8A5B" />
      </g>`}
      <rect x="840" y="760" width="180" height="16" rx="4" fill="#A98263" stroke=${INK} stroke-width="4" />
      <g transform="translate(860 905)">
        <rect width="70" height="50" rx="8" fill="#E79AB0" stroke=${INK} stroke-width="4" />
        <circle cx="20" cy="22" r="7" fill="#4A78B5" /><circle cx="40" cy="18" r="7" fill="#E8C24A" /><circle cx="52" cy="34" r="7" fill="#4F8A5B" />
      </g>
    </g>

    <!-- E3 music player (record player) -->
    <g id="obj-entertainment.music-player" data-state=${playing ? 'playing' : 'stopped'}>
      <rect x="868" y="1110" width="178" height="90" rx="10" fill="#C99A50" stroke=${INK} stroke-width=${SW} />
      <ellipse cx="945" cy="1110" rx="66" ry="20" fill="#2E2B2A" stroke=${INK} stroke-width="4" />
      ${playing && html`<path d="M905 1104a42 12 0 0 1 50-6" fill="none" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="4" stroke-linecap="round" />`}
      <ellipse cx="945" cy="1110" rx="16" ry="5" fill="#B83C48" />
      <path d="M1030 1080l-30 30" stroke="#9AA3A5" stroke-width="8" stroke-linecap="round" />
      ${playing &&
      html`<g class="notes-float" fill=${INK}>
        <path d="M900 1050v-40l20-6v36" stroke=${INK} stroke-width="4" fill="none" /><circle cx="895" cy="1052" r="7" /><circle cx="915" cy="1046" r="7" />
        <path d="M985 1030v-36" stroke=${INK} stroke-width="4" /><circle cx="980" cy="1032" r="7" />
      </g>`}
      <rect x="900" y="1200" width="16" height="40" fill="#8E6A50" /><rect x="1000" y="1200" width="16" height="40" fill="#8E6A50" />
    </g>

    <!-- sofa (decor) -->
    <g>
      <rect x="70" y="1260" width="660" height="150" rx="40" fill="#7A9BB5" stroke=${INK} stroke-width=${SW} />
      <rect x="110" y="1330" width="580" height="120" rx="24" fill="#8FB0C9" stroke=${INK} stroke-width=${SW} />
      <rect x="56" y="1300" width="80" height="180" rx="30" fill="#7A9BB5" stroke=${INK} stroke-width=${SW} />
      <rect x="664" y="1300" width="80" height="180" rx="30" fill="#7A9BB5" stroke=${INK} stroke-width=${SW} />
      <path d="M110 1480v30M690 1480v30" stroke=${INK} stroke-width="10" stroke-linecap="round" />
      <rect x="160" y="1280" width="110" height="80" rx="18" fill="#E8C24A" stroke=${INK} stroke-width="4" transform="rotate(-8 215 1320)" />
    </g>
  `;
}
