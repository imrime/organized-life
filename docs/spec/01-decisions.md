# 01 · Decisions

Every decision has an **adopted option** and, where relevant, alternatives. `Adopted` means the rest of the spec is written against it; "confirmed by owner" marks decisions answered by the product owner on 2026-10-17 (see [§ Resolved questions](#resolved-questions-owner-answers-2026-10-17)). There are no open questions blocking implementation.

---

### D-01 Product name
- **Adopted (confirmed by owner 2026-10-17):** **"Organized Life"**, `short_name` **"Organized"**, cache prefix and repo slug `organized-life`.
- Rejected: "Adult Tamagotchi" — "Tamagotchi" is a Bandai trademark. The name lives only in `manifest.webmanifest`, `index.html` `<title>`, i18n key `app.name` and the release tag message.

### D-02 Platform and distribution
- **Adopted:** Installable **PWA**, portrait-only, hosted on **GitHub Pages** at `https://imrime.github.io/organized-life/`, deployed by GitHub Actions on push to `main`.
- Alternatives: (a) Capacitor native app (PDF) — gives reliable local notifications and store distribution, but adds native toolchains and store review; can wrap the same web code later; (b) both from day one — doubles QA.
- Consequence: web-platform limits on background alarms/notifications apply ([D-06](#d-06-reminders-and-alarms)).

### D-03 UI technology (no build)
- **Adopted:** Static **ES modules without a bundler**. UI components with **Preact + htm** from a single vendored file (`js/vendor/htm-preact-standalone-<version>.mjs`, ~13 KB). Scenes rendered as **inline SVG**; hit areas are real HTML `<button>` elements layered over the SVG.
- Why: the deployment format copies files as-is (`index.html, manifest, sw.js, css, js, icons, assets`) and local development is `python3 -m http.server`; 33 windows with forms and lists need a component model; HTML buttons give native focus, screen-reader labels and easy testing.
- Alternatives:
  - (a) **Vanilla DOM** — zero dependencies, but ~2× code for 33 stateful windows.
  - (b) **React + TypeScript + Vite** (PDF) — best tooling, but requires a build step: the Pages workflow would need `npm ci && npm run build` and `_site` = `dist/`. Switch cost: medium (components port 1:1 from Preact).
  - (c) **Phaser** for scenes (PDF) — canvas-based, ~1 MB, hit areas invisible to assistive tech. Not needed: scenes are static illustrations with tappable props.

### D-04 Type safety
- **Adopted:** JSDoc types + `// @ts-check` in every module + `jsconfig.json` (`checkJs: true`, `strict: true`). Editors type-check without a build. Optional CI step `npx tsc --noEmit -p jsconfig.json` later.
- Alternative: TypeScript sources — requires a build step (see D-03 b).

### D-05 Persistence
- **Adopted:** **IndexedDB** through an own thin wrapper (`js/core/db.js`, one object store per collection). On start all collections are loaded into an in-memory store; every mutation is written through in one IndexedDB transaction. Versioned data migrations. `navigator.storage.persist()` requested after onboarding. JSON backup export/import in Settings.
- Alternatives: (a) Dexie vendored (PDF) — nicer querying, +45 KB, not needed with in-memory queries; (b) localStorage — 5 MB cap, synchronous, rejected.
- Scale assumption: < 20 000 records total (years of personal use) — fits in memory comfortably.

### D-06 Reminders and alarms
Web constraint: a PWA cannot run code at a scheduled time while it is closed or the screen is locked; Notification Triggers were abandoned; Web Push needs a server.
- **Adopted (confirmed by owner 2026-10-17): alarms live only inside the game.**
  1. **Alarms ring in-app only** — while the app is open in the foreground. No export of alarms to the phone's clock or calendar.
  2. **Nightstand mode (low power)** is the intended way to sleep with an alarm: the app stays open all night on a black screen with a dim clock, the screen is kept on (Screen Wake Lock) and the app does almost no work, so the alarm can go off in the morning. Started from the Alarm clock, from the Bed ("Go to sleep") or from a bedtime prompt. Requirements: [03 §5.4](03-ux-shell.md#54-alarm-overlay-and-nightstand-mode).
  3. Other reminders (events, tasks, doses, routines…) are delivered **in-app** while open, plus a **missed digest** on next open.
  4. **`.ics` export of calendar events** only (P2), for people who want their phone calendar to alert them.
  5. A short explainer is shown the first time an alarm is saved: "Alarms ring while Organized Life is open. Before sleeping, start Nightstand mode and put the phone on the charger."
- Alternatives (later, not planned): Web Push via a serverless backend; Capacitor local notifications.

### D-07 Wardrobe, clothing shop and laundry model
- **Adopted (confirmed by owner 2026-10-17):** the wardrobe holds **drawings of the real clothes the player owns**. Each item (name, category, colour, care, clean/dirty status, optional price) is drawn from an **illustrated clothing template** (T-shirt, jeans, dress…) in the item's colour. The player changes what the character wears **from the wardrobe**. Clothing shop records a real purchase (price → bank). Laundry basket/washing machine operate on the same items.
- Rejected: cosmetics-only wardrobe; real clothes without drawings.

### D-08 Money
- **Adopted:** Manual ledger, **single currency** (setting, default from locale), integer minor units, one default account "Wallet" in MVP (multiple accounts P2). Monthly budgets with per-category limits, auto-copied to the new month.
- Alternatives: multi-currency (Later), bank sync (Later, needs backend and secrets).

### D-09 Location availability and room tours
- **Adopted (confirmed by owner 2026-10-17):** **all locations are open from the start** — no unlocking. First launch starts in the Bedroom. **The first time the player enters each location, a guided room tour** highlights every interactive object in turn (name + what it does), then hands control back. Tours can be skipped and replayed. Spec: [03 §4.4](03-ux-shell.md#44-room-tour-and-hints), [05 §6](05-cross-system.md#6-location-availability-and-room-tours).
- Study and Gym (optional in the PDF) are **visible by default** and can be **hidden** in Settings → Places (data is kept; hidden rooms disappear from the map and objects list).
- Rejected: progressive unlocking by quests; progression gated by points/streaks.

### D-10 Languages
- **Adopted (confirmed by owner 2026-10-17):** **English is the default and source language; Russian is an option** (welcome screen and Settings). No automatic switch to Russian. i18n from day one, all formatting through `Intl`. Code, comments, commit messages and developer docs in English.

### D-11 Window form factor (portrait)
- **Adopted:** **Bottom sheet** with drag handle, title, close ×, optional tabs, scrollable body, sticky footer. Heights: `compact` (fits content, max 60 dvh) and `tall` (max 88 dvh). The dimmed room stays visible above. Sub-views are pages inside the same sheet (stack with back arrow) — sheets never stack.
- Alternatives: centred card (PDF wireframe look) — less usable one-handed in portrait; full-screen pages — violates P-2.

### D-12 Save model
- **Adopted:**
  - Atomic actions (checkboxes, toggles, steppers, Taken/Skipped, Start/Finish) **save immediately** and show *Undo* where destructive.
  - Forms (create/edit pages) save on explicit **Save**; leaving with unsaved changes asks "Discard changes?".
  - Long text (notes) **autosaves** with 500 ms debounce.
  - Footer button of the root sheet page is **Done** (closes).
- Alternative: everything explicit Save — more taps, risk of lost check-offs.

### D-13 Character and wellbeing
- **Adopted (v1):** Character is a customisable **paper-doll avatar** (SVG layers) that appears in every scene and wears the equipped outfit. No hunger/energy stats.
- Proposal (Later, opt-in): "Wellbeing" mood derived from real data (sleep logged, meds taken, meals logged, routines) shown as character expression. Not in the PDF; must never shame the user; off by default.

### D-14 Art
- **Adopted (confirmed by owner 2026-10-17):** **final graphics will be provided by the owner later.** Until then the app uses **placeholder flat-vector SVG** in the PDF wireframe style, re-composed for portrait (each object is a separate SVG group with state classes). When art arrives it is integrated room by room (any phase): WebP backgrounds + object layers with states, as content-hashed immutable assets. Coordinates stay in room definition files, so art changes never touch feature code.
- What the art package must contain (sizes, layers, states, naming): [08-art-delivery.md](08-art-delivery.md).

### D-15 Testing
- **Adopted:** Domain logic in **pure modules** (no DOM, no IndexedDB) with a tiny dual-runtime test harness: `tests/index.html` (browser, works with `python3 -m http.server`) and `tests/run-node.mjs` (CI on GitHub runners). Manual QA checklist per release on iOS Safari (home-screen PWA) and Android Chrome. Playwright e2e is Later.
- Note: Node is not installed locally on the author's machine; local runs use the browser runner.

### D-16 Identifiers, dates and time
- **Adopted:** `crypto.randomUUID()` ids; local dates as `YYYY-MM-DD`; local wall-clock times as `HH:MM`; instants as ISO-8601 UTC strings; durations with explicit unit suffix (`durationMin`, `restSec`). Recurrence uses a reduced RRULE subset ([04 §2](04-data-model.md#2-shared-types)).

### D-17 Sync readiness
- **Adopted:** No sync in v1, but every record has `createdAt`, `updatedAt`, `deletedAt` (soft delete, purged after 30 days) so last-write-wins sync can be added later.

### D-18 Food diary nutrition
- **Adopted:** Manual entry: meal type, food, portion, optional kcal/protein/carbs/fat; daily summary aggregates what is entered; optional daily kcal target.
- Alternative (Later): Open Food Facts lookup (online API, no key needed).

### D-19 Music player
- **Adopted:** Tracker for tracks, albums, playlists, mood tags and notes; optional external link per item. No audio playback.

### D-20 Hit-area sizing and overlap
- **Adopted:** Visual hit area = object bounds from the room definition; effective touch target expanded invisibly to ≥ 44 × 44 CSS px; overlaps resolved by explicit `z` (higher wins); the character is decorative (`pointer-events: none`).

### D-21 Orientation and large screens
- **Adopted:** `"orientation": "portrait"` in the manifest. On landscape phones/tablets/desktop the app renders a centred portrait column (max-width 480 px, max-height 100 dvh) on a neutral backdrop. No landscape layouts.

### D-22 Privacy and security
- **Adopted:** No analytics, no third-party requests, strict CSP, user URLs opened with `rel="noopener noreferrer"` and only `http/https` schemes. Backup files contain sensitive data (medication, money) — warn on export. No secrets are needed in v1; if any appear later they live only in `.env.local` (git-ignored) or CI secrets.

### D-23 Achievements
- **Adopted:** Global rule-based achievements computed locally from data; shown in the Entertainment bookshelf; unlocked once with a small celebration. No achievements tied to medication adherence (avoid health pressure). Catalogue: [05 §5](05-cross-system.md#5-achievements).

### D-24 Theme
- **Adopted:** Light theme only in v1 (room art is light). Later: night tint for scenes after local sunset-ish time (21:00–06:00) + dark sheets.

### D-25 Fonts
- **Adopted:** System font stack (offline, zero weight). Text-size setting S/M/L/XL scales the root font size (0.9 / 1 / 1.15 / 1.3).
- Alternative: one rounded self-hosted font (e.g. Nunito, OFL) as an immutable asset in Phase 7.

---

## Resolved questions (owner answers, 2026-10-17)

| # | Question | Answer | Applied in |
|---|----------|--------|------------|
| Q-1 | Product name | **Organized Life** | D-01 |
| Q-2 | Currency | **Depends on the region** of the device locale (`uk-UA`/`ru-UA` → UAH, `de-DE` → EUR, `en-US` → USD; no region → EUR); pre-selected in onboarding, editable in Settings | [04 §3.1](04-data-model.md#31-profile-singletons) |
| Q-3 | Unlocking | **All rooms open at once**; first visit to each room runs a tour of its interactive objects | D-09 |
| Q-4 | Wardrobe | **Drawings of the real clothes the player owns**; the character's outfit is changed from the wardrobe | D-07 |
| Q-5 | Alarms | **Only in the game**; at night the open app runs a **low-power Nightstand mode** so it can stay open and the alarm can ring | D-06 |
| Q-6 | Languages | **English**, with **Russian as an option** | D-10 |
| Q-7 | Graphics | **Provided by the owner later**; placeholders until then | D-14, [08](08-art-delivery.md) |

Assumption made while applying Q-3 (change if needed): Study and Gym are shown by default and can be hidden in Settings.
