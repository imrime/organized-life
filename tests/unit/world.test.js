// @ts-check
import { describe, it, expect } from '../harness.js';
import { OBJECTS } from '../../js/world/objects.js';
import { LOCATIONS } from '../../js/world/locations.js';
import en from '../../js/i18n/en.js';

/** Safe zone in CSS px on the smallest supported phone (360 px wide). */
const W = 360;
const H = 540;
const MIN = 44;

/** @param {{x:number,y:number,width:number,height:number}} r */
function expanded(r) {
  const w = Math.max(r.width * W, MIN);
  const h = Math.max(r.height * H, MIN);
  const cx = (r.x + r.width / 2) * W;
  const cy = (r.y + r.height / 2) * H;
  return { left: cx - w / 2, right: cx + w / 2, top: cy - h / 2, bottom: cy + h / 2 };
}

/** @param {any} obj @param {string} key */
const lookup = (obj, key) => key.split('.').reduce((n, k) => (n ? n[k] : undefined), obj);

describe('world geometry', () => {
  it('every object belongs to a known location and has a unique id', () => {
    const ids = OBJECTS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const o of OBJECTS) expect(LOCATIONS.some((l) => l.id === o.roomId)).toBe(true);
  });
  it('hit areas lie inside the safe zone', () => {
    for (const o of OBJECTS) {
      const { x, y, width, height } = o.hitArea;
      expect(x >= 0 && y >= 0 && x + width <= 1 && y + height <= 1).toBe(true);
    }
  });
  it('no two objects in a room overlap after expanding to 44 × 44 px', () => {
    const overlaps = [];
    for (const a of OBJECTS) {
      for (const b of OBJECTS) {
        if (a.id >= b.id || a.roomId !== b.roomId) continue;
        const ra = expanded(a.hitArea);
        const rb = expanded(b.hitArea);
        if (ra.left < rb.right && rb.left < ra.right && ra.top < rb.bottom && rb.top < ra.bottom) overlaps.push(`${a.id} × ${b.id}`);
      }
    }
    expect(overlaps).toEqual([]);
  });
  it('every object has a label and description in English', () => {
    for (const o of OBJECTS) {
      expect(typeof lookup(en, o.labelKey)).toBe('string');
      expect(typeof lookup(en, o.descriptionKey)).toBe('string');
    }
  });
});
