# 08 · Art delivery package

Final graphics are **provided by the owner later** ([D-14](01-decisions.md#d-14-art)). This document defines exactly what to deliver so the art drops into the app without code changes. Until a location's package arrives, the app uses placeholder SVG art.

## 1. Style

- Hand-drawn, warm, slightly textured 2D illustration; muted palettes from [03 §16.2](03-ux-shell.md#162-room-palettes-from-the-pdf-wireframes).
- **Portrait** scenes, front view (like the PDF), with a little depth (floor in front, wall behind).
- Every interactive object must be recognisable at phone size (scene ≈ 390 px wide): clear silhouettes, strong outline.
- **No text inside the art** (signs, book titles, clock digits): the app renders text so it can be translated and updated.

## 2. Canvas and safe zone (every location)

```text
 1440 × 1920 px canvas
┌──────────────────────────────────────────┐
│ bleed                                    │  150 px
│    ┌──────────────────────────────────┐  │
│    │ SAFE ZONE 1080 × 1620            │  │  x 180 … 1260
│    │ all interactive objects,         │  │  y 150 … 1770
│    │ the character spot and anything  │  │
│    │ important must be inside         │  │
│    └──────────────────────────────────┘  │
│ bleed (wall/floor/sky continues)         │  150 px
└──────────────────────────────────────────┘
   180 px                          180 px
```

- Canvas: **1440 × 1920 px**, sRGB. Safe zone: x 180–1260, y 150–1770 ([03 §3](03-ux-shell.md#3-scene-rendering)). A template with guides is provided at `assets-src/templates/room-canvas.svg` (created in Phase 0).
- Bleed areas may be cropped on some phones — only background continuation there.
- Keep the object placement from the portrait layouts in the room files as a starting point; moving objects is fine (hit areas are re-measured automatically, §6) as long as they stay in the safe zone and don't overlap.
- Leave a clear floor spot for the **character** (≈ 300 × 520 px at the room's anchor) — the character is drawn by the app on top.

## 3. Layers per location

| Layer | Content | Format |
|-------|---------|--------|
| `bg` | Walls, floor, windows, non-interactive furniture and decor. **Without** interactive objects. | PNG (opaque), full canvas |
| `<object>.<state>` | One file per interactive object **per visual state**, on a transparent full canvas at its exact position | PNG (RGBA), full canvas |
| `fg` (optional) | Decor that must appear **in front of** the character (e.g. a table edge, plant) | PNG (RGBA), full canvas |

- Full-canvas transparent layers mean no alignment work: everything stacks exactly. (Transparent areas compress to almost nothing after WebP conversion.)
- SVG is welcome instead of PNG for any layer (smaller, crisp); keep it flat (no filters/embedded fonts).
- Size after conversion: `bg` ≤ 250 KB WebP; each object state ≤ 30 KB.

**Naming:** `assets-src/rooms/<location>/<layer>.png`, e.g. `assets-src/rooms/bedroom/bg.png`, `assets-src/rooms/bedroom/alarm-clock.default.png`, `assets-src/rooms/bathroom/washing-machine.running.png`.

## 4. Object states to draw

Animations (spinning drum, steam, notes, glow) are done by the app with CSS on top of these drawings; where an animation needs a separate moving part it is listed as an extra layer.

| Location | Object (layer name) | States / extra layers |
|----------|--------------------|------------------------|
| Bedroom | `alarm-clock` | `default` (blank face — digits rendered by app) |
| | `wall-calendar` | `default` (blank page — date rendered by app) |
| | `bed` | `made`, `turned-down`, `slept` |
| | `wardrobe` | `closed`, `open` |
| | `desk-notebook` | `default` |
| | `medication-tray` | `full`, `partial`, `empty` |
| Kitchen | `refrigerator` | `default`, `empty` (door ajar) |
| | `recipe-book` | `default` |
| | `shopping-board` | `none`, `few` (1–3 notes), `many` (4+ notes) |
| | `dining-table` | `plates-0`, `plates-1`, `plates-2`, `plates-3` |
| | `cabinets` | `default` |
| Bathroom | `mirror-sink` | `fogged`, `clear` (+ extra `sparkle`) |
| | `cabinet` | `default` |
| | `bath-shower` | `curtain-open`, `curtain-closed` (+ extra `steam`) |
| | `washing-machine` | `idle`, `running`, `done` (+ extra `drum` for rotation) |
| | `laundry-basket` | `empty`, `some`, `full` |
| Entertainment | `television` | `off`, `on` (blank screen glow — title rendered by app) |
| | `game-console` | `led-off`, `led-on` |
| | `music-player` | `idle`, `playing` (+ extra `record` for rotation, `notes`) |
| | `art-supplies` (easel) | `blank`, `sketch` |
| | `bookshelf` | `trophies-none`, `trophies-some`, `trophies-many` |
| Study | `computer` | `off`, `on` (blank screen — text rendered by app) |
| | `planner` | `default` |
| | `bookshelf` | `default`, `book-out` |
| | `desk-planner` | `idle`, `active` (lamp on) |
| Gym | `bench-mat` | `default`, `done` (towel) |
| | `weights` | `default` |
| | `progress-board` | `default` (mini chart drawn by app) |
| Town | `grocery-shop` | `default` |
| | `clothing-shop` | `default` (mannequin drawn by app from clothing templates) |
| | `bank-atm` | `default` (screen text by app) |
| | `park` | `default` |
| | `map-sign` | `default` |

Total: 7 backgrounds + 33 objects with ~70 state drawings.

## 5. Character and clothing drawings

The wardrobe shows **drawings of the player's real clothes**: each real item is represented by a clothing template drawing recoloured by the app ([D-07](01-decisions.md#d-07-wardrobe-clothing-shop-and-laundry-model)). Therefore character and clothing must be **SVG** with recolourable fills.

| Asset | Requirements |
|-------|--------------|
| Canvas | 300 × 600 px SVG, feet centre at (150, 590), front view, `stand` pose |
| Body | One path group with fill `var(--skin)` (8 skin tones applied by the app); body shapes: minimum **1**; if 3 are delivered (a/b/c), every clothing template needs a variant per shape |
| Face | Neutral friendly expression + `face-blink` variant (eyes closed) for the blink animation |
| Hair | 8 styles (short, buzz, bob, long, curly, ponytail, bun, afro), each split into `back` and `front` layers, fill `var(--hair)` |
| Glasses | 1 drawing |
| Clothing templates | 30 SVGs: tshirt, longsleeve, shirt, blouse, sweater, hoodie, tank, jeans, trousers, shorts, skirt, leggings, joggers, dress, jumpsuit, jacket, coat, blazer, cardigan, raincoat, sneakers, boots, heels, sandals, loafers, cap, beanie, scarf, bag, watch. Main area fill `var(--garment)`; details (seams, folds) as darker translucent strokes so they work on all 16 colours |
| Wardrobe icon | Each template also used as a 120 × 120 icon (the app crops/scales the same SVG — no extra drawing needed if the garment reads well alone) |
| Layer order | back-hair, body, bottom, shoes, top/dress, outerwear, accessory, face, front-hair, glasses ([03 §17.3](03-ux-shell.md#173-character-art)) |

Naming: `assets-src/character/body.a.svg`, `face.default.svg`, `face.blink.svg`, `hair.bob.back.svg`, `hair.bob.front.svg`, `clothes/hoodie.a.svg`, …

## 6. Other graphics

| Asset | Requirements |
|-------|--------------|
| App icon | 1024 × 1024 PNG master; important content within the central 80 % (maskable). The app generates 512/192/180 sizes. |
| Empty-state illustrations | Optional; otherwise the object's own drawing is reused |
| UI icons | Not needed — the app uses its own simple line icon set |

Sounds are not part of the graphics package; placeholder CC0 sounds are used until replaced ([03 §17.4](03-ux-shell.md#174-sounds)).

## 7. Hand-off and integration (per location)

1. Owner delivers the folder for one location (e.g. `bedroom/`) — can be one location at a time, in any phase.
2. Developer copies it to `assets-src/rooms/<location>/`.
3. `python3 tools/prepare_art.py <location>` (Pillow): validates canvas size and naming, converts PNG → WebP, and **measures each object's bounding box** from its `default` layer → prints normalised `hitArea` values for `js/world/rooms/<location>.js`.
4. Update the room definition (hit areas, character anchor) and switch the room from placeholder to real art.
5. `python3 tools/hash_assets.py` → hashed files, asset manifest, SW immutable list.
6. Checks: `world.test.js` (inside safe zone, no overlaps), visual review at 360 × 640 and 430 × 932, room tour spotlights line up, every state renders.
7. Commit (English message, e.g. "Add final bedroom art") and note it in `CHANGELOG.md` under *Changed*.

Owner-side checklist before sending:
- [ ] Canvas 1440 × 1920, sRGB; interactive objects and character spot inside the safe zone.
- [ ] `bg` contains no interactive objects; each object state is a separate full-canvas transparent layer.
- [ ] All states from §4 for that location are present and named exactly.
- [ ] No text in the art.
- [ ] Licence: own work or a licence that allows use and modification in this app; noted in `assets-src/LICENSES.md`.
