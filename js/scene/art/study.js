// @ts-check
// Placeholder study art, portrait (docs/spec/rooms/study.md §1). Safe-zone pixel coordinates (1080 × 1620).

import { html } from '../../ui/lib.js';
import { bareRoom } from './common.js';
import { visualStateFor } from '../badges.js';

const INK = '#2B2420';
const SW = 6;

/** @param {import('../../world/locations.js').Location} loc */
export function studyArt(loc) {
  const classes = Number(visualStateFor('study.planner').replace('classes-', '')) || 0;
  const reading = visualStateFor('study.bookshelf') === 'reading';
  const focus = visualStateFor('study.desk-planner');
  const lampOn = focus === 'focus';
  const spines = ['#2C3E63', '#B83C48', '#4F8A5B', '#C99A50', '#8B67A8', '#4A78B5', '#7A5235'];

  return html`
    ${bareRoom(loc)}
    <!-- window -->
    <g>
      <rect x="65" y="97" width="302" height="259" rx="14" fill="#DCE7E8" stroke=${INK} stroke-width=${SW} />
      <path d="M216 97v259M65 226h302" stroke=${INK} stroke-width=${SW} />
    </g>

    <!-- S2 planner board -->
    <g id="obj-study.planner" data-state=${`classes-${classes}`}>
      <rect x="436" y="100" width="576" height="286" rx="10" fill="#F7F3EC" stroke=${INK} stroke-width=${SW} />
      <rect x="436" y="100" width="576" height="46" rx="10" fill="#4A78B5" stroke=${INK} stroke-width=${SW} />
      ${[0, 1, 2, 3, 4].map((i) => html`<text x=${490 + i * 112} y="132" text-anchor="middle" font-size="24" font-weight="700" fill="#FFFFFF">${'MTWTF'[i]}</text>
        <path d=${`M${436 + (i + 1) * 112} 146v240`} stroke=${INK} stroke-opacity="0.15" stroke-width="3" />`)}
      ${[[0, 0, '#E8B4B8'], [1, 1, '#A8D5BA'], [2, 0, '#F3D27A'], [3, 2, '#A7C7E7'], [4, 1, '#D7B9E8'], [0, 2, '#A7C7E7']].map(([c, r, col]) => html`<rect x=${448 + Number(c) * 112} y=${162 + Number(r) * 70} width="88" height="54" rx="6" fill=${col} stroke=${INK} stroke-width="3" />`)}
      ${Array.from({ length: classes }, (_, i) => html`<circle cx=${990 - i * 26} cy="366" r="9" fill="#F3D27A" stroke=${INK} stroke-width="3" />`)}
    </g>

    <!-- S3 study bookshelf -->
    <g id="obj-study.bookshelf" data-state=${reading ? 'reading' : 'default'}>
      <rect x="48" y="460" width="250" height="670" rx="10" fill="#8E6A50" stroke=${INK} stroke-width=${SW} />
      ${[0, 1, 2, 3].map((r) => html`<rect x="64" y=${478 + r * 160} width="218" height="140" fill="#6E513D" />
        ${spines.slice(0, 6).map((c, i) => html`<rect x=${72 + i * 32} y=${(r === 1 && i === 2 && reading ? 470 : 498) + r * 160} width="26" height=${r === 1 && i === 2 && reading ? 148 : 120 - (i % 2) * 16} rx="3" fill=${c} stroke=${INK} stroke-width="3" />`)}`)}
    </g>

    <!-- desk with S1 computer -->
    <rect x="346" y="907" width="690" height="34" rx="8" fill="#A98263" stroke=${INK} stroke-width=${SW} />
    <rect x="380" y="941" width="22" height="250" fill="#8E6A50" stroke=${INK} stroke-width="5" />
    <rect x="980" y="941" width="22" height="250" fill="#8E6A50" stroke=${INK} stroke-width="5" />
    <g id="obj-study.computer">
      <rect x="440" y="526" width="350" height="250" rx="16" fill="#2E2B2A" stroke=${INK} stroke-width=${SW} />
      <rect x="458" y="544" width="314" height="214" rx="6" fill="#3C5A7A" />
      <path d="M590 776h50v100h-50z" fill="#9AA3A5" stroke=${INK} stroke-width="5" />
      <rect x="540" y="870" width="150" height="20" rx="8" fill="#9AA3A5" stroke=${INK} stroke-width="5" />
    </g>
    <rect x="720" y="884" width="110" height="24" rx="6" fill="#E8E2D6" stroke=${INK} stroke-width="4" />

    <!-- desk lamp (on during focus) -->
    <g>
      ${lampOn && html`<path d="M880 640l-70 260h180z" fill="#F3D27A" opacity="0.35" />`}
      <path d="M900 905V700l-40-40" fill="none" stroke=${INK} stroke-width="8" stroke-linecap="round" />
      <path d="M820 640l60-30 30 50-60 30z" fill=${lampOn ? '#F3D27A' : '#C9C3B8'} stroke=${INK} stroke-width="5" stroke-linejoin="round" />
      <ellipse cx="900" cy="905" rx="40" ry="10" fill=${INK} />
    </g>

    <!-- S4 desk planner + timer -->
    <g id="obj-study.desk-planner" data-state=${focus}>
      <rect x="850" y="850" width="150" height="56" rx="6" fill=${focus === 'break' ? '#A8D5BA' : '#F7F3EC'} stroke=${INK} stroke-width="5" />
      <path d="M870 868h80M870 886h60" stroke=${INK} stroke-opacity="0.4" stroke-width="4" />
      <circle cx="975" cy="878" r="18" fill=${focus === 'focus' ? '#B83C48' : '#FFFFFF'} stroke=${INK} stroke-width="4" />
      <path d="M975 868v10l7 5" stroke=${focus === 'focus' ? '#FFFFFF' : INK} stroke-width="3" fill="none" stroke-linecap="round" />
    </g>

    <!-- chair -->
    <g>
      <rect x="560" y="1050" width="230" height="40" rx="14" fill="#4A78B5" stroke=${INK} stroke-width=${SW} />
      <rect x="580" y="930" width="190" height="120" rx="20" fill="#4A78B5" stroke=${INK} stroke-width=${SW} />
      <path d="M675 1090v120M600 1220h150" stroke=${INK} stroke-width="10" stroke-linecap="round" />
    </g>

  `;
}
