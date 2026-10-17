# 07 · Roadmap, backlog and quality

Phases follow the PDF's advice: build **one vertical slice (bedroom → alarm/calendar → persistence) before expanding to every room**. Each phase ends with a MINOR release ([06 §5](06-pwa-release.md#5-release-procedure)).

Size: **S** ≤ 0.5 day · **M** 1–2 days · **L** 3–5 days (one developer with AI assistance; for ordering, not commitments).

## 1. Phases overview

| Phase | Release | Content | Exit criteria |
|-------|---------|---------|---------------|
| 0 Foundation | v0.1.0 | Repo hygiene, PWA shell, SW, Pages workflow, versioning, core (db/store/i18n/router), sheet system, test harness | Deployed shell installs on iOS + Android, works offline, shows `v0.1.0 · build <sha8>` |
| 1 Vertical slice | v0.2.0 | Bedroom scene + room tour, Alarm clock with low-power Nightstand mode, Wall calendar, reminder engine core, objects list, settings basics | AC-B1-*, AC-B2-*, GA-1…4 & GA-6 for the bedroom |
| 2 Bedroom complete | v0.3.0 | Bed (Go to sleep → Good morning), Desk, Medication tray, Wardrobe + character, next-task strip, quick action, onboarding, backup | AC-B3…B6-*, strip + quick action + onboarding stories |
| 3 Kitchen + Town economy | v0.4.0 | Fridge, Pantry, Shopping board, Recipes, Dining table, Grocery shop + checkout, Bank, Map sign, room tours for both locations | AC-K*, AC-T1, AC-T3, AC-T5, GA-5 |
| 4 Bathroom + laundry | v0.5.0 | Mirror, Cabinet, Shower, Washing machine, Laundry basket, Clothing shop, Park | AC-BA*, AC-T2, AC-T4 |
| 5 Entertainment | v0.6.0 | TV, Console, Music, Art supplies, Bookshelf, achievements | AC-E* |
| 6 Optional rooms | v0.7.0 | Study (4 objects), Gym (3 objects) | AC-S*, AC-G* |
| 7 Polish → 1.0 | v0.8.0 … v1.0.0 | Remaining owner-provided art, P2 backlog, a11y/perf audits, RU review, full regression | All GA-* and all MVP ACs |

Owner-provided graphics ([08-art-delivery.md](08-art-delivery.md)) can be integrated **in any phase** as soon as a room's package arrives (story ART-<room>, size M per room).

## 2. Backlog

### Phase 0 — Foundation (v0.1.0)

| ID | Story | Size | Acceptance |
|----|-------|------|------------|
| F0-01 | Repo hygiene: `.gitignore`, local noreply git identity, `README.md`, `jsconfig.json`, secrets scan | S | [06 §6, §8](06-pwa-release.md#6-development-workflow-rules) done; scan clean |
| F0-02 | `index.html`, `manifest.webmanifest`, placeholder icons, `sw.js`, `sw-register.js` | M | Lighthouse "installable"; offline reload works on https; no SW on localhost |
| F0-03 | `.github/workflows/pages.yml` + repo settings | S | Push to `main` deploys; `CACHE`/`BUILD` substituted (grep guards) |
| F0-04 | `js/version.js`, `CHANGELOG.md`, Settings → About footer | S | Footer shows `v0.1.0 · build <sha8>` on Pages, `build dev` locally |
| F0-05 | `tools/check_sw_assets.py`, `tools/hash_assets.py` | M | Check fails when a JS file is missing from `ASSETS`; hashing regenerates manifest + SW block idempotently |
| F0-06 | Test harness (browser + Node), first tests for `time.js`, `money.js` | M | `tests/index.html` green; `node tests/run-node.mjs` green in CI |
| F0-07 | Core: `db.js`, `store.js` (mutate/undo/subscribe), `schema.js` (all stores), `migrations.js`, `seed.js`, `i18n.js` (EN/RU), `time.js`, `money.js`, `units.js`, `text.js`, `ids.js`, `bus.js` | L | Store tests (browser): atomic multi-store write, rollback on failure, undo, reload persistence |
| F0-08 | Shell UI: app layout, top bar, bottom bar, autosave status, stage + safe zone, sheet host (pages, dirty guard, back button), toasts, dialogs, router | L | [03 §2, §3, §5](03-ux-shell.md) behaviours on 360×640 and 430×932 |
| F0-09 | `docs/DEVELOPMENT.md` | S | Sections from [06 §7](06-pwa-release.md#7-docsdevelopmentmd-to-be-written-in-phase-0) |

### Phase 1 — Vertical slice (v0.2.0)

| ID | Story | Size | Acceptance |
|----|-------|------|------------|
| P1-01 | World model: `locations.js`, `objects.js`, `rooms/bedroom.js` (all 6 objects; not-yet-built ones open a "Coming soon" compact sheet with the PDF function text) | S | `world.test.js`: rects inside safe zone, no overlaps after 44 px expansion |
| P1-02 | Bedroom placeholder art (portrait SVG), hit layer, focus feedback, badges, hints | M | [03 §4](03-ux-shell.md#4-hit-areas-focus-and-feedback) |
| P1-03 | Character placeholder (paper-doll base + 4 seeded clothes) | M | Character visible at anchor, idle animation, reduced motion respected |
| P1-04 | Alarm clock B1 + alarm overlay | L | AC-B1-1…7 |
| P1-04a | Low-power Nightstand mode (`core/power.js`, wake lock, audio unlock, minute clock, burn-in shift, battery hint, double-tap exit) | M | AC-B1-8, AC-B1-9; overnight device test |
| P1-10 | Room tour engine (spotlight, callout, steps, skip/replay, `toursSeen`) + bedroom tour content incl. shell steps | M | [03 §4.4](03-ux-shell.md#44-room-tour-and-hints); first bedroom visit runs it once |
| P1-05 | Reminder engine core (alarms, events) + missed digest | M | Engine unit tests (instances, de-dup, snooze, quiet hours) |
| P1-06 | Wall calendar B2 (month/week, recurrence, reminders) | L | AC-B2-1…5 |
| P1-07 | Objects list (`world.list`) + Map window (bedroom only) | S | GA-6 for bedroom |
| P1-08 | Settings basics: language, time format, week start, text size, reduce motion, hints, about | M | Changes apply live and persist |
| P1-09 | Persistence & migration check: restart retains state; migration framework test with a fake v2 | S | GA-4 for the slice |

### Phase 2 — Bedroom complete (v0.3.0)

| ID | Story | Size | Acceptance |
|----|-------|------|------------|
| P2-01 | Routines engine (shared by bed, mirror, shower): runs, streaks, history | M | Streak unit tests incl. inactive days |
| P2-02 | Bed B3 (plan, routine, log; F-8 link to alarm; Go to sleep → Nightstand → Good morning log) | M | AC-B3-1…5 |
| P2-03 | Desk B5 (tasks, projects, notes) + virtual tasks in calendar (F-10) | L | AC-B5-1…5 |
| P2-04 | Medication tray B6 (+ F-9 stock) | L | AC-B6-1…5 |
| P2-05 | Clothing templates + paper-doll renderer + Wardrobe B4 + Character panel | L | AC-B4-1…4, character panel saves/reverts |
| P2-06 | Next-task strip ([05 §4](05-cross-system.md#4-next-task-strip)) | M | Ranking unit tests; tap travels + opens; dismiss for today |
| P2-07 | Quick action ([03 §10](03-ux-shell.md#10-quick-action)) | S | Shortcuts open create pages over the current room |
| P2-08 | Onboarding steps 1–4 ([03 §7](03-ux-shell.md#7-onboarding-and-tutorial)) ending in the bedroom tour | M | Fresh install flow in English; Russian selectable; currency pre-selected from region |
| P2-09 | Backup export/import (replace/merge), storage status, `storage.persist()` | M | Export → reset → import restores all data; invalid files rejected with summary |
| P2-10 | Alarm and reminders explainers, optional notification permission; reminder sources: tasks, meds, routines, wind-down; bedtime Nightstand prompt | M | [05 §3](05-cross-system.md#3-reminder-engine) rows for these sources |

### Phase 3 — Kitchen + Town economy (v0.4.0)

| ID | Story | Size | Acceptance |
|----|-------|------|------------|
| P3-01 | Kitchen + Town placeholder art and room definitions; travel transition; room tours for both | M | AC-T5-1…4 |
| P3-02 | Products catalogue (seed ~70, auto-create, autocomplete) | M | Dedup by normalised name |
| P3-03 | Inventory feature: Fridge K1 + Pantry K5 (scopes, stock levels, mark used, merge rules) | L | AC-K1-*, AC-K5-* |
| P3-04 | Shopping board K3 (+ suggestions F-4) | M | AC-K3-1…3 |
| P3-05 | Recipe book K2 (+ F-2 add missing) | L | AC-K2-* |
| P3-06 | Dining table K4 | M | AC-K4-* |
| P3-07 | Finance: Bank/ATM T3 (accounts, categories, transactions, budgets) | L | AC-T3-* |
| P3-08 | Checkout page + Grocery shop T1 + *Finish shopping* (F-1) | L | AC-T1-*, AC-K3-4, GA-5 |
| P3-09 | Expiry digest reminder source | S | 09:00 digest when items expire today/tomorrow |

### Phase 4 — Bathroom, laundry, clothing shop, park (v0.5.0)

| ID | Story | Size | Acceptance |
|----|-------|------|------------|
| P4-01 | Bathroom placeholder art + definition + room tour | S | Tour runs on first visit |
| P4-02 | Mirror/sink BA1 + Bath/shower BA3 (routines reuse) | M | AC-BA1-*, AC-BA3-* |
| P4-03 | Bathroom cabinet BA2 (inventory scope `bathroom`, PAO) | S | AC-BA2-* |
| P4-04 | Laundry: basket BA5 + washing machine BA4 (F-7) + laundry reminder | L | AC-BA4-*, AC-BA5-* |
| P4-05 | Clothing shop T2 (F-6) | M | AC-T2-* |
| P4-06 | Park T4 (walks, places) | M | AC-T4-* |

### Phase 5 — Entertainment (v0.6.0)

| ID | Story | Size | Acceptance |
|----|-------|------|------------|
| P5-01 | Entertainment placeholder art + definition + room tour | S | Tour runs on first visit |
| P5-02 | Media feature core (shared item page per kind) + Television E1 + Game console E2 | L | AC-E1-*, AC-E2-* |
| P5-03 | Music player E3 (tracks, albums, playlists, moods) | M | AC-E3-* |
| P5-04 | Art supplies E4 (creative board, materials → shopping) | M | AC-E4-* |
| P5-05 | Bookshelf E5: books, collections, favourites | M | AC-E5-1, 2, 4 |
| P5-06 | Achievements engine + catalogue + shelf tab + toasts | M | AC-E5-3; predicate unit tests |

### Phase 6 — Optional rooms (v0.7.0)

| ID | Story | Size | Acceptance |
|----|-------|------|------------|
| P6-01 | Show/hide Study and Gym (Settings → Places, Map *Show*) | S | Rooms appear/disappear without data loss |
| P6-02 | Study placeholder art + definition + room tour; Computer S1; Planner S2 | L | AC-S1-*, AC-S2-* |
| P6-03 | Study bookshelf S3; Desk planner S4 (focus timer) | M | AC-S3-*, AC-S4-* |
| P6-04 | Gym placeholder art + definition + room tour; exercise seeds; Weights G2 | M | AC-G2-* |
| P6-05 | Workout bench G1 (plans, sessions, rest timer) | L | AC-G1-* |
| P6-06 | Progress board G3 (charts, PRs, heatmap) | M | AC-G3-* |

### Phase 7 — Polish → 1.0

| ID | Story | Size |
|----|-------|------|
| P7-01 | Integrate any remaining owner-provided art (rooms, character, clothing drawings, icons) via the hash pipeline | M per room |
| P7-02 | P2 items: Cook recipe (F-3), shopping quick parser, Mark used → meal, `.ics` export of calendar events, multiple accounts, workout reminders | L |
| P7-03 | Accessibility audit (VoiceOver, TalkBack, keyboard), fixes | M |
| P7-04 | Performance audit against [02 §10](02-architecture.md#10-performance-budgets) | M |
| P7-05 | Russian copy review, plural forms, text expansion fixes | S |
| P7-06 | Full regression on device matrix → v1.0.0 | M |

### Later (post-1.0 candidates)
Web Push backend (serverless) · Capacitor wrapper · cloud sync · calendar/health integrations · Wellbeing mood ([D-13](01-decisions.md#d-13-character-and-wellbeing)) · night tint / dark sheets · photos · multi-currency · Ukrainian UI · Playwright e2e · character `sit` pose and walk-to-object animation.

## 3. Global acceptance criteria

From the PDF (p17), made measurable, plus PWA criteria:

| ID | Criterion | How verified |
|----|-----------|--------------|
| GA-1 | Every room opens as a full scene with furniture and decor; the safe zone is fully visible on viewports 360×640 … 430×932 | Manual on device sizes; screenshot review |
| GA-2 | Each object has a small accurate hit area aligned with its art and a clear action; effective touch target ≥ 44 px; no overlaps | `world.test.js` + manual tap test |
| GA-3 | Windows overlay the room; closing returns to the same room, same state, focus back on the object | Manual + sheet tests |
| GA-4 | Changes persist across navigation and app restarts | Store tests + QA step 4 |
| GA-5 | Systems remain linked: purchases update inventory and budget; recipes add missing ingredients to shopping | AC-T1-1, AC-K2-3 |
| GA-6 | A conventional accessible list offers an alternative to tapping objects | `world.list` + screen-reader pass |
| GA-7 | Works offline after first load (installed, airplane mode) | QA step 8 |
| GA-8 | New deploys are picked up on next launch; version and build shown in Settings | QA step 9 |
| GA-9 | English and Russian UI complete (no missing keys) | i18n key-parity unit test |
| GA-10 | Performance budgets met | P7-04 audit |

## 4. Definition of Done (every story)

- [ ] Acceptance criteria demonstrated at 390×844 (devtools) — and on a real phone for MINOR releases.
- [ ] `model.js`/`selectors.js` logic covered by unit tests; all tests green in browser and Node.
- [ ] No hard-coded UI strings; EN + RU keys added.
- [ ] Accessible names, focus order and contrast checked for new UI.
- [ ] Data persists across reload; *Undo* where the spec requires it.
- [ ] New JS/CSS files added to `ASSETS` (`check_sw_assets.py` passes); new art through `hash_assets.py`.
- [ ] `CHANGELOG.md` → `[Unreleased]` updated (Added/Changed/Fixed).
- [ ] No console errors/warnings; JSDoc types clean in the editor.
- [ ] Commit message in English, local commit only.

## 5. Manual QA checklist (per release)

1. Fresh start (clear site data) → onboarding (English default, switch to Russian works) → bedroom tour; *Skip tour* also works; each newly released room runs its tour once on first visit.
2. Install to home screen (iOS Safari, Android Chrome); standalone launch; portrait lock; safe areas correct (notch, home indicator).
3. Every object of released rooms opens its window; close via ✕, backdrop, swipe down, Android back, Escape (desktop).
4. Create / edit / delete in each new window; force-quit and relaunch; data intact.
5. Linked flows of the release (see [05 §2](05-cross-system.md#2-flows)) incl. *Undo*.
6. Reminder 2 minutes ahead with the app open → banner; close app, reopen after the time → missed item in the strip.
7. Overnight: *Go to sleep* → Nightstand mode on the charger for ≥ 6 h (iOS + Android) → alarm rings on time, Snooze works, Dismiss shows "Good morning" and saves the sleep log. Note battery level before/after.
8. Airplane mode → app launches and all released features work; changes persist.
9. Deploy a new build → relaunch → Settings shows new version/build; no stale code.
10. Text size XL + VoiceOver/TalkBack quick pass on new windows; reduce motion on.
11. Switch RU ↔ EN on new windows; plurals and dates correct.
12. Backup export → Reset all data → Import → everything restored.

## 6. Test plan summary

| Level | Scope | Tooling | When |
|-------|-------|---------|------|
| Unit | `core/time`, `money`, `units`, `text`, recurrence, migrations, every feature `model.js`/`selectors.js`, reminder collection, next-task ranking, achievements predicates, world geometry, i18n key parity | `tests/harness.js` (browser + Node) | Every commit (CI on push) |
| Store integration | IndexedDB atomicity, rollback, undo, purge, backup round-trip | Browser runner, test DB | Before each release |
| Manual QA | §5 checklist | iPhone (iOS 17/18) home-screen PWA, Android Chrome (Pixel/Samsung), desktop Chrome | Each MINOR release |
| E2E (Later) | Vertical slice, checkout, laundry loop | Playwright | Post-1.0 |

## 7. Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| iOS evicts storage of non-installed sites | Data loss | Encourage install; `storage.persist()`; backup reminders (Settings badge after 30 days); export/import |
| Alarms only ring while the app is open (owner decision) | Missed alarm if the app is closed or the phone locks | Low-power Nightstand mode with wake lock, bedtime prompt, clear explainer, missed digest; overnight device test every MINOR release |
| Screen on all night | Battery drain / burn-in | Black OLED screen, minimal wake-ups, charger hint, pixel shift |
| Scope: 33 windows | Delays | Phasing; shared components and features (inventory ×3, routines ×3, media ×5, tasks ×2) |
| Art arrives late | Visual quality | Placeholder art first; coordinates isolated in room files; delivery spec in [08](08-art-delivery.md); art integrated room by room whenever it arrives |
| No-build ergonomics | Type errors at runtime | JSDoc + `checkJs`; small pure modules; unit tests |
| Public repo | Exposure of personal info/secrets | Secret scan, noreply identity, no personal data in fixtures |
| Safari quirks (time inputs, audio autoplay, wake lock) | Broken controls | Feature detection, user-gesture audio unlock, QA on real iPhone each release |
