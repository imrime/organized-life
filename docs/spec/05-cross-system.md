# 05 · Linked systems, reminders, next-task strip, achievements, room tours

The PDF requires that "systems remain linked: purchases update inventory and budget; recipes can add missing ingredients to shopping". This file defines every cross-feature flow as one atomic `store.mutate()` (all-or-nothing, single *Undo*).

## 1. Matching rules (used by several flows)

- **Normalised name:** lowercase, trim, collapse spaces, strip punctuation, `ё→е`; compare equal strings. Product link (`productId`) wins over names when both sides have it.
- **Quantity comparison:** same unit or convertible (g↔kg, ml↔l). Not convertible (pcs vs g) → treat as "unknown" (shown as "~ check").
- **Inventory availability** for food = Σ quantities in `fridge`, `freezer`, `pantry` for the matched product/name.

## 2. Flows

### F-1 Checkout (Grocery shop / Finish shopping) — *purchases update inventory and budget*
Entry points: `shop.grocery` basket → *Checkout*; `shopping.main` → *Finish shopping (N checked)*. Both open the same `checkout.page`.

Input lines: `{productId|name, quantity, unit, priceMinor (line total), destination: 'fridge'|'freezer'|'pantry'|'bathroom'|'none', expiryDate?}`, plus `actualTotalMinor` (defaults to Σ lines), `accountId`, `date`.

Steps (one mutation, label "Checkout"):
1. Create/resolve `products` for new names; update `product.lastPriceMinor` (scaled to `defaultQty`).
2. Group lines by `product.financeCategoryId` → create one `transaction` per finance category (`type: expense`, `source: {type:'grocery', batchId}`). If `actualTotalMinor` ≠ Σ lines, distribute the difference proportionally across groups (rounding remainder to the largest group).
3. For each line with destination ≠ `none`: upsert `inventoryItems` — merge into an existing item with same product/name + location + unit + expiry (both empty counts as equal), else insert. Expiry default = `date + product.shelfLifeDays` when the user did not set one (shown pre-filled on the page, editable).
4. Auto-check matching unchecked `shoppingItems` (same product/name); if the bought quantity is less than listed, keep the item unchecked with the remaining quantity.
5. Result screen: "Bought N items · −23.40 €" + per-destination counts (Fridge +4, Pantry +2, Bathroom +1) + [Done]. Toast with *Undo* (10 s) reverts the whole batch.

Visible feedback: fridge/cabinets badges update; ATM balance changes; shopping board count drops.

### F-2 Recipe → shopping (*add missing items*)
`recipes.detail` → *Add missing (N)*: for each non-optional ingredient with missing quantity > 0 (scaled to selected servings): merge into an unchecked shopping item of the same product/name (increase quantity if units compatible, else add a separate line), else insert with `source: 'recipe', sourceId: recipe.id`, `shopCategory` from product (default `other`). Toast "Added 3 items to the shopping list" + *Undo* + *Open list*.

### F-3 Cook recipe (P2)
`recipes.detail` → *Cook*: confirm sheet lists deductions per ingredient (editable; unknown units default to "don't deduct") → decrement inventory (removing zero-quantity items without threshold) → create `meal` (mealType by time of day, `food = recipe.title`, `recipeId`) → `recipe.cookCount++`, `lastCookedAt = now`.

### F-4 Low stock / refill → shopping suggestions
- Inventory items with `lowStockAt` and stock level `low|out`, medications with `stock ≤ refillAt`, creative project materials with `have: false` appear in the shopping board's **Suggestions** section unless an unchecked shopping item already matches.
- *Add* (per row) or *Add all* inserts shopping items with `source: 'low_stock'|'refill'|'creative'`. Nothing is added automatically.
- Kitchen cabinets and bathroom cabinet windows show a banner "3 items running low — [Add to shopping list]" that performs *Add all* for that scope.

### F-5 Mark used (fridge/pantry/bathroom)
*Mark used* → sheet page: [Used all] or stepper amount; P2 toggle "Log as meal" (fridge/pantry only) → creates `meal`. Item at 0 → removed (or kept as "Out" when it has a threshold). *Undo* toast.

### F-6 Clothing purchase
`shop.clothing` → *Buy* (price, name, template, colour): insert `clothingItem` (`status: clean`, `isNew: true`, `priceMinor`, `purchasedAt`) + `transaction` (expense, Clothing category, `source: {type:'clothing', batchId}`) and link `transactionId`. Option *Buy & wear* also sets `character.equipped[slot]`. Wardrobe shows a "new" sparkle until opened.

### F-7 Laundry loop
```text
wardrobe: Mark as worn ─► status 'dirty' ─► laundry basket
basket:   select items ─► Add to load ─► load 'queued', items 'in_load'
machine:  Start ─► 'running' (finishesAt) ─► time passes ─► 'done' ─► Unload ─► items 'clean', washCount+1, extras deleted
```
- Items `in_load` cannot be equipped without confirmation; dirty items can be equipped with a warning.
- Load becomes `done` lazily: any read after `finishesAt` treats it as done (and persists `status:'done', finishedAt` on next mutation or app start).
- *Cancel load* returns its items to `dirty`.

### F-8 Sleep plan ↔ primary alarm
- If `sleepPlan.linkAlarm` is on, saving the plan upserts the primary alarm (`time = wakeTime`, `repeatDays = alarmDays`, `enabled = true`, label "Wake up").
- Editing the primary alarm's time in the Alarm clock window updates `sleepPlan.wakeTime` (and shows "Also updated your wake-up time").
- Turning the link off leaves the alarm as a normal alarm.
- Bedtime routine reminder = `bedtime − windDownMin`.
- **Go to sleep** (Bed window, MVP): sets `sleepPlan.pendingBedAt = now` and starts Nightstand mode ([03 §5.4](03-ux-shell.md#54-alarm-overlay-and-nightstand-mode)).
- **Good morning:** when the alarm is dismissed (or, without an alarm, on the first app open after `wakeTime`) and `pendingBedAt` is set → card "Good morning! Slept 23:40 → 07:00 (7 h 20 min)" with quality faces and [Save] / [Edit] / [Discard] → creates the `sleepLog` and clears `pendingBedAt`. Sleep logs are therefore created almost automatically.

### F-9 Medication taken → stock
*Taken* decrements `stock` by `dosePerIntake` (not below 0); undoing restores it. Crossing `refillAt` adds a refill suggestion (F-4) and a next-task strip item "Refill Vitamin D (5 left)".

### F-10 Tasks ↔ calendar
- Tasks with `dueDate` appear in the calendar as **virtual deadline items** (not stored as events). Tapping opens the task page inside the calendar sheet. Completing from the calendar is allowed (checkbox).
- Study assignments (tasks with `context: 'study'`) are also listed in `study.planner` → Deadlines.

### F-11 Study ↔ calendar
- Classes and exams are `events` (`kind: 'class'|'exam'`, `moduleId`). They are created from `study.planner` and shown in the wall calendar (colour = module colour). Editing from either place edits the same record.
- When Study is hidden in Settings: study events/tasks stay in the calendar and desk (data is never hidden), only the room is hidden.

### F-12 Focus session ↔ tasks
Ending a focus session offers [Mark task done]; the completion log lists sessions with their task. Total focus minutes per task are shown on the task page (study context).

### F-13 Walks, workouts → activity
Walks and completed workouts both count toward the Progress board's "Active days" in the consistency heatmap (walks shown in a lighter tone). PRs only from workouts.

### F-14 Shopping list → Grocery shop
`shopping.main` → *Go shopping* travels to Town and opens `shop.grocery` with the "From your list" section expanded.

## 3. Reminder engine

Delivery modes ([D-06](01-decisions.md#d-06-reminders-and-alarms)): **banner** (in-app toast-like card with action), **alarm** (ringing overlay), **system** (Notification API via the service worker registration — only if permission granted and the page is hidden but alive), **missed** (listed on next open).

| Source | Instance time | Mode | Action button | Missed handling |
|--------|---------------|------|---------------|-----------------|
| Alarm | `time` on `repeatDays` (or next occurrence if one-shot); rings **only while the app is open** — overnight in Nightstand mode | alarm | Snooze / Dismiss | "Missed alarm 07:00" in strip until noon |
| Calendar event | start − `reminderOffsetMin` (all-day: 09:00 − offset) | banner | Open | Listed in strip for 2 h after start |
| Task due | due date+time − offset (no time: 09:00 on due date) | banner | Open / Done | Overdue tasks always visible in strip ranking |
| Medication dose | each scheduled time | banner (sticky until acted on or 60 min) | Taken / Skip | Becomes "overdue" in strip; "missed" after the day ends |
| Routine | `reminderTime` on active days if not completed | banner | Open | Not listed as missed (no guilt) |
| Bedtime wind-down | `bedtime − windDownMin` on all days | banner | Open routine | — |
| Laundry | `finishesAt` | banner + done chime | Unload | Strip until unloaded |
| Focus | session end, break end | banner + chime | Start break / Back to work | Logged automatically |
| Expiring food/products | 09:00 daily digest if anything expires today/tomorrow | banner (digest) | Open fridge | Strip |
| Workout | 18:00 on scheduled plan days if not done (P2, off by default) | banner | Open | — |

Rules:
- Quiet hours: banners (not alarms) between `bedtime` and `wakeTime` are deferred to `wakeTime + 15 min`.
- De-duplication by instance key; snoozed alarms re-fire at `snoozedUntil`.
- Changing a source record (e.g. alarm time) invalidates future instance keys automatically (keys include the time).
- First time the user saves an alarm: one-time explainer "Alarms ring while Organized Life is open. Before sleeping, start Nightstand mode and put the phone on the charger." [Got it] [Try Nightstand mode].
- First time the user sets any other reminder: short note that reminders appear while the app is open and missed ones are listed on next open; optional *Enable notifications* (permission request) — never asked on first launch.

## 4. Next-task strip

Shows **one** item: the highest-ranked candidate not dismissed today. Recomputed on store change, every minute while visible, and on visibility change.

| Rank | Candidate | Text example | Opens |
|------|-----------|--------------|-------|
| 1 | Missed alarm (today, until 12:00) | ⏰ Missed alarm 07:00 | `alarms.main` |
| 2 | Medication dose due/overdue | 💊 08:00 Vitamin D · overdue | `meds.main` Today |
| 3 | Laundry finished, not unloaded | 🧺 Laundry is done | `laundry.machine` |
| 4 | Focus session / workout / walk in progress | ⏱ Focus 12:40 left | owning window |
| 5 | Event starting within 2 h | 📅 14:00 Dentist · in 45 min | `calendar.main` day |
| 6 | Overdue task (high priority first) | ✅ Overdue: Tax form | task page |
| 7 | Task due today | ✅ Today: Call grandma | task page |
| 8 | Routine whose reminder time passed today, not done | ✨ Evening routine | routine window |
| 9 | Food expiring today/tomorrow | 🥛 Milk expires today | `inventory.fridge` |
| 10 | Refill / low-stock suggestions count | 🛒 4 items running low | `shopping.main` |
| 11 | After 20:00: tomorrow's first alarm | 🌙 Alarm 07:00 — start Nightstand mode | starts Nightstand mode directly |

Ties → earlier time first. Tapping travels to the object's location (if not hidden) and opens the window/page; ✕ adds `{key, date: today}` to `settings.stripDismissed`.

## 5. Achievements

Evaluated after relevant mutations (debounced 1 s) by pure predicates in `features/achievements/model.js`. Unlock → toast with badge icon + shelf sparkle; listed in `media.shelf` → Achievements (locked ones show a hint, never a progress guilt bar beyond "3/10").

| Id | Name | Rule |
|----|------|------|
| `settled_in` | Settled in | Finish onboarding |
| `on_time` | On time | Save your first alarm |
| `planner` | Planner | 10 calendar events created |
| `well_rested` | Well rested | Sleep logged 7 days in a row |
| `task_tamer` | Task tamer | 50 tasks completed |
| `project_done` | Project finished | A project with ≥ 3 tasks fully completed |
| `glow` | Glow routine | 7-day streak on any care routine |
| `stocked` | Stocked up | 20 inventory items added |
| `no_waste` | No waste week | 7 consecutive days with ≥ 5 food items tracked and none expired |
| `home_cook` | Home cook | Cook 5 recipes (F-3) or add 5 recipes |
| `food_journal` | Food journal | Meals logged 7 days in a row |
| `list_master` | List master | 100 shopping items checked |
| `fresh_laundry` | Fresh laundry | 10 loads unloaded |
| `stylist` | Stylist | 5 outfits saved |
| `cinephile` | Cinephile | 10 films watched |
| `binge` | Binge-worthy | A series marked watched |
| `completionist` | Completionist | 5 games completed |
| `bookworm` | Bookworm | 5 books read |
| `mixtape` | Mixtape | A playlist with ≥ 10 tracks |
| `curator` | Curator | 3 collections created |
| `maker` | Maker | 3 creative projects finished |
| `deep_focus` | Deep focus | 10 focus sessions completed |
| `scholar` | Scholar | 10 assignments done |
| `first_rep` | First rep | First workout completed |
| `iron_habit` | Iron habit | 4 consecutive weeks meeting the weekly workout goal |
| `new_record` | New record | Any personal record set |
| `explorer` | Explorer | 10 walks logged |
| `wanderer` | Wanderer | Visit every visible location |
| `budget_keeper` | Budget keeper | A full month with spending ≤ total budget |

No achievements for medication adherence or weight ([D-23](01-decisions.md#d-23-achievements)).

## 6. Location availability and room tours

Owner decision ([D-09](01-decisions.md#d-09-location-availability-and-room-tours)): **every location is open from the start**; the learning happens through a **room tour on the first visit**.

| Location | Availability | Tour |
|----------|--------------|------|
| Bedroom | Open; start location on first launch | Runs at the end of onboarding; includes the 4 shell steps (map, Objects list, Quick action, Me) |
| Kitchen, Bathroom, Entertainment, Town | Open | Runs on first visit |
| Study, Gym | Open and shown by default; can be hidden via `settings.optionalRooms` | Runs on first visit while shown |

- Tour UI and rules: [03 §4.4](03-ux-shell.md#44-room-tour-and-hints). State: `settings.toursSeen`; replay from Settings or the Objects list.
- Not-yet-visited locations show "New" in the Map (no locks anywhere).
- Hiding Study/Gym removes them from the Map, Objects list and Quick action; their data stays in the desk, calendar and backups. Deep links to hidden rooms redirect ([02 §8](02-architecture.md#8-routing)).
- During phased development, the Map lists only locations that already ship; each new release adds its rooms (open, with their tours).
