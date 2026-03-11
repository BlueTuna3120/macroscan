# Bug Tracker & Change Log

All audit findings and feature additions, in order of resolution.

---

## Fixed in v1.1 — Initial Audit

### BUG-01 — Macro target math internally inconsistent
**Severity:** High | **Status:** Fixed

`computeTargets()` set carb/fat as percentages of *total* calories while protein was set separately from body weight. For many weight/goal combinations, macro calories exceeded or undershot the calorie target.

**Fix:** Protein is set first (`wLbs × proteinPerLb`). Remaining calories (`target − protein × 4`) are split between carbs and fat using a normalized ratio. Macro calories now always sum to the calorie target. See `docs/NUTRITION_LOGIC.md` for the full formula.

---

### BUG-02 — Forbidden `User-Agent` header in barcode fetch
**Severity:** High | **Status:** Fixed

`lookupBarcode()` sent `headers: { 'User-Agent': 'MacroScan/1.0' }`. Browsers block or silently drop this forbidden header; some environments reject the request with a network error.

**Fix:** Header removed entirely.

---

### BUG-03 — Search results could show per-serving data labeled as per-100g
**Severity:** High | **Status:** Fixed

`searchFoodOnline()` filtered on `energy-kcal_100g` OR `energy-kcal_serving`, then always displayed and stored values as if they were per 100g. Products with only serving-based data would show wrong macro numbers.

**Fix:** Filter and all nutriment reads use `_100g` fields exclusively. Products without per-100g data are excluded from results.

---

### BUG-04 — `serving_quantity` assumed to always be in grams
**Severity:** High | **Status:** Fixed

`parseFloat(data.product.serving_quantity)` was used directly as a gram weight regardless of the actual unit (could be ml, piece, cup, etc.).

**Fix:** `serving_quantity_unit` is checked first. `servingGrams` is only populated when the unit is `'g'` or blank (Open Food Facts defaults to grams when unspecified). All other units fall back to gram-only entry.

---

### BUG-05 — Text search had no stale-response guard
**Severity:** Medium | **Status:** Fixed

Rapid sequential searches could result in a slower earlier response overwriting the results of a faster later one.

**Fix:** `_searchId` token added to `doSearch()`, mirroring the existing `_lastLookupId` pattern already in `lookupBarcode()`.

---

### BUG-06 — Render guard blocked all renders when `amountInput` focused
**Severity:** Medium | **Status:** Fixed

The old guard (`if (focused && focused.id === 'amountInput') return`) sat at the top of `render()` and blocked all screen updates — including nav, header, and unrelated state changes — whenever the amount input was focused.

**Fix 1:** Guard moved to only skip `renderFoodResult()` specifically. All other screens render normally while the input is focused.

**Fix 2:** `updateAmountPreview()` added — wired to the input's `oninput` handler. Directly updates only the preview row DOM nodes on each keystroke. Preview now updates live while typing without any re-render; iOS keyboard stays open.

---

### BUG-07 — Profile load replaced entire object (broke on partial/old data)
**Severity:** Medium | **Status:** Fixed

`S.profile = JSON.parse(p)` replaced the whole object, so missing fields from old or imported backups left `undefined` values that broke downstream calculations.

**Fix:** All profile loads use `{ ...PROFILE_DEFAULTS, ...JSON.parse(p) }` — missing fields fall back to defaults.

---

### BUG-08 — Weight reminder threshold was unit-blind
**Severity:** Low | **Status:** Fixed

`if (diff < 8) return ''` applied the same threshold for both lbs and kg. 8 kg ≈ 17.6 lbs — far too high for metric users.

**Fix:** `if (diff < (S.unit === 'imperial' ? 8 : 3.5)) return ''`

---

### BUG-09 — Stale dates with 0 entries lingered in history
**Severity:** Low | **Status:** Fixed

`ms:dates` accumulated date strings pointing to empty entry arrays (e.g. after clearing a day). History would render "0 items logged" rows for those dates indefinitely.

**Fix:** `renderHistory()` filters out any date whose entry array is empty before rendering.

---

### BUG-10 — No service worker — app not actually offline-capable
**Severity:** Medium | **Status:** Fixed

`site.webmanifest` was present and correct, but no `sw.js` existed and nothing registered a service worker. The app claimed to be a PWA but provided no offline caching.

**Fix:** `sw.js` added at repo root. Cache-first strategy for same-origin GET requests; network pass-through for all external requests (Open Food Facts, ZXing CDN, Google Fonts). `user-data.json` explicitly excluded from cache — always fetched fresh. Registered at boot in `index.html`.

---

### BUG-11 — Missing PWA icon assets
**Severity:** Low | **Status:** Fixed (generator provided)

`site.webmanifest` referenced `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-180.png`. The directory did not exist. The apple-touch-icon pointed to `IMG_9455.jpeg` (a photo).

**Fix:** `icons/` directory created. `icons/make-icons.html` is a self-contained canvas-based generator — open it in a browser, download the three PNGs, commit them. `<link rel="apple-touch-icon">` updated to `icons/icon-180.png`.

---

### BUG-14 — Dead files in repo root
**Severity:** Cosmetic | **Status:** Partially fixed

`IMG_9455.jpeg` is no longer referenced. `MacroScan_Upgraded_PWA.zip` is still present.

**Remaining action:** Delete both files once the generated icon PNGs are committed.

---

## Added in v1.1

### FEATURE — Repo-based Auto Sync
**Status:** Implemented

Writes `user-data.json` directly to this repo via the GitHub Contents API. Auto-syncs after every save (4-second debounce). Pulls on load and merges using per-user timestamps.

See `docs/SYNC.md` for full design documentation.

**Storage keys:** `ms:gh_token` (token, never synced), `ms:modified:{username}` (epoch ms per user)

---

### FEATURE — Multi-User Profiles
**Status:** Implemented

Multiple named profiles on a single deployment. Each user has fully isolated localStorage data. A profile-select screen is shown on first open or when switching.

**How it works:**
- Profile names are stored in `ms:users` (JSON array)
- All per-user data keys are namespaced: `ms:profile:{name}`, `ms:entries:{name}:YYYY-MM-DD`, etc.
- `switchUser(username)` loads that user's data into `S` and re-renders
- `createUser(name)` validates uniqueness (case-insensitive), adds to `ms:users`, and routes to setup
- `deleteCurrentUser()` removes all `ms:*:{username}` keys and returns to user select
- Legacy single-user data (pre-v1.1) is auto-migrated to a profile named `"Me"` on first load

**Header:** Shows `👤 {currentUser}` chip while a user is active. Tapping it returns to the user-select screen.

**Sync integration:** `buildPayload()` exports all users' data in a `users: {}` object. `_restorePayload()` handles both the new multi-user format and old single-user backup JSON for backwards compatibility.

---

## Open / Deferred

### BUG-12 — ml/fl oz conversions assume water density
**Severity:** Low | **Status:** Deferred

`ml → g` uses 1:1; `fl oz → g` uses ×29.5735. Both assume ~1 g/ml (water density). Wrong for most foods — olive oil ≈ 0.91 g/ml, honey ≈ 1.4 g/ml.

**Deferred:** A per-food density lookup table is out of scope. Minimum acceptable fix: display a disclaimer in the UI when a liquid unit is selected.

---

### BUG-13 — Full DOM rebuild on every state change
**Severity:** Low (architectural) | **Status:** Deferred

Every `render()` call replaces `#content` innerHTML entirely. `updateAmountPreview()` is a targeted workaround for the worst symptom (iOS keyboard collapse on the amount input), but the architecture is still fragile for any feature requiring persistent DOM nodes.

**Deferred:** Would require moving to event-driven partial updates or a reactive framework. Out of scope for the current single-file architecture.

---

### KNOWN — Concurrent push conflict
**Severity:** Low | **Status:** Known limitation

If two users push within the same ~4-second debounce window, the second PUT will carry a stale SHA and be rejected by the GitHub API (422). The `⚠ sync err` indicator appears. **Recovery:** tap "Push now" in Settings to retry with a fresh SHA.

Unlikely for a small group using the app at different times. A proper fix requires per-user file partitioning or a server-side merge layer — out of scope.

---

### KNOWN — `TODAY` is stale if app stays open past midnight
**Severity:** Low | **Status:** Known limitation

`TODAY` is computed once at boot (`getLocalDateStr()`). If the app remains open after midnight without a reload, food entries and weight logs after midnight are written to the previous day's storage key.

**Workaround:** Pull-to-refresh or navigate away and back. A proper fix would recompute `TODAY` on each `save()` call.
