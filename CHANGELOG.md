# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/imrime/organized-life/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/imrime/organized-life/releases/tag/v0.1.0
