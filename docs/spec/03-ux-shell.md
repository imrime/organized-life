# 03 · UX shell, scenes and windows (portrait)

## 1. Design targets

| Target | Value |
|--------|-------|
| Reference viewport | 390 × 844 CSS px (iPhone 12–16), safe areas respected |
| Minimum viewport | 360 × 640 (small Android), 375 × 667 (iPhone SE) |
| Maximum column | 480 px wide; larger screens show the column centred on a neutral backdrop ([D-21](01-decisions.md#d-21-orientation-and-large-screens)) |
| Orientation | Portrait only (`manifest.orientation = "portrait"`) |
| Touch targets | ≥ 44 × 44 CSS px |
| Body text | 16 px at 100 % text size; never below 13 px for secondary text |

## 2. Screen anatomy (portrait)

```text
┌──────────────────────────────────────┐ ← env(safe-area-inset-top)
│ [📍 Bedroom ▾]        ✓ Saved   [⚙]  │ Top bar · 52 px
├──────────────────────────────────────┤
│ 💊 08:00 Vitamin D · Bedroom      ✕  │ Next-task strip · 40 px (optional, collapsible)
├──────────────────────────────────────┤
│                                      │
│                                      │
│            SCENE  STAGE              │ Stage · fills remaining height
│      (illustrated room, objects,     │   safe zone 2:3 always fully visible
│       character, badges)             │   art bleeds to the edges
│                                      │
│                                      │
├──────────────────────────────────────┤
│   [☰ Objects]     ( ＋ )     [🙂 Me]  │ Bottom bar · 64 px
└──────────────────────────────────────┘ ← env(safe-area-inset-bottom)
```

| Element | Behaviour |
|---------|-----------|
| **Location button** (top-left) | Shows current location icon + name + ▾. Opens the Map window (`map.main`). Long names truncate with ellipsis. |
| **Autosave status** (top-centre/right, quiet) | Hidden when idle. "Saving…" only if a write takes > 300 ms; "✓ Saved" for 1.5 s after a commit, then fades. "⚠ Not saved" persists until tapped (opens explanation). `aria-live="polite"`. |
| **Settings** (top-right ⚙) | Opens `settings.main`. Badge dot when an update was installed and not yet seen, or a backup is overdue (> 30 days, P2). |
| **Next-task strip** | One item (highest rank, see [05 §4](05-cross-system.md#4-next-task-strip)). Tap → navigate to the item's location and open its window/page. ✕ hides that item for today. Hidden entirely if there is nothing or the setting is off. Height animates in/out. |
| **Stage** | The scene ([§3](#3-scene-rendering)). |
| **Objects** (bottom-left) | Opens the accessible list of all objects (`world.list`). |
| **Quick action** (centre "+", 56 px circle, accent colour) | Opens `quick.main` ([§10](#10-quick-action)). |
| **Me** (bottom-right) | Opens the character panel (`character.main`), avatar thumbnail as icon. |

All bars use the sheet surface colour with 92 % opacity and a 1 px divider; the stage never sits under them.

## 3. Scene rendering

### 3.1 Coordinate system

```text
          art canvas 1440 × 1920 (3:4) — bleed for wide/tall stages
   ┌───────────────────────────────────────────┐
   │      180 px bleed      ┌──── 150 px bleed │
   │   ┌───────────────────────────────────┐   │
   │   │ SAFE ZONE 1080 × 1620 (2:3)       │   │
   │   │ (0,0) ─────────────────── (1,0)   │   │
   │   │   all hit areas, character,       │   │
   │   │   important props live here       │   │
   │   │ (0,1) ─────────────────── (1,1)   │   │
   │   └───────────────────────────────────┘   │
   │                         150 px bleed      │
   └───────────────────────────────────────────┘
```

- **Art canvas:** 1440 × 1920 px. SVG `viewBox="-180 -150 1440 1920"` so safe-zone pixel coordinates are `0…1080 × 0…1620`.
- **Safe zone:** 1080 × 1620 (aspect 2 : 3). Hit areas, badges, character and every *meaningful* prop must be inside it. Bleed only continues wall, floor, sky, ground and decor.
- **Normalised coordinates:** `hitArea = {x, y, width, height}` in 0…1 relative to the safe zone (e.g. `x: 0.73` = 788 px).

### 3.2 Fitting into the stage

```css
.stage        { position: relative; flex: 1; overflow: hidden; container-type: size;
                background: linear-gradient(var(--wall) 0 var(--floor-line-screen), var(--floor) 0); }
.safe-zone    { position: absolute; left: 50%; top: 50%; translate: -50% -50%;
                width: min(100cqw, 100cqh * 1080 / 1620); aspect-ratio: 1080 / 1620; }
.art-layer    { position: absolute; left: -16.667%; top: -9.259%; width: 133.333%; height: 118.519%; }
.hit-layer    { position: absolute; inset: 0; }               /* buttons positioned in % of the safe zone */
```

- The safe zone is scaled with *contain*; the art layer (bleed) covers the remaining stage on screens between 3 : 4 and ~9 : 21. Outside that, the stage background gradient (room wall/floor colours) fills the rest.
- Vertical alignment: centred. If the stage is taller than the art canvas (rare, tall phones without strip), the canvas is anchored to the bottom so the floor never floats.
- Text inside art is avoided (localisation); dynamic text (clock time, badges) is rendered by the hit layer in HTML.

### 3.3 Layers (bottom → top)

1. Stage background gradient (wall/floor colours).
2. Art layer: room SVG (placeholder) or WebP background + object sprites (final). Each object is a group `<g id="obj-bedroom.alarm-clock" data-state="…">`.
3. Character (paper-doll SVG, `pointer-events: none`).
4. Hit layer: one `<button>` per object, badges, optional hint markers.
5. Transition overlay (location change).

## 4. Hit areas, focus and feedback

### 4.1 Hit buttons
- One `<button class="hit" aria-label="{label}, {state text}" aria-describedby>` per object of the location, absolutely positioned at `hitArea` (percent of safe zone).
- Visual hit area = object bounds. If the rendered button is smaller than 44 × 44 px, a transparent `::before` expands the touch target symmetrically to 44 × 44 (never changes layout).
- Overlap: higher `z` wins; room files must avoid overlapping visual areas (CI check in `tests/unit/world.test.js`: no overlaps after 44 px expansion except where `allowOverlap` is set; all rects inside 0…1).
- Tab order: by `z` then top-to-bottom, left-to-right.

### 4.2 Object-focus feedback (PDF "object-focus feedback")
| Moment | Feedback |
|--------|----------|
| Pointer down | Object glows: 3 px accent outline following the rect with 12 px radius + soft halo; scale 0.98 (100 ms) |
| Release (tap) | Glow holds while the sheet opens (≤ 150 ms), object stays highlighted (outline at 60 % opacity) under the dimmed backdrop so the user sees which object is open |
| Keyboard focus | 3 px focus ring (`:focus-visible`), label tooltip above the object |
| After save + close | Object plays its `feedback` animation once (≤ 600 ms): e.g. clock digits flip, fridge badge pops, basket fill changes |
| Reduced motion | No scale/flip; instant state change + 300 ms opacity pulse |

### 4.3 Badges and visual states
- Badge component: pill 20 px high, min-width 20 px, positioned at the top-right corner of the hit rect (override per object with `badgeAnchor`).
- Tones: `neutral` (dark on light), `info` (blue-grey), `warn` (amber), `alert` (accent red). Leisure rooms never use `alert` ([P-8](00-product.md#2-product-principles-from-the-pdf-made-testable)).
- Visual states change the art (e.g. `data-state="running"` on the washing machine) and are defined per object in the room files.

### 4.4 Room tour and hints

**Room tour** — the learning process on the **first visit to each location** ([D-09](01-decisions.md#d-09-location-availability-and-room-tours)).

```text
┌──────────────────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  everything dimmed 70 %…
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┌──────────┐▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ calendar │▓▓▓│  …except the spotlighted object (glowing)
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓└──────────┘▓▓▓│
│▓▓┌───────────────────────────────┐▓▓▓│
│▓▓│ Wall calendar            2 / 6 │▓▓▓│  callout card (above or below the object)
│▓▓│ Your events, deadlines and     │▓▓▓│
│▓▓│ reminders by month or week.    │▓▓▓│
│▓▓│ [Skip tour]    [‹ Back] [Next ›]│▓▓▓│
│▓▓└───────────────────────────────┘▓▓▓│
└──────────────────────────────────────┘
```

| Aspect | Rule |
|--------|------|
| Trigger | First time a location is shown after onboarding (`settings.toursSeen` does not contain it). If the location was entered to open a window (deep link, next-task strip, quick action), the tour waits until that sheet is closed. |
| Steps | One step per interactive object, in the room's tab order: spotlight cut-out (object rect + 12 px padding, rounded) over a 70 % dim layer, object glow, callout card with **object name**, **one-sentence purpose** (from the PDF function text, i18n key `objects.<room>.<object>.desc`) and step counter "2 / 6". |
| Bedroom extras | The very first tour (bedroom) adds 4 shell steps at the end: location button (map), Objects list, Quick action "+", Me (character). |
| Final step | "That's everything in the Bedroom. Tap any object to start." [Got it]. |
| Controls | [Next ›], [‹ Back], [Skip tour]; tapping the spotlighted object = Next (it does **not** open the window during the tour); Escape = Skip. |
| Completion | Finishing or skipping adds the location to `settings.toursSeen` (one write). |
| Replay | Settings → Places → *Replay room tours* (clears `toursSeen`), and a "Tour" button in each location header of the Objects list (replays that room only). |
| Objects not built yet | During phased development they are still included, with "Coming soon" under the description. |
| Accessibility | The tour is a `role="dialog"` with live step text; focus moves to the card; works with VoiceOver/TalkBack; reduced motion → the spotlight jumps without animation. |
| Layout | Card placed below the object if it fits, else above; never covers the spotlight; max width 92 % of the column. |

**Hints layer** — "Show object hints" in Settings (default **off**): small dot markers like the PDF markers on every object, for players who prefer persistent cues.

## 5. Sheets (modal windows)

### 5.1 Anatomy

```text
┌──────────────────────────────────────┐
│░░░░░░░ dimmed room (≥ 12 % visible) ░│  backdrop: rgba(20,16,12,.45); tap = close
│░░░░░░░░░░░░ [object highlighted] ░░░░│
├──────────── ▬▬▬ ─────────────────────┤  drag handle (swipe down to close)
│ ‹  Alarm clock                    ✕  │  header: back (pages only), title = object name, close
│ [ Month | Week ]                     │  optional tabs / segmented control
├──────────────────────────────────────┤
│                                      │
│   scrollable body                    │
│                                      │
├──────────────────────────────────────┤
│ [ + Add alarm ]          [  Done  ]  │  sticky footer (secondary action left, primary right)
└──────────────────────────────────────┘
```

| Property | Rule |
|----------|------|
| Sizes | `compact`: height = content, max 60 dvh. `tall`: max 88 dvh. Both leave the top of the room visible. |
| Surface | `--sheet-bg` (#F8F6F1), radius 20 px top corners, shadow `0 -8px 24px rgba(0,0,0,.18)` |
| Open/close | Slide up 220 ms ease-out / down 180 ms; backdrop fade. Reduced motion: fade only. |
| Close triggers | ✕, tap backdrop, swipe down on handle/header, Escape, browser/Android Back |
| Dirty guard | If a page has unsaved form changes: confirm dialog "Discard changes?" [Keep editing] [Discard] |
| Focus | On open → title; focus trapped inside; on close → focus returns to the object's hit button |
| Semantics | `role="dialog" aria-modal="true" aria-labelledby=<title id>`; scene gets `inert` |
| Pages | Sub-views (edit/create/detail) push inside the sheet: header shows ‹ back; the sheet may grow from compact to tall. Pages from other features may be pushed (e.g. calendar → task edit page). |
| Loading | If the window module isn't loaded yet: sheet opens immediately with a skeleton |
| Footer | Root page: **Done** (closes). Form pages: **Save** (primary) + **Delete** (destructive, only when editing) |
| Keyboard (iOS) | Footer stays above the on-screen keyboard (`visualViewport` resize handling); focused field scrolled into view |

### 5.2 Standard controls (`js/ui/fields.js`, `js/ui/lists.js`)

| Control | Implementation notes |
|---------|----------------------|
| TextField / TextArea | Label above, helper/error below, max length counter when > 80 % used; TextArea autosizes |
| NumberField | `inputmode="decimal"`, locale-aware parsing (`,` or `.`), min/max |
| MoneyField | Currency symbol prefix, parses to minor units |
| Stepper | − value + ; long-press repeats; buttons 44 px; value tappable for direct entry |
| Select | Native `<select>` (reliable on mobile) styled |
| DateField / TimeField | Native `<input type="date|time">`, with quick chips where useful (Today, Tomorrow, +1 week) |
| DayToggles | 7 round toggles (week starts per setting) + presets (Once/Every day/Weekdays/Weekends) |
| Segmented / Tabs | Max 4 segments visible; remembers last tab per window (session) |
| Chips | Toggle chips for filters and tags; horizontal scroll |
| Toggle / Checkbox / CheckRow | CheckRow = full-row tap target with checkbox; strike-through when done |
| Rating | 5 stars, tap same star to clear; `aria-valuenow` |
| ColorSwatches | 12 preset colours, `aria-label` with colour name |
| ListRow | Leading icon/swatch, title, subtitle, trailing meta; tap = open; "⋯" button = actions menu (no hidden swipe-only actions) |
| EmptyState | Small illustration of the object, one sentence, primary button |
| SearchField | Filters in memory, debounce 150 ms |
| ProgressRing / ProgressBar / charts | SVG; numbers always also shown as text |

### 5.3 Toasts, dialogs, autosave
- **Toast:** bottom, above bottom bar, max 2 lines, 4 s (8 s if it has *Undo*), one at a time (queue). `role="status"`.
- **Confirm dialog:** centred card, used for destructive actions and discard guard. Destructive button is red and on the right.
- **Undo:** destructive single-item actions (delete, mark used, clear checked) delete immediately and offer *Undo*; bulk/irreversible actions (reset all data, import replace) use a confirm dialog instead.

### 5.4 Alarm overlay and Nightstand mode
- **Alarm overlay** (when an alarm fires in-app): full-height sheet over everything — big time, label, [Snooze n min] (secondary), [Dismiss] (primary, 64 px). Sound loops with 3 s fade-in; vibration pattern where supported; stops after 5 min → "Missed alarm" record.
- **Nightstand mode** — the low-power overnight mode that keeps the game open so its alarm can ring ([D-06](01-decisions.md#d-06-reminders-and-alarms)).

  ```text
  ┌──────────────────────────────────────┐
  │                                      │   pure black #000 (OLED pixels off)
  │                                      │
  │               06:58                  │   dim clock, #5A2E2E at ~35 % luminance
  │          ⏰ Alarm 07:00              │   moves a few px every 5 min (burn-in)
  │                                      │
  │                                      │
  │      🔌 Connect the charger           │   shown only if Battery API says unplugged
  │                                      │
  │        double-tap to exit            │
  └──────────────────────────────────────┘
  ```

  | Aspect | Rule |
  |--------|------|
  | Entry points | [🌙 Nightstand mode] in the Alarm clock window; [Go to sleep] in the Bed window (also records bedtime, F-8); bedtime prompt: if the app is open at `bedtime − windDownMin` and an alarm is set for the next morning, a banner offers [Start Nightstand mode] (setting `nightstandPrompt`, default on). The next-task strip after 20:00 shows "🌙 Alarm 07:00 — start Nightstand mode". |
  | Entry requirements | Must be started by a tap (user gesture): unlocks audio playback (silent 0.1 s sound) so the alarm can play later; requests **Screen Wake Lock** (re-acquired on `visibilitychange`). If Wake Lock is unavailable: card "Set Auto-Lock to *Never* for tonight, otherwise the phone will sleep and the alarm can't ring" with [OK]. |
  | Low-power behaviour | Switch `core/power.js` to `nightstand`: unmount scene, character, bars and sheets; stop all CSS animations and `requestAnimationFrame`; reminder engine keeps only the alarm timer ([02 §9](02-architecture.md#9-reminder-engine-architecture)); clock re-renders once per minute (timeout aligned to the minute); no storage writes, no network. Black background, small dim text, no gradients/blur/shadows. |
  | Battery hint | Where `navigator.getBattery()` exists (Chrome/Android), show "Connect the charger" while not charging; hidden on iOS (no API). The explainer always recommends sleeping with the phone on the charger and brightness lowered. |
  | Burn-in protection | Clock block shifts by up to ±12 px every 5 minutes. |
  | Alarm | At alarm time: screen switches to the alarm overlay at full brightness styling (sound with 3 s fade-in, Snooze / Dismiss). After **Dismiss**: leave Nightstand mode → "Good morning" card (F-8 sleep log prompt) → normal mode in the bedroom. **Snooze** returns to Nightstand mode. |
  | Exit | Double-tap or long-press (avoids accidental exits) → normal mode; if an alarm is still pending: toast "Your alarm rings only while the app is open." |
  | Interruptions | If the app is backgrounded/closed during the night (call, home button), the alarm cannot ring; on return before the alarm, Nightstand mode resumes automatically (state kept in memory/session); after the alarm time → "Missed alarm" in the strip. |
  | Quality gate | Overnight test (8 h) on iPhone and Android, on charger: alarm rings on time; Nightstand mode main thread idle in performance trace ([02 §10](02-architecture.md#10-performance-budgets)). |

### 5.5 Same window, many entry points
Every window can be opened from: its scene object, the Objects list, deep link, next-task strip, quick action (create pages), and cross-links from other windows (e.g. "Go shopping" on the board → Grocery shop). The window never assumes it was opened from its own room.

### 5.6 Window catalogue

| Window id | Opened by object(s) | Size | Root tabs |
|-----------|--------------------|------|-----------|
| `alarms.main` | B1 Alarm clock | compact | — |
| `calendar.main` | B2 Wall calendar | tall | Month · Week |
| `sleep.main` | B3 Bed | tall | Plan · Routine · Log |
| `wardrobe.main` | B4 Wardrobe | tall | category chips + Outfits |
| `tasks.main` | B5 Desk / notebook | tall | Tasks · Projects · Notes |
| `meds.main` | B6 Medication tray | tall | Today · Medications · History |
| `inventory.fridge` | K1 Refrigerator | tall | Fridge · Freezer |
| `recipes.main` | K2 Recipe book | tall | — (list → detail) |
| `shopping.main` | K3 Shopping board | tall | — (grouped list) |
| `diary.main` | K4 Dining table | tall | — (day view) |
| `inventory.pantry` | K5 Kitchen cabinets | tall | — (grouped list) |
| `routines.care` | BA1 Mirror / sink | compact | Morning · Evening |
| `inventory.bathroom` | BA2 Bathroom cabinet | tall | — |
| `routines.shower` | BA3 Bath / shower | compact | — |
| `laundry.machine` | BA4 Washing machine | compact | — |
| `laundry.basket` | BA5 Laundry basket | tall | group by Colour · Type |
| `media.screen` | E1 Television | tall | Watchlist · Watching · Watched |
| `media.games` | E2 Game console | tall | Playing · Backlog · Paused · Completed |
| `media.music` | E3 Music player | tall | Playlists · Albums · Favourites |
| `creative.main` | E4 Art supplies | tall | Ideas · In progress · Done |
| `media.shelf` | E5 Bookshelf | tall | Books · Collections · Favourites · Achievements |
| `study.main` | S1 Computer | tall | Modules · Assignments |
| `study.planner` | S2 Planner | tall | Timetable · Deadlines · Exams |
| `study.resources` | S3 Bookshelf (study) | tall | folders → Reading list · Resources · Notes |
| `focus.main` | S4 Desk planner | tall | — (timer + task list + log) |
| `workouts.today` | G1 Workout bench / mat | tall | Today · Plans |
| `workouts.library` | G2 Weights | tall | — (filters + list) |
| `workouts.progress` | G3 Progress board | tall | Consistency · History · Records · Trends |
| `shop.grocery` | T1 Grocery shop | tall | — (list + catalogue + basket) |
| `shop.clothing` | T2 Clothing shop | tall | category chips |
| `finance.main` | T3 Bank / ATM | tall | Overview · Transactions · Budget |
| `walks.main` | T4 Park / landmark | compact | Walk · History · Places |
| `map.main` | T5 Map sign, location button | compact | — |
| `world.list` | Objects button | tall | — |
| `character.main` | Me button | tall | — |
| `quick.main` | + button | compact | — |
| `settings.main` | ⚙ button | tall | — |
| `checkout.page` | page inside `shop.grocery` / `shopping.main` | (page) | — |

## 6. Navigation and routing

- **Map window** (`map.main`): two sections — *Home* (Bedroom, Kitchen, Bathroom, Entertainment, Study, Gym) and *Out* (Town). Each row: location thumbnail (64 × 96 portrait crop of the room art), name, short purpose, state: current (✓) or "New" (not visited yet, i.e. tour not seen). All locations are selectable. Hidden rooms (Study/Gym hidden in Settings) are listed under "Hidden places" with *Show* buttons.
- **Travel transition:** close sheet → overlay fades to the destination's wall colour (120 ms) → swap scene → fade out (180 ms) with a location-name banner for 900 ms. Total ≤ 300 ms of blocking. Reduced motion: instant swap + banner.
- **Restore:** `settings.lastLocationId` is written on every location change; launch restores it (PDF). Sheets are not restored on cold start.
- **Routes and history:** [02 §8](02-architecture.md#8-routing).

## 7. Onboarding and tutorial

First launch opens in the **Bedroom** (PDF). Steps are cards over the dimmed bedroom; steps 2–3 are skippable. All locations are already open ([D-09](01-decisions.md#d-09-location-availability-and-room-tours)).

| Step | Content | Writes |
|------|---------|--------|
| 1 Welcome | App name, one-sentence pitch, language: **English** (selected) / Русский, [Start] | `settings.language` |
| 2 You | Character name (optional), quick look picker (skin tone, hair) — defaults pre-selected | `profile/character` |
| 3 Basics | Currency (pre-selected from the device region), week start, 12/24 h (pre-selected from locale) | `settings` |
| 4 Bedroom tour | The room tour starts ([§4.4](#44-room-tour-and-hints)), including the shell steps; [Skip tour] available | `settings.toursSeen`, `settings.onboarding.done` |

Every other location runs its own tour on the first visit ([05 §6](05-cross-system.md#6-location-availability-and-room-tours)).

## 8. Next-task strip
Content and ranking: [05 §4](05-cross-system.md#4-next-task-strip). Format: icon · time (if any) · short text · location chip. Text truncates at one line. `aria-live="polite"` only when the item changes due to time (not on every render).

## 9. All objects list (accessible alternative)

- Sheet `world.list`, tall. Search field at top. Sections per location (current location first, then Map order); hidden rooms omitted. Each section header has a [Tour] button that replays that room's tour.
- Row: object icon, **name**, one-line function, current state text (same as badge/aria), chevron. Tap → opens the object's window over the current scene (no travel).
- Also lists system windows: Settings, Character, Map.
- Fully keyboard and screen-reader operable; this is the recommended path for VoiceOver/TalkBack users and is announced in Settings → Accessibility.

## 10. Quick action

Compact sheet with a 3-column grid of shortcuts (features of hidden rooms are omitted):

| Shortcut | Opens |
|----------|-------|
| Task | `tasks.main` → new task page |
| Event | `calendar.main` → new event page |
| Meal | `diary.main` → new meal page |
| Expense | `finance.main` → new transaction page (type expense) |
| Shopping item | `shopping.main` → quick add focused |
| Sleep | `sleep.main` → Log page |
| Medication taken | `meds.main` → Today (only shown when a dose is due) |
| Focus session | `focus.main` (Study enabled) |
| Workout | `workouts.today` (Gym enabled) |
| Walk | `walks.main` → start |

Saving from a quick-action page closes the sheet and stays in the current room (no travel); the owning object, if in the current room, plays its feedback animation.

## 11. Character

- Paper-doll SVG avatar ([§17.3](#173-character-art)); drawn in every scene at the room's `character.anchor` (feet position) and `height`; idle: breathing (4 s), blink (every 4–7 s random). Reduced motion: static.
- Wears `profile/character.equipped` (wardrobe items) — the most visible feedback of the wardrobe.
- **Character panel** (`character.main`): large preview; name; skin tone (8 swatches); hair style (8); hair colour (10); body shape (3 neutral silhouettes); glasses on/off; [Open wardrobe] link. Changes apply live; *Save* persists, *Cancel* reverts.
- The character is decorative in scenes (not tappable) — tap targets stay predictable.

## 12. Settings window (`settings.main`)

Sections (tall sheet, grouped list):

1. **Profile:** character name → opens character panel.
2. **Language & region:** Language (English — default / Русский), Currency (pre-selected from region), Week starts on (Monday/Sunday), Time format (24 h/12 h), Units (metric/imperial).
3. **Display:** Text size (S/M/L/XL), Reduce motion (System/On/Off), Show object hints, Next-task strip (On/Off).
4. **Places:** Show Study (On by default), Show Gym (On by default), Replay room tours.
5. **Alarms & reminders:** Alarm volume, Suggest Nightstand mode at bedtime (On), "How alarms work" explainer (alarms ring only while the app is open; use Nightstand mode overnight), Enable system notifications (optional; only helps while the app is open in the background on desktop/Android).
6. **Fitness:** My equipment (multi-select), Workouts per week goal, Weight unit (follows Units).
7. **Food:** Daily kcal target (optional).
8. **Data & backup:** Export backup (.json), Import backup (Replace/Merge), Export calendar (.ics, P2), Storage status (persistent: yes/no, used MB), Last backup date, Reset all data (type "RESET" to confirm).
9. **About:** app name, short description, privacy note ("All your data stays on this device"), licences, and footer **`v{VERSION} · build {BUILD}`** (e.g. `v0.2.0 · build 1a2b3c4d`; locally `v0.2.0 · build dev`). Tapping the version 5× shows developer info (schema version, record counts).

## 13. Empty, loading, error states

| State | Rule |
|-------|------|
| Empty | Every list has an EmptyState: object illustration, one friendly sentence, primary action (e.g. "Your fridge is empty. [Add food]") |
| Loading | Skeleton rows (no spinners > 300 ms) |
| Validation | Inline under the field, red text + icon, `aria-invalid`; Save disabled only when a required field is empty, otherwise Save shows errors |
| Storage failure | Toast + autosave status "⚠ Not saved" |

## 14. Accessibility

- WCAG 2.2 AA contrast for all UI text (art excluded except text-bearing badges).
- Every object: accessible name + state; every control labelled; icons have `aria-hidden` with adjacent text or `aria-label`.
- Focus visible everywhere; logical order; no keyboard traps except the sheet's intentional trap.
- Text size setting up to 130 % without truncating actions (sheets scroll).
- No information by colour alone (badges include text/icon).
- `prefers-reduced-motion` honoured (and overridable in Settings).
- Sounds never the only signal (alarm overlay is visual too).
- Objects list provides a non-spatial path to everything.
- Language attribute `<html lang>` updated on language switch.

## 15. Internationalisation

- **English is the default and source language**; Russian is an optional translation selected by the user (welcome screen or Settings). Default never switches automatically.
- `t(key, params)` with nested keys (`objects.kitchen.refrigerator`), ICU-lite plurals via `Intl.PluralRules` (`{count, plural, one {# item} few {# предмета} many {# предметов} other {# items}}` style resolved per language).
- Dates/times/numbers/currency via `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.RelativeTimeFormat`.
- Seeded data (products, exercises, categories, default routines, base clothes) store `seedKey`; display name = `record.name ?? t(seedKey)` so it follows the language until the user renames it.
- Missing key in `ru` → fallback to `en` + console warning in dev; a unit test asserts both dictionaries have identical key sets.
- Text expansion: layouts tolerate +35 % (Russian is longer than English).

## 16. Visual system

### 16.1 Tokens (`css/tokens.css`)

| Token | Value | Use |
|-------|-------|-----|
| `--ink` | `#2B2420` | text, art outlines |
| `--ink-2` | `#6B625B` | secondary text |
| `--sheet-bg` | `#F8F6F1` | sheets, bars (PDF window colour) |
| `--line` | `#DCCFC2` | dividers, borders |
| `--accent` | `#B83C48` | primary buttons, markers, focus glow (PDF red) |
| `--accent-ink` | `#FFFFFF` | text on accent |
| `--ok` | `#4F7A5A` | done/taken |
| `--warn` | `#C98A2B` | expiring, low stock |
| `--info` | `#5E7B8C` | neutral info badges |
| `--radius-s/m/l` | 8 / 12 / 20 px | controls / cards / sheets |
| `--space-1…6` | 4 / 8 / 12 / 16 / 24 / 32 px | spacing scale |
| `--z-stage/hit/bars/backdrop/sheet/dialog/toast/overlay` | 0 / 10 / 20 / 30 / 40 / 50 / 60 / 70 | stacking |

### 16.2 Room palettes (from the PDF wireframes)

| Location | Wall / sky | Floor / ground | Accent props |
|----------|-----------|----------------|--------------|
| Bedroom | `#E8D9D1` | `#C7AB91` | bed `#B56B71`, wood `#9C775B`, wardrobe `#B78C6A`, clock `#C99A50` |
| Kitchen | `#E1E6DD` | `#C8B898` | counter `#9DB09A`, recipe book `#B83C48`, fridge `#FFFFFF` |
| Bathroom | `#DDE7E6` | `#C9C3B8` | cabinet `#B78C6A`, bath `#FFFFFF`, machine `#E6E3DC` |
| Entertainment | `#EADCDF` | `#BBA898` | sofa `#B56B71`, TV `#2B2420`/`#A2C1C3`, speaker `#C99A50` |
| Study | `#E4E4EA` | `#BDB2A4` | desk `#A97B58`, monitor `#2B2420` |
| Gym | `#E1E7DF` | `#B8B5A2` | mat `#667E66`, iron `#2B2420` |
| Town | `#DDE7E6` | `#C4B19A` | grocery `#B83C48`, clothing `#667E66`, bank `#C99A50` |

### 16.3 Typography
System stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", sans-serif`. Sizes (at 100 %): title 20/26 semibold, section 15/20 semibold uppercase-free, body 16/22, secondary 14/20, caption 13/18, big numbers 40/44 (clock, timers, balance).

### 16.4 Motion
Durations: 120 ms (press), 180–220 ms (sheet), 300 ms (location), 600 ms (object feedback). Easing `cubic-bezier(.2,.8,.2,1)`. Only `transform` and `opacity` are animated.

## 17. Art and asset pipeline

Final graphics are **provided by the owner later**; the package format is defined in [08-art-delivery.md](08-art-delivery.md). Until a room's art arrives, it uses placeholder art (§17.1).

### 17.1 Placeholder art (until final art is delivered)
- One JS module per room in `js/scene/art/` exporting `renderArt(state)` → SVG markup string (flat shapes, 2 px `--ink` outlines, palette above), mirroring the PDF wireframe style but in portrait composition (see each room file).
- Each object group has `id="obj-<objectId>"`; state variants via `data-state` attribute + CSS (e.g. `[data-state="running"] .drum { animation: spin 1.2s linear infinite }`).
- Placeholder art must be good enough to recognise every object at 360 px width (simple iconic silhouettes, not just rectangles).

### 17.2 Final art (when delivered, room by room)
- Per room: `bg` (1440 × 1920, without interactive props) + one full-canvas transparent layer per object state (e.g. `washing-machine.running`) + optional `fg`; exact list and naming in [08 §3–4](08-art-delivery.md#3-layers-per-location).
- Source files in `assets-src/rooms/<room>/`; `tools/prepare_art.py` converts PNG → WebP and measures hit areas; `tools/hash_assets.py` writes `assets/rooms/<room>/<name>.<hash8>.<ext>` and updates `js/asset-manifest.js` + the immutable list in `sw.js`.
- Hand-drawn style: warm, slightly textured lines, muted palette above; objects must read clearly at 50 % scale.
- Licence: own work or licence permitting commercial use and modification; record in `assets-src/LICENSES.md`.

### 17.3 Character art
- SVG layers in order: `back-hair`, `body` (skin fill via CSS var), `bottom`, `shoes`, `top`/`dress`, `outerwear`, `accessory`, `face`, `front-hair`, `glasses`.
- Each clothing **template** (see [04 §3.12](04-data-model.md#312-clothing-wardrobe-laundry)) is a path set with `fill: var(--garment)`; colour comes from the item.
- Canvas 300 × 600, anchor at feet centre. Poses: `stand` (MVP); `sit` (Later).

### 17.4 Sounds
Alarm sounds: *Gentle chime*, *Birds*, *Classic beep*, *Rising tone*; UI: *Done chime* (focus end, laundry finished). 2–6 s loops, normalised to −16 LUFS, `.m4a` (AAC) for iOS + `.ogg` fallback. Own or CC0 only.

### 17.5 App icons
`icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (safe area 80 %), `apple-touch-icon-180.png`, `favicon.svg`. Motif: small house window with the character's face, accent red on bedroom wall colour.
