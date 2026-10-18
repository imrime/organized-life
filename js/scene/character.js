// @ts-check
// Placeholder paper-doll character (docs/spec/03-ux-shell.md §11, §17.3). Canvas 300 × 600, feet at (150, 590).
// Clothes are drawn from templates in the item's colour (owner decision D-07: drawings of the player's real clothes).

import { html } from '../ui/lib.js';
import { COLORS } from '../features/wardrobe/catalog.js';

export const SKIN_TONES = ['#F6D7C3', '#EFC3A4', '#E0AC86', '#C98E66', '#A86F4C', '#8A5638', '#6B3F27', '#4A2B1B'];
export const HAIR_STYLES = ['short', 'buzz', 'bob', 'long', 'curly', 'ponytail', 'bun', 'afro'];
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
const S = 5;

/** @typedef {{ template: string, color: string }} Garment */
/** @typedef {{ top?: Garment|null, bottom?: Garment|null, dress?: Garment|null, outerwear?: Garment|null, shoes?: Garment|null, accessory?: Garment|null }} Outfit */

/** Darker shade for details. @param {string} hex */
function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (/** @type {number} */ c) => Math.max(0, Math.round(c * 0.72));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

const LONG_SLEEVES = 'M100 172H200L236 205V335H206V235L200 230V340H100V230L94 235V335H64V205Z';
const SHORT_SLEEVES = 'M100 172h100l38 40-24 26-14-14v116H100V224l-14 14-24-26z';

/**
 * One garment in canvas coordinates (no body).
 * @param {Garment} g
 */
export function garment(g) {
  const fill = COLORS[g.color] ?? g.color ?? '#ccc';
  const dark = shade(fill);
  const common = { fill, stroke: INK, 'stroke-width': S, 'stroke-linejoin': 'round' };
  /** @param {string} d @param {Record<string, any>} [extra] */
  const p = (d, extra = {}) => html`<path d=${d} ...${{ ...common, ...extra }} />`;
  /** @param {string} d */
  const detail = (d) => html`<path d=${d} fill="none" stroke=${dark} stroke-width="4" stroke-linecap="round" />`;

  switch (g.template) {
    // ---- tops
    case 'tshirt':
      return html`${p(SHORT_SLEEVES)}${detail('M132 172c4 14 32 14 36 0')}`;
    case 'tank':
      return html`${p('M114 172h20c4 12 28 12 32 0h20l8 168H106z')}`;
    case 'longsleeve':
      return html`${p(LONG_SLEEVES)}${detail('M132 172c4 14 32 14 36 0')}`;
    case 'shirt':
      return html`${p(LONG_SLEEVES)}${detail('M150 180V338M134 172l16 18 16-18')}<circle cx="150" cy="215" r="3" fill=${dark} /><circle cx="150" cy="255" r="3" fill=${dark} /><circle cx="150" cy="295" r="3" fill=${dark} />`;
    case 'blouse':
      return html`${p(SHORT_SLEEVES)}${detail('M132 172l18 28 18-28M100 330c16 8 84 8 100 0')}`;
    case 'sweater':
      return html`${p(LONG_SLEEVES)}${detail('M104 326h92M68 322h22M210 322h22M134 172c4 12 28 12 32 0')}`;
    case 'hoodie':
      return html`${p('M108 176c-6-26 10-40 42-40s48 14 42 40', { fill })}${p(LONG_SLEEVES)}${detail('M120 290h60v30h-60zM140 180v30M160 180v30')}`;
    // ---- bottoms
    case 'jeans':
    case 'trousers':
      return html`${p('M106 330h88l-6 226h-32l-6-166-6 166h-32z')}${g.template === 'jeans' ? detail('M150 334v52M118 350h20') : ''}`;
    case 'joggers':
      return html`${p('M104 330h92l-8 214h-32l-6-156-6 156h-32z')}${detail('M114 536h32M154 536h32')}`;
    case 'leggings':
      return html`${p('M110 330h80l-4 228h-28l-8-170-8 170h-28z')}`;
    case 'shorts':
      return html`${p('M106 330h88l-2 100h-38l-4-52-4 52h-38z')}`;
    case 'skirt':
      return html`${p('M108 330h84l22 124H86z')}${detail('M128 336l-10 112M172 336l10 112')}`;
    // ---- dresses
    case 'dress':
      return html`${p('M100 172H200L216 212 200 228V300L234 474H66L100 300V228L84 212Z')}${detail('M132 172c4 14 32 14 36 0M102 300h96')}`;
    case 'jumpsuit':
      return html`${p(LONG_SLEEVES)}${p('M100 330h100l-8 226h-34l-8-168-8 168h-34z')}${detail('M104 330h92')}`;
    // ---- outerwear (open front)
    case 'jacket':
    case 'cardigan':
    case 'blazer': {
      const len = g.template === 'cardigan' ? 360 : 350;
      return html`${p(`M96 166H144V${len}H96V236L92 240V338H58V200Z`)}${p(`M156 166H204L242 200V338H208V240L204 236V${len}H156Z`)}
        ${g.template === 'blazer' ? detail('M144 170l-16 50 16 20M156 170l16 50-16 20') : ''}${g.template === 'jacket' ? detail('M106 300h28M166 300h28') : ''}`;
    }
    case 'coat':
    case 'raincoat':
      return html`${g.template === 'raincoat' ? p('M106 176c-6-28 12-44 44-44s50 16 44 44', { fill }) : ''}
        ${p('M94 164H144V450H84L94 330V236L90 240V340H56V198Z')}${p('M156 164H206L244 198V340H210V240L206 236V330L216 450H156Z')}
        ${detail('M114 260h20M166 260h20')}`;
    // ---- shoes
    case 'sneakers':
      return html`${p('M96 552h52v28H90c0-14 2-28 6-28z')}${p('M152 552h52c4 0 6 14 6 28h-58z')}${detail('M96 574h52M152 574h52')}`;
    case 'boots':
      return html`${p('M100 514h46v66H92c0-12 2-20 8-24z')}${p('M154 514h46v42c6 4 8 12 8 24h-54z')}`;
    case 'heels':
      return html`${p('M104 556h40l2 22h-50z')}${p('M156 556h40l6 22h-50z')}${detail('M100 578v10M200 578v10')}`;
    case 'sandals':
      return html`${detail('M104 560h38M158 560h38M110 572h30M162 572h30')}${p('M96 576h52v6H96zM152 576h52v6h-52z')}`;
    case 'loafers':
      return html`${p('M98 560h48v20H92c0-12 2-20 6-20z')}${p('M154 560h48c4 0 6 8 6 20h-54z')}`;
    // ---- accessories
    case 'cap':
      return html`${p('M92 84c0-38 26-56 58-56s58 18 58 56z')}${p('M150 84h88c0 10-12 16-30 16h-58z')}`;
    case 'beanie':
      return html`${p('M90 92c0-44 26-66 60-66s60 22 60 66z')}${p('M88 82h124v18H88z')}<circle cx="150" cy="24" r="12" fill=${fill} stroke=${INK} stroke-width="4" />`;
    case 'scarf':
      return html`${p('M116 156h68v26h-68z')}${p('M162 176h22v80h-22z')}${detail('M164 250h18')}`;
    case 'bag':
      return html`<path d="M120 172L232 300" stroke=${dark} stroke-width="6" fill="none" />${p('M212 290h52v54h-52z')}${detail('M220 304h36')}`;
    case 'watch':
      return html`${p('M64 318h30v14H64z')}<circle cx="79" cy="325" r="7" fill="#fff" stroke=${INK} stroke-width="3" />`;
    default:
      return null;
  }
}

/** Crop of the canvas for a garment icon. @param {string} slot @param {string} template */
export function iconViewBox(slot, template) {
  if (slot === 'bottom') return '56 320 188 250';
  if (slot === 'shoes') return '84 500 132 90';
  if (slot === 'dress') return '50 150 200 420';
  if (slot === 'accessory') {
    if (template === 'cap' || template === 'beanie') return '80 8 170 110';
    if (template === 'scarf') return '100 140 100 130';
    if (template === 'bag') return '110 160 170 200';
    return '50 300 60 50';
  }
  return '46 120 208 250';
}

/**
 * Garment drawn alone, for wardrobe grids and the clothing shop.
 * @param {{ template: string, color: string, slot: string }} props
 */
export function GarmentIcon({ template, color, slot }) {
  return html`<svg class="garment-icon" viewBox=${iconViewBox(slot, template)} aria-hidden="true" focusable="false">${garment({ template, color })}</svg>`;
}

/** @param {string} style @param {string} hair */
function backHair(style, hair) {
  const a = { fill: hair, stroke: INK, 'stroke-width': 4 };
  if (style === 'long') return html`<path d="M88 100c-6 70 4 120 22 140h80c18-20 28-70 22-140z" ...${a} />`;
  if (style === 'bob') return html`<path d="M88 96c-4 40 0 70 14 84h96c14-14 18-44 14-84z" ...${a} />`;
  if (style === 'afro') return html`<circle cx="150" cy="92" r="84" ...${a} />`;
  if (style === 'curly') return html`<g ...${a}>${[[96, 120], [204, 120], [92, 80], [208, 80], [104, 150], [196, 150]].map(([x, y]) => html`<circle cx=${x} cy=${y} r="22" />`)}</g>`;
  if (style === 'ponytail') return html`<path d="M200 70c40 10 46 70 20 110-4-30-14-60-30-80z" ...${a} />`;
  if (style === 'bun') return html`<circle cx="150" cy="30" r="26" ...${a} />`;
  return null;
}

/** @param {string} style @param {string} hair */
function frontHair(style, hair) {
  const a = { fill: hair, stroke: INK, 'stroke-width': 5, 'stroke-linejoin': 'round' };
  if (style === 'buzz') return html`<path d="M94 92c0-40 26-62 56-62s56 22 56 62c-14-22-34-30-56-30s-42 8-56 30z" ...${a} />`;
  if (style === 'afro' || style === 'curly') return html`<path d="M92 92c0-44 28-66 58-66s58 22 58 66c-16-20-36-26-58-26s-42 6-58 26z" ...${a} />`;
  return html`<path d="M90 100c-4-50 26-76 60-76s66 26 60 76c-10-28-30-40-50-40-6 14-30 26-70 40z" ...${a} />`;
}

/**
 * @param {{ character: Record<string, any>, outfit?: Outfit }} props
 */
export function CharacterFigure({ character, outfit = {} }) {
  const skin = SKIN_TONES[(character.skinTone ?? 3) - 1] ?? SKIN_TONES[2];
  const hair = HAIR_COLORS[character.hairColor ?? 'brown'] ?? HAIR_COLORS.brown;
  const style = character.hairStyle ?? 'short';
  const skinAttrs = { fill: skin, stroke: INK, 'stroke-width': S };
  const hatOn = outfit.accessory && ['cap', 'beanie'].includes(outfit.accessory.template);
  const hasTop = Boolean(outfit.top || outfit.dress);
  const legsCovered = Boolean(outfit.bottom || outfit.dress?.template === 'jumpsuit');

  return html`<svg class="character-svg" viewBox="0 0 300 600" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <ellipse cx="150" cy="590" rx="80" ry="10" fill=${INK} opacity="0.15" />
    <g class="character-body">
      ${!hatOn && backHair(style, hair)}
      <path d="M112 330h76l-4 228h-28l-6-170-6 170h-28z" ...${skinAttrs} />
      ${!legsCovered && !outfit.dress && html`<path d="M108 330h84v34h-84z" fill="#EFE3C8" stroke=${INK} stroke-width="4" />`}
      ${outfit.bottom && garment(outfit.bottom)}
      ${outfit.shoes ? garment(outfit.shoes) : html`<path d="M100 556h44v22H98zM156 556h44l2 22h-46z" ...${skinAttrs} />`}
      <rect x="64" y="190" width="30" height="150" rx="15" ...${skinAttrs} />
      <rect x="206" y="190" width="30" height="150" rx="15" ...${skinAttrs} />
      ${outfit.dress && garment(outfit.dress)}
      ${outfit.top && garment(outfit.top)}
      ${!hasTop && html`<path d="M114 172h20c4 12 28 12 32 0h20l8 168H106z" fill="#EFE3C8" stroke=${INK} stroke-width="4" />`}
      ${outfit.outerwear && garment(outfit.outerwear)}
      <rect x="136" y="146" width="28" height="30" fill=${skin} stroke=${INK} stroke-width="4" />
      <circle cx="150" cy="100" r="58" ...${skinAttrs} />
      <g class="character-eyes">
        <circle cx="130" cy="104" r="6" fill=${INK} />
        <circle cx="170" cy="104" r="6" fill=${INK} />
      </g>
      <path d="M132 128c10 10 26 10 36 0" fill="none" stroke=${INK} stroke-width="5" stroke-linecap="round" />
      <circle cx="116" cy="122" r="8" fill="#E89A9A" opacity="0.5" />
      <circle cx="184" cy="122" r="8" fill="#E89A9A" opacity="0.5" />
      ${!hatOn && frontHair(style, hair)}
      ${outfit.accessory && garment(outfit.accessory)}
      ${character.glasses &&
      html`<g fill="none" stroke=${INK} stroke-width="4"><circle cx="130" cy="104" r="15" /><circle cx="170" cy="104" r="15" /><path d="M145 104h10" /></g>`}
    </g>
  </svg>`;
}

/**
 * Resolves equipped item ids to garments.
 * @param {Record<string, string|null|undefined>} equipped
 * @param {(id: string) => any} getItem
 * @returns {Outfit}
 */
export function outfitFrom(equipped, getItem) {
  /** @type {Outfit} */
  const out = {};
  for (const [slot, id] of Object.entries(equipped ?? {})) {
    const item = id ? getItem(id) : null;
    if (item) /** @type {any} */ (out)[slot] = { template: item.template, color: item.color };
  }
  return out;
}

/**
 * Character positioned in the safe zone at a room's spot.
 * @param {{ spot: import('../world/types.js').CharacterSpot, character: Record<string, any>, outfit?: Outfit }} props
 */
export function SceneCharacter({ spot, character, outfit }) {
  const heightPct = spot.height * 100;
  // Canvas is 1:2, the safe zone 2:3 → width (in % of safe-zone width) = height × 1.5 / 2.
  const widthPct = spot.height * 75;
  const style = `left:${spot.anchor.x * 100 - widthPct / 2}%;top:${spot.anchor.y * 100 - heightPct}%;width:${widthPct}%;height:${heightPct}%`;
  return html`<div class="character" style=${style}><${CharacterFigure} character=${character} outfit=${outfit} /></div>`;
}
