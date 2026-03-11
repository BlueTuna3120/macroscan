# Sync Design

MacroScan uses a **debounced auto-push + boot-time merge pull** pattern to keep all users' data current without any manual action.

---

## Overview

```
Device A (Blake logs lunch)
  save()
    → stamps ms:modified:Blake = 1710000050000
    → schedulePush() — 4 s debounce
    → _silentPush() → PUT user-data.json to repo

Device B (John opens app)
  load() — restores John's data from localStorage immediately
  autoSyncLoad() — fetches user-data.json in background
    → repo Blake.lastModified (1710000050000) > local Blake.lastModified (0)
    → _applyUserData('Blake', repoData)  ← only Blake's data updated
    → John's local data untouched (John.lastModified same on both sides)
    → render() — Blake now visible in John's user list
```

---

## Key: `ms:modified:{username}` (epoch ms)

Every `save()` call stamps the current epoch millisecond into `ms:modified:{username}`. This timestamp travels with the user's data in `user-data.json` as `users.{username}.lastModified`.

On pull, this timestamp is the only thing that determines whose data gets overwritten. If the repo's `lastModified` for a user is **strictly greater than** the local value, the local data is replaced. Equal or lower means local data is kept.

This means:
- You never lose data you just entered (your local `ms:modified` is always the most recent).
- You always pick up a teammate's data as soon as they push and you load/reload.

---

## Push: `_silentPush()`

Called automatically from `schedulePush()` after a 4-second debounce, and from the manual "Push now" button.

```
_silentPush()
  1. Check token — if none, return false (localStorage-only mode)
  2. _repoInfo() — derive owner/repo from window.location.hostname
     hostname: "bluetuna3120.github.io" → owner: "bluetuna3120"
     pathname: "/macroscan/"           → repo: "macroscan"
  3. GET /repos/{owner}/{repo}/contents/user-data.json
       → extract .sha  (required by GitHub API for updates; absent = new file)
  4. buildPayload() → JSON string → base64 (UTF-8 safe via encodeURIComponent+btoa)
  5. PUT /repos/{owner}/{repo}/contents/user-data.json
       body: { message: "sync: update user-data.json", content, sha? }
  6. Return true on 2xx, false on any error
```

`_silentPush()` never throws and never updates UI status text — it returns a boolean. The calling code (`schedulePush()` or `pushToRepo()`) handles the visual feedback.

### Why GET before PUT?

The GitHub Contents API requires the current file's SHA in the request body when updating an existing file. Without it, the PUT is rejected with 422. The GET retrieves the SHA. If the GET 404s (file doesn't exist yet), we proceed without a SHA, which is how you create a new file.

---

## Pull: `autoSyncLoad()`

Called once at boot, after `load()` and `render()`. Runs in the background — does not block the initial render.

```
autoSyncLoad()
  1. fetch('./user-data.json?t={Date.now()}')  ← cache-busted, no auth needed
  2. If 404 → silent return (no file yet, first push hasn't happened)
  3. If data.users missing → silent return (old single-user format, skip auto-merge)
  4. For each username in data.users:
       repoTs  = data.users[username].lastModified
       localTs = localStorage.getItem('ms:modified:{username}') || 0
       if repoTs > localTs:
         _applyUserData(username, data.users[username])
         add to S.users if not already present
         updated = true
  5. If any user was updated:
       save S.users to ms:users
       _loadUserData(S.currentUser) if current user was one of the updated ones
       render()
```

The merge is per-user and additive — users not present in the repo file are left alone, and new users found in the repo are added to the local user list automatically.

---

## `buildPayload()` — Sync File Format

```json
{
  "version": "1.1",
  "exportedAt": "2026-03-11T18:00:00.000Z",
  "users": {
    "Blake": {
      "profile":      { "weightLbs": "185", "heightFt": "6", ... },
      "targets":      { "calories": 2400, "protein": 185, "carbs": 240, "fat": 67 },
      "unit":         "imperial",
      "foodUnit":     "g",
      "lastModified": 1710000050000,
      "dates":        ["2026-03-11", "2026-03-10", ...],
      "entries": {
        "2026-03-11": [ { "id": 1710000001, "name": "Chicken breast", ... } ]
      },
      "weightLog": [ { "date": "2026-03-11", "weight": 185, "ts": 1710000000 } ]
    },
    "John": { ... }
  }
}
```

`exportedAt` is the file-level write timestamp (when the last push ran). `lastModified` inside each user block is the user-level write timestamp (when that user last called `save()`). The merge logic uses the per-user `lastModified`, not the file-level `exportedAt`.

---

## Sync State Indicator

A small chip in the header (next to the user chip) shows sync state:

| State | Display | Color | Trigger |
|---|---|---|---|
| `idle` | hidden | — | No pending changes, no token, or after `ok` fades |
| `pending` | `● unsaved` | amber | `save()` called, debounce timer running |
| `syncing` | `↑ syncing` | blue | `_silentPush()` in flight |
| `ok` | `✓ synced` | green | Push succeeded (auto-hides after 3 s) |
| `error` | `⚠ sync err` | red | Push failed — tap Settings to check token |

`setSyncState(state)` updates both `S._syncState` and the DOM element directly (does not go through `render()`).

---

## No Token — Fallback Behaviour

If `ms:gh_token` is empty:
- `schedulePush()` returns immediately — no push is attempted
- `autoSyncLoad()` still runs on boot (pull is auth-free)
- The sync indicator is never shown
- The app works exactly as it did before sync was added — localStorage only

---

## Concurrent Push Edge Case

If Blake and John both push within the same ~4-second debounce window from different devices, the second PUT will use a stale SHA (from before the first PUT updated the file). The GitHub API will reject it with a 422 conflict error. The second device's `syncIndicator` will show `⚠ sync err`.

**Recovery:** tap "Push now" in Settings. The manual push fetches a fresh SHA and retries.

This race condition is unlikely for a small group of friends using the app at different times, but it is a known limitation. A proper solution would require a read-modify-write lock or per-user file partitioning.

---

## Manual Controls

Settings → ☁️ Auto Sync has two manual override buttons:

- **Pull now** — immediately fetches `user-data.json` and runs `_restorePayload()`. Uses the same import/restore logic as the JSON import feature, so it handles both old single-user backups and new multi-user format.
- **Push now** — reads the token from the input field (saving it to `ms:gh_token` first), then calls `_silentPush()` directly and shows the result in the status line below the buttons.

---

## Token Security

The GitHub PAT is stored in `ms:gh_token` in `localStorage`. It is:
- Never included in `buildPayload()`
- Never written to `user-data.json`
- Never sent anywhere except the GitHub API

The token only needs **Contents: Read & Write** on this one repo (fine-grained PAT). Classic tokens with `repo` scope also work but grant broader access than necessary.
