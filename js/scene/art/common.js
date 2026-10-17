// @ts-check
// Shared placeholder art pieces.

import { html } from '../../ui/lib.js';

/** @typedef {import('../../world/locations.js').Location} Location */

/**
 * Bare room: wall, floor with boards, skirting line. Used for rooms without their own art yet.
 * @param {Location} loc
 */
export function bareRoom(loc) {
  const floorY = Math.round(loc.floorLine * 1620);
  const boards = [];
  for (let y = floorY + 70; y < 1770; y += 90) boards.push(y);
  return html`
    <rect x="-180" y="-150" width="1440" height=${floorY + 150} fill=${loc.wall} />
    <rect x="-180" y=${floorY} width="1440" height=${1770 - floorY} fill=${loc.floor} />
    <rect x="-180" y=${floorY - 6} width="1440" height="12" fill="#2B2420" opacity="0.08" />
    ${boards.map((y) => html`<line x1="-180" x2="1260" y1=${y} y2=${y} stroke="#2B2420" stroke-opacity="0.08" stroke-width="3" />`)}
  `;
}

