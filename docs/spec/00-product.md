# 00 · Product

## 1. Vision

A mobile life-simulation app where everyday personal-organisation tools (alarms, calendar, tasks, groceries, budget, laundry, workouts…) are **physical objects inside a hand-drawn 2D home and town**. The player taps the fridge to manage food, the alarm clock to set an alarm, the ATM to see their budget. The illustrated room is the primary interface; conventional menus are secondary.

The character is the player's avatar ("adult Tamagotchi" concept): it lives in the scenes, wears the outfit chosen in the wardrobe and reflects the player's real routines.

> Product name: **Organized Life**. The PDF title "Adult Tamagotchi" is a concept name only — "Tamagotchi" is a registered trademark of Bandai and must not appear in the app name, manifest, icons or store listings (see [D-01](01-decisions.md#d-01-product-name)).

## 2. Product principles (from the PDF, made testable)

| # | Principle | Testable rule |
|---|-----------|---------------|
| P-1 | **The room is the interface** | Every feature is reachable by tapping an object in a scene. Menus (list view, quick action) are alternatives, never the only path. |
| P-2 | **Keep the world present** | Windows are bottom sheets; at least the top 12 % of the screen keeps showing the (dimmed) room. No full-screen pages for object windows. |
| P-3 | **One object, one clear purpose** | Each object opens exactly one window whose title is the object name and whose actions match the object's function. |
| P-4 | **Compact by default** | The most common action is visible without scrolling on a 375 × 667 screen. Tabs only when a window has more than one data set. |
| P-5 | **Persistent state** | Toggles, check-offs, quantities save immediately; forms save on explicit *Save*. Everything survives navigation and app restarts. |
| P-6 | **Visible feedback** | After a change, the object in the scene shows the new state (clock face time, fridge expiry badge, basket fill level…). |
| P-7 | **Accessible alternative** | A conventional list of all objects opens the same windows; touch targets ≥ 44 × 44 CSS px; text scales to 130 %; screen-reader labels on every object. |
| P-8 | **Leisure feels inviting** | Entertainment features have no overdue states, red badges or streak pressure. |
| P-9 | **Local-first and private** | All data stays on the device. No accounts, no analytics, no third-party requests in v1. |
| P-10 | **Portrait phone first** | Designed for 360–430 CSS px wide portrait screens. Landscape/desktop shows the same phone-width column. |

## 3. Scope

### 3.1 In scope for v1.0

- 7 locations: Bedroom, Kitchen, Bathroom, Entertainment room, Study (optional), Gym (optional), Town.
- 33 interactive objects with their windows (full list below).
- Shared UI: location button + map, character, optional next-task strip, quick action, object-focus feedback, sheet title/close/save, quiet autosave status.
- Character with customisable appearance and outfits.
- Linked systems: purchases update inventory and budget; recipes add missing ingredients to shopping; laundry loop; medication stock → refill suggestion; tasks ↔ calendar; study ↔ calendar.
- All locations available from the start, with a guided **room tour** on the first visit to each location.
- Local persistence (IndexedDB), schema migrations, JSON backup export/import, `.ics` export of calendar events.
- Alarms that ring **inside the game**, with a low-power **Nightstand mode** that keeps the app open overnight; other reminders delivered in-app with a missed digest.
- English UI with Russian as an option.
- PWA: installable, offline-capable, auto-updating, deployed by GitHub Actions to GitHub Pages; semver releases.

### 3.2 Explicitly out of scope for v1.0 (candidates for later)

| Item | Why deferred |
|------|--------------|
| Alarms or push notifications when the app is closed | By decision alarms live only in the game; push would require a server (GitHub Pages is static). See [D-06](01-decisions.md#d-06-reminders-and-alarms). |
| Final illustrations | Provided by the owner later; placeholders until then ([08-art-delivery.md](08-art-delivery.md)). |
| Native wrapper (Capacitor) | PDF suggests it; replaced by PWA for v1. Can be added later without rewriting UI. |
| Cloud sync / multi-device / accounts | Data model is sync-ready (`updatedAt`, soft deletes), sync itself is later. |
| External integrations (Google/Apple calendar sync, Health, bank APIs, step counters) | PDF: "integrations can come later". v1 offers `.ics` export only. |
| Nutrition database lookup | Manual entry in v1. |
| Audio streaming in the music player | Music player is a tracker, not a player. |
| Photos/attachments | Storage weight; later. |
| Character needs/mood simulation | Not in the PDF; proposed as optional later feature ([D-13](01-decisions.md#d-13-character-and-wellbeing)). |

## 4. Locations and objects (inventory)

| Location | Availability | Objects (PDF number → code) |
|----------|--------------|------------------------------|
| Bedroom | Open; start location on first launch | 1 Alarm clock `B1` · 2 Wall calendar `B2` · 3 Bed `B3` · 4 Wardrobe `B4` · 5 Desk / notebook `B5` · 6 Medication tray `B6` |
| Kitchen | Open from the start | 1 Refrigerator `K1` · 2 Recipe book `K2` · 3 Shopping board `K3` · 4 Dining table `K4` · 5 Kitchen cabinets `K5` |
| Town | Open from the start | 1 Grocery shop `T1` · 2 Clothing shop `T2` · 3 Bank / ATM `T3` · 4 Park / landmark `T4` · 5 Map sign `T5` |
| Bathroom | Open from the start | 1 Mirror / sink `BA1` · 2 Bathroom cabinet `BA2` · 3 Bath / shower `BA3` · 4 Washing machine `BA4` · 5 Laundry basket `BA5` |
| Entertainment room | Open from the start | 1 Television `E1` · 2 Game console `E2` · 3 Music player `E3` · 4 Art supplies `E4` · 5 Bookshelf `E5` |
| Study / University | Open from the start; can be hidden in Settings | 1 Computer `S1` · 2 Planner `S2` · 3 Bookshelf `S3` · 4 Desk planner `S4` |
| Gym / Workout area | Open from the start; can be hidden in Settings | 1 Workout bench / mat `G1` · 2 Weights `G2` · 3 Progress board `G3` |

First visit to each location runs its room tour: [05-cross-system.md §6](05-cross-system.md#6-location-availability-and-room-tours).

## 5. Glossary

| Term | Meaning |
|------|---------|
| Location / room | A full illustrated scene the player can be in. Town is an outdoor location; the term "room" is used for all of them in code (`roomId`). |
| Object | An interactive element in a scene with a hit area, label, action, linked data and visual state. |
| Window / sheet | The compact modal panel an object opens. Implemented as a bottom sheet. |
| Sheet page | A sub-view pushed inside the same sheet (e.g. "Edit alarm"). Sheets never stack on top of each other. |
| Safe zone | The 1080 × 1620 (2 : 3) area of a scene that is always fully visible; all hit areas live inside it. |
| Badge | A small state indicator drawn on an object (count, time, dot). |
| Feedback | The object's visual state + the short animation played after its data changes. |
| Next-task strip | Optional one-line banner under the top bar showing the most relevant upcoming item. |
| Room tour | Guided walkthrough on the first visit to a location: each interactive object is spotlighted with its name and purpose. |
| Nightstand mode | Low-power overnight screen (black, dim clock) that keeps the app open so in-game alarms can ring. |
| Quick action | The "+" button that opens fast-create shortcuts (task, event, meal, expense…). |
| Feature | A domain module (alarms, calendar, inventory…) that owns data, logic and windows. Several objects may open the same feature. |
| Reminder | Any time-based nudge (alarm, event reminder, dose, routine, laundry done…). |
| Minor units | Money stored as integer cents/kopecks to avoid floating-point errors. |

## 6. PDF traceability

Every statement in the source PDF and where it is specified.

| PDF page · section | Requirement | Spec location |
|--------------------|-------------|---------------|
| p1 Core principle | Each location is a complete illustrated scene; small objects open focused windows; room stays visible | [03 §3](03-ux-shell.md#3-scene-rendering), [03 §5](03-ux-shell.md#5-sheets-modal-windows) |
| p2 Core interaction model | Room is primary interface; menus secondary | P-1, [03 §9](03-ux-shell.md#9-all-objects-list-accessible-alternative) |
| p2 Interaction flow 1–4 | Enter room → tap object (small aligned hit area) → compact panel over scene → save & update object state | [03 §4](03-ux-shell.md#4-hit-areas-focus-and-feedback), [03 §5](03-ux-shell.md#5-sheets-modal-windows), [02 §5](02-architecture.md#5-state-store-and-persistence) |
| p2 Window rules | Keep world present; one purpose; compact; persistent state; visible feedback; accessible alternative | P-2…P-7, [03](03-ux-shell.md) |
| p2 Navigation | First launch in bedroom; persistent location control → compact map/list; short transition; restore last location; character visible; customisable via wardrobe or character panel | [03 §6](03-ux-shell.md#6-navigation-and-routing), [03 §11](03-ux-shell.md#11-character), [rooms/town.md T5](rooms/town.md) |
| p2 Shared UI | Location button, character, optional next-task strip, quick action, object-focus feedback, modal title/close/save, quiet autosave status | [03 §2](03-ux-shell.md#2-screen-anatomy-portrait) |
| p3–4 Bedroom | 6 objects + windows | [rooms/bedroom.md](rooms/bedroom.md) |
| p5–6 Kitchen | 5 objects + windows | [rooms/kitchen.md](rooms/kitchen.md) |
| p7–8 Bathroom | 5 objects + windows | [rooms/bathroom.md](rooms/bathroom.md) |
| p9–10 Entertainment | 5 objects + windows; "inviting, not an obligation dashboard" | [rooms/entertainment.md](rooms/entertainment.md), P-8 |
| p11–12 Study | 4 objects + windows; optional room | [rooms/study.md](rooms/study.md) |
| p13–14 Gym | 3 objects + windows; optional; manual tracking first | [rooms/gym.md](rooms/gym.md) |
| p15–16 Town | 5 objects + windows; buildings are objects | [rooms/town.md](rooms/town.md) |
| p17 Implementation blueprint | Separate scene coordinates and game data; object definition shape; same feature from several places | [02 §6](02-architecture.md#6-world-definition-rooms-and-objects), [02 §7](02-architecture.md#7-window-registry) |
| p17 Suggested stack | React+TS, Phaser, Capacitor, IndexedDB/Dexie, autosave, versioned migrations; cloud sync & integrations later | [D-02…D-05](01-decisions.md) (reconciled with no-build PWA), [04 §5](04-data-model.md#5-schema-versioning-and-migrations) |
| p17 Acceptance criteria | Full scenes; small accurate hit areas; overlays return to same state; persistence across restarts; linked systems; accessible list | [07 §3](07-roadmap.md#3-global-acceptance-criteria) |
| p17 Next step | Polish art in Figma, then vertical slice bedroom → alarm/calendar → persistence | [07 Phase 1](07-roadmap.md#phase-1--vertical-slice-v020) |

## 7. Deviations from the PDF (and why)

| # | PDF | This spec | Reason |
|---|-----|-----------|--------|
| DV-1 | Landscape scenes | Portrait scenes re-composed per room | Product requirement: vertical phone orientation. |
| DV-2 | React + TS + Phaser + Capacitor | Preact + htm (no build), SVG scenes, PWA | Deployment copies static files (no bundler); SVG + HTML buttons give accessible, crisp, testable hit areas. See [D-03](01-decisions.md#d-03-ui-technology-no-build). |
| DV-3 | Dexie | Own IndexedDB wrapper | No build step; small, fully controlled persistence layer. Dexie remains an option. |
| DV-4 | Several markers float with no drawn object (bedroom 6, kitchen 4, bathroom 5, entertainment 2/4/5, study 2/3, gym 3, town 4/5) | Every object gets a drawn prop in the portrait layout | Hit areas must align with a visible object (PDF rule). |
| DV-5 | Town scene contains an indoor window | Removed; Town gets sky, park, street | Wireframe template leftover. |
| DV-6 | "Small hit area" vs "generous touch targets" | Visual area matches the object; effective touch target ≥ 44 × 44 px | Resolves the conflict between two PDF rules. |
| DV-7 | "SAVE / DONE" footer on every window | Toggles autosave; forms have *Save*; footer button is *Done* | Avoids double-saving and lost changes. See [D-12](01-decisions.md#d-12-save-model). |
| DV-8 | Entertainment bookshelf = "collections, favourites, achievements" | Same + a *Books* tab | A bookshelf without books is confusing; zero extra data model cost. |
| DV-9 | Art supplies drawn on a wall shelf | Drawn as an easel | Recognisable at phone size. |
| DV-11 | "First room unlocked", "unlocked places" (implies progressive unlocking) | All locations open from the start; first visit to each runs a room tour | Owner decision 2026-10-17 ([D-09](01-decisions.md#d-09-location-availability-and-room-tours)). |
| DV-12 | Capacitor packaging (implies native alarms) | Alarms ring only in the open app; low-power Nightstand mode overnight | Owner decision 2026-10-17 ([D-06](01-decisions.md#d-06-reminders-and-alarms)). |
| DV-10 | Shopping board and grocery shop both "buy" | Board = list (+ *Finish shopping* for real-store trips); Grocery shop = in-app checkout. Both use the same checkout page. | One purchase flow, two entry points. |
