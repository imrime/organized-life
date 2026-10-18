// @ts-check
// Placeholder room art (portrait, flat vector in the PDF wireframe style) until final art is delivered.
// Canvas: viewBox "-180 -150 1440 1920"; safe zone = 0…1080 × 0…1620.

import { html } from '../../ui/lib.js';
import { bedroomArt } from './bedroom.js';
import { kitchenArt } from './kitchen.js';
import { townArt } from './town.js';
import { bathroomArt } from './bathroom.js';
import { entertainmentArt } from './entertainment.js';
import { studyArt } from './study.js';
import { gymArt } from './gym.js';
import { bareRoom } from './common.js';

/** @typedef {import('../../world/locations.js').Location} Location */

/** @type {Record<string, (loc: Location) => any>} rooms register detailed art here as they ship */
const ROOM_ART = { bedroom: bedroomArt, kitchen: kitchenArt, bathroom: bathroomArt, entertainment: entertainmentArt, study: studyArt, gym: gymArt, town: townArt };

/** @param {Location} loc */
export function roomArt(loc) {
  const draw = ROOM_ART[loc.id];
  return html`<svg viewBox="-180 -150 1440 1920" xmlns="http://www.w3.org/2000/svg" focusable="false">
    ${draw ? draw(loc) : bareRoom(loc)}
  </svg>`;
}
