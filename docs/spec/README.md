# Organized Life — Implementation Specification

Status: **v1.1 (2026-10-17, owner answers applied)** · Source: [`designPDFdoc/Adult_Tamagotchi_Interactive_Room_Design.pdf`](../../designPDFdoc/Adult_Tamagotchi_Interactive_Room_Design.pdf) (17 pages, concept + wireframes)

This folder turns the concept PDF into an implementable specification for a **portrait-only, installable PWA** hosted on GitHub Pages. Every requirement from the PDF is traced to a section here; every gap or ambiguity in the PDF is resolved with a decision (owner-confirmed where marked; see [01-decisions.md](01-decisions.md)).

## How to read

| # | Document | What it answers |
|---|----------|-----------------|
| 0 | [00-product.md](00-product.md) | Vision, principles, scope, glossary, PDF traceability and the deviations from the PDF |
| 1 | [01-decisions.md](01-decisions.md) | Every architectural/product decision with alternatives, and the owner's answers to the open questions |
| 2 | [02-architecture.md](02-architecture.md) | Stack, repository layout, module contracts, store/IndexedDB, routing, scene engine, testing |
| 3 | [03-ux-shell.md](03-ux-shell.md) | Portrait screen anatomy, scene rendering and hit areas, sheets (modal windows), navigation, onboarding, list view, accessibility, i18n, visual system |
| 4 | [04-data-model.md](04-data-model.md) | All collections, fields, enums, seeds, migrations, backup format |
| 5 | [05-cross-system.md](05-cross-system.md) | Linked systems (purchases → inventory + budget, recipes → shopping, laundry loop…), reminder engine, next-task strip, achievements, unlocks |
| 6 | [06-pwa-release.md](06-pwa-release.md) | PWA manifest, service worker, GitHub Pages workflow, versioning, changelog, release procedure, git rules |
| 7 | [07-roadmap.md](07-roadmap.md) | Phases → releases, backlog with story IDs, Definition of Done, QA checklist, test plan |
| 8 | [08-art-delivery.md](08-art-delivery.md) | What the final graphics package must contain: canvas, layers, object states, character and clothing drawings, naming, hand-off steps |
| R | [rooms/](rooms/) | One file per location: portrait layout, object map with hit areas, every object window (fields, actions, states, acceptance criteria) |

Room files: [bedroom](rooms/bedroom.md) · [kitchen](rooms/kitchen.md) · [bathroom](rooms/bathroom.md) · [entertainment](rooms/entertainment.md) · [study](rooms/study.md) · [gym](rooms/gym.md) · [town](rooms/town.md)

Reference renders of the original (landscape) PDF scenes live in [reference/](reference/). They are used for object inventory and art direction only; **all layouts in this spec are portrait**.

## Key decisions at a glance

| Topic | Decision (recommended) |
|-------|------------------------|
| Platform | Installable PWA, portrait-only, GitHub Pages (`https://imrime.github.io/organized-life/`) |
| Build | **No build step**: static ES modules, copied as-is by the Pages workflow |
| UI | Preact + htm (one vendored file), scenes as inline SVG with HTML button hit areas |
| Storage | IndexedDB (own thin wrapper), all data local-first, JSON backup export/import |
| Modal windows | Bottom sheets over the dimmed room (room always visible above the sheet) |
| Alarms | Ring only inside the game; overnight the app stays open in a low-power **Nightstand mode** so the alarm can go off |
| Reminders | In-app delivery + "missed" digest; `.ics` export of calendar events (P2) |
| Rooms | All locations open from the start; the **first visit to each room runs a guided tour** of its interactive objects |
| Wardrobe | Drawings of the player's real clothes; the character's outfit is changed from the wardrobe |
| Languages | English by default, Russian as an option; code, comments, commits and developer docs in English |
| Name | **Organized Life** (never "Tamagotchi" — third-party trademark) |
| Graphics | Placeholders until the owner provides final art ([08-art-delivery.md](08-art-delivery.md)) |
| First milestone | Vertical slice: Bedroom → Alarm clock + Wall calendar → persistence (as the PDF recommends) |

## Conventions used in this spec

- **IDs.** Locations: `bedroom`, `kitchen`, `bathroom`, `entertainment`, `study`, `gym`, `town`. Objects: `<location>.<object-slug>` (e.g. `bedroom.alarm-clock`). Windows: `<feature>.<view>` (e.g. `alarms.main`). Collections: camelCase plural (e.g. `inventoryItems`).
- **Object codes** in room files: `B1…B6` bedroom, `K1…K5` kitchen, `BA1…BA5` bathroom, `E1…E5` entertainment, `S1…S4` study, `G1…G3` gym, `T1…T5` town. Numbers match the PDF markers.
- **Acceptance criteria** are numbered `AC-<code>-<n>` (e.g. `AC-B1-3`) and referenced from the roadmap.
- **Priority tags:** `MVP` = required for the room's release; `P2` = same phase if time allows, otherwise next phase; `Later` = post-1.0.
- **Coordinates** are normalised to the scene *safe zone* (0…1 of 1080 × 1620), see [03-ux-shell.md §3](03-ux-shell.md#3-scene-rendering).
- Words **must / should / may** follow RFC 2119 meaning.
