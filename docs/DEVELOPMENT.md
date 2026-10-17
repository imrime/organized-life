# Development guide

Organized Life is a static, no-build PWA: plain ES modules, Preact + htm from one vendored file, IndexedDB for data. The full specification is in [docs/spec/](spec/README.md).

## 1. Local run

```bash
python3 -m http.server 8000      # from the repository root
```

- App: http://localhost:8000/
- Tests: http://localhost:8000/tests/ (`?only=unit` or `?only=browser` to run a subset)

The service worker is **not** registered on `localhost`; any previously installed worker and its caches are removed on load, so development never mixes versions. To test offline behaviour and updates, use the deployed site (or an `https` tunnel).

Requirements: Python 3.9+ and a current browser. Node is optional locally (CI runs `node tests/run-node.mjs`).

## 2. Project structure

```text
index.html, manifest.webmanifest, sw.js   app shell, PWA manifest, service worker
css/                tokens, base, shell, scene, sheet, components
js/main.js          bootstrap: open DB → migrate → seed → render → register SW
js/version.js       VERSION (semver) and BUILD ('dev' locally, commit sha8 on Pages)
js/core/            data layer (db, store, schema, migrations, seed), i18n, router, time, money, units, text, bus
js/ui/              Preact shell: app, bars, sheets, dialogs, toasts, controls, hooks
js/scene/           stage (2:3 safe zone), hit layer, badges, placeholder art
js/world/           locations and room object definitions (geometry only)
js/features/<name>/ model.js (pure logic) · actions.js (mutations) · selectors.js · window.js (UI)
js/windows.js       window registry (id → lazy import)
js/i18n/            en.js (default) and ru.js — keys must match
js/vendor/          htm + Preact standalone build (immutable, versioned file name)
icons/, assets/     app icons; content-hashed art/sounds (generated)
assets-src/         art sources and templates (not deployed)
tools/              check_sw_assets.py, hash_assets.py
tests/              harness.js, unit/ (browser + Node), browser/ (IndexedDB), index.html, run-node.mjs
docs/               this guide and the specification
```

## 3. Conventions

- Every module starts with `// @ts-check`; types are JSDoc (`jsconfig.json` enables checking in the editor).
- `model.js` and `selectors.js` must stay pure (no DOM, no IndexedDB) so they run in Node tests.
- All writes go through `appStore.mutate(label, (tx) => …, { quiet? })`. It is atomic, write-through and returns `{ token, result }`; pass `token` to `undoToast()` to offer *Undo*.
- No hard-coded UI text: add keys to **both** `js/i18n/en.js` and `js/i18n/ru.js` (a test checks parity).
- Code comments, commit messages and developer docs are in English.

## 4. Adding a module

1. Create the file (e.g. `js/features/alarms/model.js`) and import it where needed.
2. **Add it to `ASSETS` in `sw.js`** — run `python3 tools/check_sw_assets.py --fix` (CI fails if the list is out of date).
3. Add i18n keys in English and Russian.
4. Add unit tests in `tests/unit/` and register them in `tests/unit/index.js`.
5. New windows: register in `js/windows.js`; new objects: add to the room file in `js/world/rooms/`.

## 5. Assets

Put sources in `assets-src/` (see [docs/spec/08-art-delivery.md](spec/08-art-delivery.md)), then:

```bash
python3 tools/hash_assets.py       # → assets/<name>.<hash8>.<ext>, js/asset-manifest.js, IMMUTABLE_ASSETS in sw.js
python3 tools/check_sw_assets.py   # verify
```

Commit the generated files. Hashed files are served cache-first; on install the service worker downloads only missing ones.

## 6. Tests

- Browser: open `/tests/` — runs unit and IndexedDB tests.
- Node (CI): `node tests/run-node.mjs` — unit tests only.
- What must be unit-tested: every `model.js`/`selectors.js`, date/recurrence logic, money, migrations, reminder and ranking logic, i18n key parity.

## 7. Publishing (GitHub Pages)

`.github/workflows/pages.yml` runs on every push to `main` and manually (`workflow_dispatch`):

1. `actions/checkout@v7`
2. **Verify:** `python3 tools/check_sw_assets.py` and `node tests/run-node.mjs`
3. **Build `_site`:** copies only `index.html manifest.webmanifest sw.js css js icons assets`, then `sed` substitutes the commit hash:
   - `const CACHE = 'organized-life-dev';` → `organized-life-<sha8>` in `sw.js` (phones pick up the new version automatically),
   - `export const BUILD = 'dev';` → `<sha8>` in `js/version.js`.
   After each substitution `grep -q` checks it worked, otherwise the build fails — keep those two lines exactly as written.
4. `actions/configure-pages@v6` → `actions/upload-pages-artifact@v5` (`path: _site`) → `actions/deploy-pages@v5`.

Site: https://imrime.github.io/organized-life/. One-time repository setting: **Settings → Pages → Source: GitHub Actions**. A free account needs a public repository — run the secret scan (§9) first.

## 8. Versioning and releases

- Semver `MAJOR.MINOR.PATCH`; the only source is `js/version.js`. Settings shows `v0.1.0 · build 1a2b3c4d` (locally `build dev`).
- `CHANGELOG.md` follows Keep a Changelog (Added / Changed / Fixed) with compare links at the bottom.
- `SCHEMA_VERSION` (data) is separate from the app version; a data migration needs at least a MINOR bump.

Release:

1. Bump `VERSION` in `js/version.js`.
2. Move `[Unreleased]` entries into `## [X.Y.Z] - YYYY-MM-DD` and update the links.
3. `git commit -am "Release X.Y.Z"`
4. `git tag -a vX.Y.Z -m "Organized Life X.Y.Z"`
5. `git push --follow-tags` — **done by the owner only** (automation never pushes).

## 9. Git rules and secrets

- Commits and tags are made locally; pushing is done by the owner.
- Repository-local noreply identity: `git config --local user.name "imrime"` and `git config --local user.email "imrime@users.noreply.github.com"`.
- Secrets (API keys) only in `.env.local` (git-ignored) or CI secrets — never in client code. v1 needs none.
- Before the first publication and before making the repository public:

```bash
git ls-files | grep -iE '(^|/)\.env' && echo "!! env file tracked"
git log --all -p | grep -inE '(api[_-]?key|secret|token|passw(or)?d|bearer |BEGIN (RSA|EC|OPENSSH) PRIVATE KEY)' | head
git log --all --format='%ae %ce' | sort -u      # only the noreply address should appear
```
