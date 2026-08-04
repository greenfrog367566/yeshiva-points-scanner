# Daily Backup — automatic, or nagged into happening

**Status (2026-08-04): PR A has SHIPPED; PR B is still a proposal.** The staleness
nudge below is live — `data.lastBackupAt` and `data.backupNudgeSince` are in
`defaults`, so the app can now tell a rebbi how long it has been. **PR B (the File
System Access folder backup) is unbuilt**, and its one open sequencing question —
before or after the Firebase cutover — is still open in
`docs/Firebase_Rebuild_Scope.md`.

Originally raised by a beta rebbi, who noticed
that the Firebase rebuild retires Google Sheets and asked what replaces the
automatic backup before that happens. Read alongside
`docs/Firebase_Rebuild_Scope.md` — the File System Access section there is the
same idea, sequenced later.

---

## The problem, stated precisely

Menchmark has exactly one **automatic** backup today, and it is the thing being
retired.

| Path | Automatic? | Off-device? | Survives the rebuild? |
|---|---|---|---|
| Google Sheet snapshot (`pushSnapshot`, every 30s) | ✅ yes | ✅ yes | ❌ **no** — Sheets stops being the database |
| "Download backup file" button | ❌ manual | ✅ if he moves the file | ✅ yes |
| PWA persistent storage | n/a — it's the *primary* copy, not a backup | ❌ | ✅ |
| Offline HTML copy | ❌ manual, and forks the data | ❌ | ❌ retires (file:// vs Firebase Auth) |

`Firebase_Rebuild_Scope.md` line 72 names the replacement for Sheets as **a CSV
export button** — which is manual. So on the current plan, the day the rebuild
ships is the day Menchmark's only automatic backup becomes a button a rebbi has
to remember to press. Firestore is a real safety net and covers most of this,
but it covers "Google is up and my account works," not "I want my own file."

There is also a smaller gap that is worth fixing regardless of any of the below:
**nothing in the app records that a backup ever happened.** No `lastBackupAt`,
no timestamp, nothing. The app cannot tell a rebbi he is six weeks stale because
it does not know.

---

## What "effortless" actually costs

The Adobe comparison is the right instinct, but Adobe is a desktop app with
unrestricted disk access. A web page writing files to disk with **zero** prompt,
ever, is precisely what browser sandboxing exists to prevent — there is no API
that does it and there will not be one.

The closest real thing is **one permission click, then silence forever after**.
That is achievable, and for the Chromebook audience it is achievable well.

---

## Option 1 — File System Access API: pick a folder once, silent daily writes

**Recommended.** This is the Adobe-shaped answer.

- Rebbi taps "Back up automatically" once and picks a folder.
- The app stores the `FileSystemDirectoryHandle` in IndexedDB.
- On every app open, if the newest backup in that folder is older than today, it
  writes `menchmark-backup-YYYY-MM-DD.json` — no prompt, no dialog, no download
  bubble. Whether old files get pruned is an open question — see the plan below;
  pruning means deleting files in the rebbi's own folder, which needs a yes.

**Why it fits this audience specifically:**

- Chromium-only (Chrome, Edge — no Safari, no Firefox). The at-risk users are on
  **Chromebooks, which are Chrome.** The browser limitation lands on exactly the
  population that does not need it.
- **On ChromeOS the folder picker includes Google Drive.** This is the important
  part. Point it at a Drive folder and the daily file is off-device, in the
  rebbi's own Google account, with **zero OAuth, zero Apps Script, zero
  deployment** — the entire Sheets setup pain replaced by picking a folder once.
  That is a better story than what it replaces.

**The honest caveats:**

- Since Chrome 122, retrieving a stored handle and calling `requestPermission()`
  offers a three-way prompt including "Allow on every visit", which grants
  indefinite access across restarts. **Chrome's blog states an installed PWA
  skips that prompt and persists automatically** — Menchmark already pushes PWA
  install, so this lines up, but it is one source and must be confirmed on a real
  Chromebook before we promise it to anyone.
- Chrome auto-revokes after a tab is backgrounded a long time. So: `queryPermission()`
  on load, and if it comes back `prompt`, show a single unobtrusive re-grant tap.
  Silent almost always, one tap occasionally — not literally never.
- Writes happen **when the app is open**, not overnight. Fine in practice; a rebbi
  opens Menchmark every school day. Do not oversell it as "nightly."
- Deny/dismiss three times and Chrome falls back to the regular prompt. Design the
  first ask so it is obviously worth accepting.

---

## Option 2 — silent auto-download to the Downloads folder

**Recommend against.** This is the naive reading of the request and it is worse
than it sounds:

- Browsers gate programmatic downloads without a user gesture; Chrome's
  automatic-downloads permission prompt is exactly the friction we were avoiding.
- 180 files a year into Downloads, which the rebbi never opens and cannot find.
- On a Chromebook, Downloads is **device-local and not synced** — gone in Guest
  mode, gone on a powerwash, gone when he uses a different Chromebook tomorrow.
  It fails in the same scenario that motivates the whole feature.

Worth writing down so it does not get proposed again.

---

## Option 3 — staleness nudge (the universal floor)

Cheap, works in every browser, no permissions, and fixes the "app doesn't know"
gap above. Should ship regardless of which automatic path wins.

- Add `data.lastBackupAt` (ms epoch number). **Purely additive** — a `load2fix()`
  backfill, no `DATA_VERSION` bump. Stamp it in the existing `exportJson` handler
  and in any automatic write.
- On load, if it is older than N days (start at 7), show one dismissible bar on
  the Dashboard: *"Last backup: 6 days ago — [Back up now]"*. One tap runs the
  existing download path.
- This is the only option that reaches iPad Safari and Firefox at all.

**Design constraint:** it must never become a nag a rebbi learns to dismiss
reflexively. Once a week, one line, dismissible for the day, and it disappears
entirely once automatic backups are running.

---

## Option 4 — Apps Script daily email (a bridge, not a destination)

The Sheet already stores full snapshots. A time-driven trigger plus
`MailApp.sendEmail` would drop a dated JSON attachment into the rebbi's own inbox
every night — off-device, browser-independent, survives everything, and runs as
his own Google account.

- **Real advantage:** it is the only option that works while the app is closed.
- **Real disadvantage:** it is built on precisely the infrastructure the rebuild
  retires, and it needs an Apps Script redeploy — a known pain point that has
  bitten beta rebbeim before.

Reasonable as an opt-in bridge for existing beta rebbeim who already have a Sheet
deployed and want belt-and-braces through the transition. Not the long-term
answer.

---

## Option 5 — Periodic Background Sync

Would let backups happen while the app is closed. Chromium-only, requires an
installed PWA, gated behind opaque site-engagement heuristics, and using a File
System Access handle from a service worker is not a settled path. Too fragile to
build on. Noted so it is not re-investigated.

---

## Recommended sequencing

1. **Staleness nudge (Option 3) now.** Small, additive, universal, and it closes
   a gap that exists today independent of the rebuild.
2. **File System Access (Option 1) before the Firebase cutover, not after.**
   `Firebase_Rebuild_Scope.md` sequences this after steps 1–8. That ordering
   leaves a window where the automatic Sheet snapshot is gone and nothing
   automatic has replaced it. Pulling it forward closes the window — and it has
   no dependency on accounts or Firestore, so nothing blocks it.
3. **Apps Script email (Option 4)** only if beta rebbeim ask for closed-app
   backups during the transition.
4. **Never** Option 2.

---

# Implementation plan

Grounded in the actual code. Two PRs, in this order — **A ships alone and is
useful alone**; B depends on A's timestamp field.

**Two corrections found while planning:**
- ~~`CLAUDE.md` says `DATA_VERSION` is `4`. It is **`5`**.~~ **Fixed in CLAUDE.md
  on 2026-08-04.** (The line reference given here, `app.html:3890`, has itself
  drifted — the declaration is now around `app.html:4165`.)
- The app uses **no IndexedDB at all** today (zero occurrences). Layer B has to
  introduce it, because a `FileSystemDirectoryHandle` is not JSON-serializable
  and therefore cannot live in `localStorage`.

---

## PR A — the staleness nudge

Universal, no permissions, no new browser APIs. ~80 lines.

### Data model — purely additive, no `DATA_VERSION` bump

Two fields in `defaults` (`app.html:3731`) and backfilled in `load2fix()`
(`app.html:16264`):

```js
lastBackupAt: 0,        // ms epoch of the last real backup file written
backupNudgeSince: 0,    // ms epoch this device started counting
```

```js
if(typeof data.lastBackupAt!=="number" || !isFinite(data.lastBackupAt)) data.lastBackupAt=0;
if(typeof data.backupNudgeSince!=="number" || !isFinite(data.backupNudgeSince)) data.backupNudgeSince=Date.now();
```

**Why the second field.** Backfilling `lastBackupAt` to `0` alone would nag every
existing rebbi the instant he loads the update — the app has no idea he has been
backing up by hand for months, and greeting him with a warning he did nothing to
earn is the fastest way to teach him to dismiss it forever. `backupNudgeSince`
stamps *now* on first load after upgrade, so the clock starts fresh and the first
nudge is a week out. Honest, and it never fires on a fresh install either.

Nudge fires when `Date.now() - max(lastBackupAt, backupNudgeSince) > 7 days`.

### Where `lastBackupAt` gets stamped

Every path that actually writes a backup file the rebbi keeps:
- `$("exportJson")` handler — `app.html:16087`
- the pre-Shulchani-switch safety download — `app.html:6331`
- the pre-mode-switch download — `app.html:6406` area
- (PR B) every automatic folder write

Deliberately **not** stamped by the Log CSV or standings CSV exports — those are
reports, not restorable backups. Restoring from a Log CSV is a salvage path, not
a backup.

### The Sheet question

A rebbi whose Sheet is syncing every 30 seconds has a working off-device backup
and should not be nagged. Proposed: suppress the nudge when a Sheet is connected
**and** a snapshot pushed successfully within the window. Needs a
`lastSnapshotOkAt` stamp in `pushSnapshot()`'s success path (`app.html:15927`).
**Flagged as a judgment call** — the counter-argument is that a Sheet is not a
file the rebbi holds, and the whole point is that Sheets is going away.

### UI

Precedent is `#saveWarn` (`app.html:1589`), which sits at the top of `<main>`
outside every `<section class="view">` — so it shows on whatever tab is open, and
is already in the `@media print` hide list (`app.html:1231`). Add `#backupNudge`
immediately after it, same shape, amber (`--warn`) rather than red:

> **Last backup: 12 days ago.** &nbsp; [ Back up now ] &nbsp; [ Not now ]

- **Back up now** → the existing `exportJson` path, stamps, hides the bar.
- **Not now** → hides for the session via `sessionStorage`, not `data`. It comes
  back tomorrow but does not reappear on every tab switch. Nothing about a
  dismissal belongs in the saved data.
- When `lastBackupAt === 0` the copy reads *"Menchmark has no record of a backup
  on this device yet"* rather than "never" — accurate, since the app genuinely
  cannot see files he saved before this existed.
- Add `#backupNudge` to the print-hide selector list at `app.html:1231`.

### Where the check runs

Tail of the main IIFE init, alongside the other startup calls at
`app.html:17163–17169`, inside a `setTimeout` so it never competes with first
paint. Never blocks startup; wrapped in `try/catch` like its neighbours.

### Validation

- `validate` skill (JS syntax per block, CSS brace + comment-delimiter balance).
- **Sync `test-migration.html`'s copies of `migrateData()`/`load2fix()`** and run
  every scenario including "Corrupted data".
- Browser-verify over http, per `NOW.md` — a Node stub run is not a browser pass.

---

## PR B — File System Access auto-backup

Chromium only. Feature-detected; entirely invisible where unsupported.

### New: a minimal IndexedDB handle store

~30 lines, inside the main IIFE near the BACKUP section (`app.html:16071`). One
database (`menchmark-fs`), one store (`handles`), one key (`backupDir`). Only
ever holds the directory handle — **never app data**. `localStorage` via `save()`
remains the only store for `data`, unchanged.

### Data model — additive again, no bump

```js
autoBackupOn: false,      // rebbi turned it on
autoBackupLastAt: 0,      // ms epoch of last successful automatic write
autoBackupDirName: "",    // display only, e.g. "Menchmark Backups"
```

### UI — a new card on Backup & Sheets

Slots into the existing `.backup-grid` (`app.html:2590`), next to "Back up
everything". Feature-detect `window.showDirectoryPicker`; if absent, render the
card in a "not available in this browser — use the backup button above" state
rather than hiding it, so the option is discoverable when he switches to Chrome.

- **Choose a backup folder…** → `showDirectoryPicker({mode:"readwrite"})`
- Status: *"✓ Backing up automatically to **Menchmark Backups** — last backup
  today."*
- **Turn off** — clears the flag and the stored handle. Never deletes files.

Copy steers ChromeOS users to a **Google Drive** folder, since the ChromeOS
picker exposes Drive and that is what makes it off-device.

### The write cycle

On boot, if `autoBackupOn`:

1. Read the handle from IndexedDB. **If it is missing, treat as off** and show
   the choose-a-folder state. This is a real case, not a theoretical one: the
   offline-copy download seeds `localStorage` into a fresh origin, so
   `autoBackupOn` travels to the copy while the handle does not.
2. `queryPermission({mode:"readwrite"})`:
   - `granted` → proceed silently.
   - `prompt` → show a one-tap re-grant chip. **Cannot be automatic** —
     `requestPermission()` needs a user gesture. This is the "silent almost
     always, one tap occasionally" caveat, made concrete.
   - `denied` → show the off state, do not re-ask.
3. If no `menchmark-backup-<today>.json` exists in the folder, write one via
   `getFileHandle(name,{create:true})` → `createWritable()` → `write` → `close`.
   Idempotent per day, so reopening the app ten times writes once.
4. Stamp `lastBackupAt` and `autoBackupLastAt`.

Runs in the same startup `setTimeout` as the nudge, after it — a successful write
means the nudge never renders.

Immediately after the rebbi picks the folder, **write the first file right then**,
before he navigates away. He needs to see a file appear to believe the feature.

### 🔴 Pruning deletes files — needs an explicit yes

Keeping the last ~14 and removing older ones means calling
`dirHandle.removeEntry()` on files **in the rebbi's own folder** — quite possibly
his Google Drive. `CLAUDE.md` requires explicit approval before deleting
anything, and this is deletion, automatic, and off-app. Options:

- **(a) Do not prune.** ~180 files a year. Ugly, completely safe. Safe default.
- **(b) Prune to N**, with hard guards: only exact `/^menchmark-backup-\d{4}-\d{2}-\d{2}\.json$/`
  matches, never today's file, never anything the app did not write, N settable
  and never below 7.

Recommend shipping **(a)** and adding (b) later only if a rebbi complains about
clutter. Nobody has ever asked for fewer backups.

### Validation

Same as PR A, plus a real **Chromebook** pass — this is where the "installed PWA
persists permission automatically" claim gets confirmed or dropped. Until it is
confirmed on hardware, no user-facing copy may promise it.

---

## What this does not do

- Does not back up while the app is closed. Only Option 4 does that.
- Does not touch `migrateData()` logic, `DATA_VERSION`, or any existing store.
  Every field above is new and additive.
- Does not change `pushSnapshot`, the Sheet, or the Apps Script — except the one
  optional `lastSnapshotOkAt` stamp, which is additive and read-only elsewhere.

---

## Open questions for the maintainer

- Is pulling File System Access **before** the cutover acceptable, or does it
  stay sequenced after the rebuild as currently written?
- Default folder guidance: do we actively steer rebbeim to a **Google Drive**
  folder on ChromeOS (making it a real off-device backup), or stay neutral and
  let them pick anything?
- Staleness threshold: 7 days, or tighter?
- Does the nudge belong on the Dashboard, or only on Backup & Sheets? Dashboard
  is where it will actually be seen; Backup & Sheets is where it belongs
  logically. *(The plan above answers this: `#saveWarn`'s slot at the top of
  `<main>` shows on every tab, which is strictly better than either. Confirm.)*

**From the implementation plan:**

- **Pruning old backup files — (a) never delete, or (b) keep the last N?** This
  is the one item that needs an explicit yes either way, because it deletes files
  in the rebbi's own folder. Recommendation: ship (a).
- **Does a live Google Sheet suppress the nudge?** Argument for: he has a working
  off-device backup, nagging him is wrong. Argument against: a Sheet is not a file
  he holds, and Sheets is being retired.
- **Is `backupNudgeSince` the right call** — start the clock fresh on upgrade so
  no existing rebbi gets nagged on first load — or should the nudge fire
  immediately for anyone with no recorded backup?
