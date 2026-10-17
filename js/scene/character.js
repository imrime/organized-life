// @ts-check
// Placeholder paper-doll character (docs/spec/03-ux-shell.md §11, §17.3). Canvas 300 × 600, feet at (150, 590).
// Decorative in scenes (pointer-events: none); appearance comes from profile/character.

import { html } from '../ui/lib.js';

export const SKIN_TONES = ['#F6D7C3', '#EFC3A4', '#E0AC86', '#C98E66', '#A86F4C', '#8A5638', '#6B3F27', '#4A2B1B'];
export const HAIR_COLORS = /** @type {Record<string, string>} */ ({
  black: '#1F1A17',
  'dark-brown': '#3B2A20',
  brown: '#6B4A33',
  auburn: '#8A3F2A',
  blonde: '#D9B66B',
  ginger: '#C8672F',
  grey: '#9A9590',
  white: '#E9E6E1',
  blue: '#4A6FA5',
  pink: '#D9829B',
});

const INK = '#2B2420';

/**
 * @param {{ character: Record<string, any>, outfit?: { top?: string, bottom?: string, shoes?: string } }} props
 *   outfit: garment colours (until wardrobe templates ship)
 */
export function CharacterFigure({ character, outfit = {} }) {
  const skin = SKIN_TONES[(character.skinTone ?? 3) - 1] ?? SKIN_TONES[2];
  const hair = HAIR_COLORS[character.hairColor ?? 'brown'] ?? HAIR_COLORS.brown;
  const top = outfit.top ?? '#F4F1EC';
  const bottom = outfit.bottom ?? '#4A6A9A';
  const shoes = outfit.shoes ?? '#FFFFFF';
  const long = ['long', 'ponytail', 'bob', 'curly'].includes(character.hairStyle);

  return html`<svg class="character-svg" viewBox="0 0 300 600" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <ellipse cx="150" cy="590" rx="80" ry="10" fill=${INK} opacity="0.15" />
    <g class="character-body">
      ${long && html`<path d="M88 100c-6 70 4 120 22 140h80c18-20 28-70 22-140z" fill=${hair} stroke=${INK} stroke-width="4" />`}
      <!-- legs / bottom -->
      <path d="M108 330h84l-6 228h-30l-6-170-6 170h-30z" fill=${bottom} stroke=${INK} stroke-width="5" stroke-linejoin="round" />
      <!-- shoes -->
      <rect x="96" y="552" width="52" height="28" rx="12" fill=${shoes} stroke=${INK} stroke-width="5" />
      <rect x="152" y="552" width="52" height="28" rx="12" fill=${shoes} stroke=${INK} stroke-width="5" />
      <!-- arms -->
      <rect x="64" y="190" width="30" height="150" rx="15" fill=${skin} stroke=${INK} stroke-width="5" />
      <rect x="206" y="190" width="30" height="150" rx="15" fill=${skin} stroke=${INK} stroke-width="5" />
      <!-- top -->
      <path d="M100 172h100l38 40-24 26-14-14v116H100V224l-14 14-24-26z" fill=${top} stroke=${INK} stroke-width="5" stroke-linejoin="round" />
      <path d="M132 172c4 14 32 14 36 0" fill="none" stroke=${INK} stroke-width="4" />
      <!-- neck + head -->
      <rect x="136" y="146" width="28" height="30" fill=${skin} stroke=${INK} stroke-width="4" />
      <circle cx="150" cy="100" r="58" fill=${skin} stroke=${INK} stroke-width="5" />
      <g class="character-eyes">
        <circle cx="130" cy="104" r="6" fill=${INK} />
        <circle cx="170" cy="104" r="6" fill=${INK} />
      </g>
      <path d="M132 128c10 10 26 10 36 0" fill="none" stroke=${INK} stroke-width="5" stroke-linecap="round" />
      <circle cx="116" cy="122" r="8" fill="#E89A9A" opacity="0.5" />
      <circle cx="184" cy="122" r="8" fill="#E89A9A" opacity="0.5" />
      <!-- hair front -->
      ${character.hairStyle === 'buzz'
        ? html`<path d="M94 92c0-40 26-62 56-62s56 22 56 62c-14-22-34-30-56-30s-42 8-56 30z" fill=${hair} stroke=${INK} stroke-width="4" />`
        : html`<path d="M90 100c-4-50 26-76 60-76s66 26 60 76c-10-28-30-40-50-40-6 14-30 26-70 40z" fill=${hair} stroke=${INK} stroke-width="5" stroke-linejoin="round" />`}
      ${character.glasses &&
      html`<g fill="none" stroke=${INK} stroke-width="4"><circle cx="130" cy="104" r="15" /><circle cx="170" cy="104" r="15" /><path d="M145 104h10" /></g>`}
    </g>
  </svg>`;
}

/**
 * Character positioned in the safe zone at a room's spot.
 * @param {{ spot: import('../world/types.js').CharacterSpot, character: Record<string, any> }} props
 */
export function SceneCharacter({ spot, character }) {
  const heightPct = spot.height * 100;
  // Canvas is 1:2, the safe zone 2:3 → width (in % of safe-zone width) = height × 1.5 / 2.
  const widthPct = spot.height * 75;
  const style = `left:${spot.anchor.x * 100 - widthPct / 2}%;top:${spot.anchor.y * 100 - heightPct}%;width:${widthPct}%;height:${heightPct}%`;
  return html`<div class="character" style=${style}><${CharacterFigure} character=${character} /></div>`;
}
