# MacroScan

A progressive web app (PWA) for tracking daily macros and calories. Multiple people can share one deployment — each person has their own profile and data, synced automatically through the repo.

**Live app:** https://bluetuna3120.github.io/macroscan/

---

## Features

- Multiple named user profiles with a profile-select screen on launch
- Calorie and macro targets computed per profile (Mifflin-St Jeor BMR → TDEE → goal offset)
- Food search via Open Food Facts (millions of products, per-100g data only)
- Barcode scanner (ZXing) + manual barcode entry
- Custom food entry
- 7-day calorie/macro chart
- Weight tracker with linear-regression trend line
- Offline-capable PWA — installs to home screen, works without internet after first load
- Auto-sync to the repo via GitHub Contents API — saves push after every change, pulls fresh data on load
- Manual export / import backup as JSON (copy-paste fallback)

## Tech Stack

| Concern | Solution |
|---|---|
| Framework | None — vanilla JS |
| Build tools | None — single `index.html` |
| Food data | [Open Food Facts API](https://world.openfoodfacts.org) |
| Barcode scanning | [ZXing](https://github.com/zxing-js/library) via unpkg CDN |
| Fonts | DM Sans + DM Mono via Google Fonts |
| Local storage | `localStorage` with `ms:` key prefix, namespaced per user |
| Cloud sync | GitHub Contents API → `user-data.json` in this repo |
| Hosting | GitHub Pages |
| Offline | Service worker (`sw.js`), cache-first for app shell |

## Local Development

No build step needed:

```bash
git clone https://github.com/BlueTuna3120/macroscan.git
cd macroscan
python3 -m http.server 8787
# open http://localhost:8787
```

> **Note:** Must be served over HTTP (not `file://`) for camera access and PWA features. Auto-sync will not push when running locally (can't auto-detect GitHub Pages repo from localhost), but pull still works against the live `user-data.json`.

## Setting Up Sync

Auto-sync uses the GitHub Contents API to write `user-data.json` to this repo after every save.

1. Go to **github.com/settings/tokens** → Fine-grained personal access tokens → New token
2. Set repository access to **only this repo**
3. Under Permissions → Repository → Contents → **Read and write**
4. Generate and copy the token
5. In the app → Settings → ☁️ Auto Sync → paste the token

Pull (reading data) requires no token — `user-data.json` is served publicly by GitHub Pages.

## PWA Icons

The manifest requires icon files that must be generated once:

1. Open `icons/make-icons.html` in a browser (no server needed — open as file)
2. Click each Download button and save the files into `icons/`
3. Commit `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-180.png`

## Deployment

Push to `main` — GitHub Pages serves `index.html` automatically. No CI needed.

After deploying a code update, bump the cache version string in `sw.js` (`const CACHE = 'macroscan-vX.X'`) so users get the new version instead of the cached one.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — full codebase structure, state model, storage schema, sync design
- [`docs/SYNC.md`](docs/SYNC.md) — auto-sync deep dive: how push/pull/merge works
- [`docs/NUTRITION_LOGIC.md`](docs/NUTRITION_LOGIC.md) — BMR, TDEE, macro math explained
- [`docs/BUGS.md`](docs/BUGS.md) — audit findings, fix log, open issues
