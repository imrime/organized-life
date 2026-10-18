# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.0] - 2026-10-18
### Added
- Entertainment room is open, with a room tour and placeholder portrait art. It has no overdue states, red badges or reminders on purpose.
- Television: films and series across Watchlist, Watching and Watched; +1 episode, ratings, where to watch, notes; "What should I watch tonight?" picks from the watchlist; the TV shows what you're watching.
- Game console: Playing, Backlog, Paused, Completed (and Dropped) with platform filters, hours played and "Pick something to play"; the console light is on while you play.
- Music player: a tracker (no audio) for playlists with ordered tracks and moods, albums and favourites; "Now playing" spins the record player.
- Art supplies: creative project board (Ideas, In progress, Done) with the next step on each card, materials checklist, missing materials to the shopping list (also offered as shopping suggestions), "Inspire me".
- Bookshelf: books (To read, Reading, Read with page progress), collections mixing any media and projects, favourites by kind, and achievements.
- Achievements: 29 achievements across the whole home, checked a second after changes; one toast per batch, trophies on the bookshelf and a sparkle until you look.

### Changed
- Shopping items ticked off or bought are counted for the "List master" achievement.

## [0.5.0] - 2026-10-18
### Added
- Bathroom is open, with a room tour and placeholder portrait art.
- Mirror / sink: morning and evening care checklists with streaks and a 14-day history; the mirror fogs until the current routine is done.
- Bath / shower: care habits with "Done today", schedule, reminders and "last done"; add, edit or delete habits; steam after finishing.
- Bathroom cabinet: skincare and household supplies with expiry, period-after-opening and low-stock badges.
- Laundry basket: worn clothes and extras (towels, bed linen, sportswear, anything else) grouped by colour or type, add from the wardrobe, stain and care warnings, add a selection to a new or queued load.
- Washing machine: load type, cycle, temperature and duration; one load at a time with a live countdown that survives reloads, "laundry is done" reminder, unload marks clothes clean.
- Clothing shop in Town: try on any template and colour without changing your outfit, buy into the wardrobe (Clothing expense unless it was free), optionally wear right away; the shop window shows your latest purchase.
- Park: start and finish walks (no GPS, steps and distance are manual), log past walks, weekly totals, places with visit counts.
- Next-task strip: laundry done, full basket, walk in progress. Quick add: walk.

### Changed
- Seed data v4 adds the Park place.

### Fixed
- Selecting several groups quickly in the laundry basket kept only the last one.

## [0.4.0] - 2026-10-18
### Added
- Kitchen and Town are open, each with a room tour and placeholder portrait art.
- Refrigerator (fridge/freezer), kitchen cabinets (pantry) and bathroom stock: quantities with steppers, expiry dates and period-after-opening, "use soon" grouping, low-stock thresholds with "Add to list", mark as used; identical batches merge.
- Shopping board: quick add that understands "2 kg apples" / "молоко 1 л", aisles, priorities, price estimate, suggestions from low stock and medication refills.
- Grocery shop in Town: "From your list", product search and aisles, basket, checkout with prices per line, destination and expiry, and the amount actually paid.
- Checkout in one step: stock goes to the fridge/pantry/bathroom, list items are ticked off, the payment is split into one transaction per finance category, last prices are remembered; undo is available.
- Bank / ATM: wallet with opening balance, expenses and income, transactions by day, monthly budget with per-category limits (copied from the previous month), editable categories.
- Recipe book: recipes with servings scaling, availability from your stock, "Add missing to list", three sample recipes.
- Dining table: meal diary by day with recent foods and optional nutrition.
- Product catalogue with 62 starter products and remembered prices; amounts formatted in the device currency.
- Reminders and next-task strip: expired and expiring food, low stock; badges on the fridge, cabinets, board, grocery shop and ATM.
- Quick add for meals, expenses and shopping items.

### Changed
- Seed data v3 adds products, finance categories and the wallet.

### Fixed
- Month titles in Russian showed "Октябрь 2026 Г." instead of "Октябрь 2026 г.".

## [0.3.0] - 2026-10-18
### Added
- Onboarding on first launch (language, character look, currency/week/time format), followed by the bedroom tour.
- Bed: sleep plan with wind-down reminder and a "Wake up" alarm kept in sync with the wake time; bedtime routine checklist with streaks; sleep log with quality and 7-night average; "Go to sleep" starts Nightstand mode and the "Good morning" page saves the night in one tap.
- Desk / notebook: tasks with due dates, reminders, priority, checklists and filters; projects with progress; notes that save while typing.
- Medication tray: schedules (every day, specific days, every N days, as needed), Taken/Skip with undo, stock and refill reminders, 30-day history.
- Wardrobe: drawings of your clothes from 30 templates in 16 colours, wear/try on, saved outfits, mark as worn; the character wears the outfit in every scene.
- Character panel: name, skin tone, hair style and colour, glasses.
- Quick add for tasks, events, notes, alarms, sleep and due medication.
- Data & backup in Settings: export/import JSON (merge or replace), storage status, reset all data; alarm volume, Nightstand prompt, next-task strip toggle, replay room tours.
- Next-task strip and reminders now include tasks, medication doses, refills, routines and the wind-down prompt.

### Changed
- Seed data v2 adds care routines and starter clothes; existing users skip onboarding.

## [0.2.0] - 2026-10-17
### Added
- Bedroom scene (portrait placeholder art) with six interactive objects, a paper-doll character and on-object displays (alarm time on the clock face, today's date on the calendar).
- Alarm clock: repeating and one-shot alarms with sounds (synthesised, no audio files), snooze, vibration, "how alarms work" explainer; ringing overlay with Snooze/Dismiss.
- Nightstand mode: black low-power screen with a dim minute clock, screen wake lock, burn-in shift, charger hint; double-tap to exit.
- Wall calendar: month and week views, events, deadlines and reminders with daily/weekly/monthly/yearly repeats, delete one occurrence or the whole series; due tasks shown as deadlines.
- Reminder engine: in-app delivery, snooze/acknowledge state, missed alarms reported in the new next-task strip.
- Room tour on the first visit to a location (replayable from the objects list).
- Objects not built yet open a "coming soon" window with their purpose.

### Changed
- Objects list shows each object's current state.

## [0.1.0] - 2026-10-17
### Added
- Implementation specification (`docs/spec/`) derived from the concept PDF, with owner decisions applied.
- Installable PWA shell: manifest, placeholder icons, service worker (network-first code, cache-first immutable assets), hidden on localhost.
- GitHub Pages deployment workflow with commit SHA substitution for the cache name and build number.
- Portrait app shell: top bar with location button and quiet autosave status, stage with 2:3 safe-zone scaling, bottom bar with objects list, quick add and character buttons.
- Bottom-sheet windows with page stack, browser Back integration, unsaved-changes guard, focus trap and drag-to-close.
- Settings window (language, currency, week start, time format, units, text size, reduced motion, object hints) with version and build in the footer.
- Map and objects list windows; English UI with optional Russian.
- Local-first data layer: IndexedDB wrapper, atomic undoable store, schema migrations and versioned seeds.
- Dual-runtime test harness (browser and Node) with unit and IndexedDB tests; asset tooling (`tools/check_sw_assets.py`, `tools/hash_assets.py`).

[Unreleased]: https://github.com/imrime/organized-life/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/imrime/organized-life/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/imrime/organized-life/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/imrime/organized-life/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/imrime/organized-life/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/imrime/organized-life/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/imrime/organized-life/releases/tag/v0.1.0
