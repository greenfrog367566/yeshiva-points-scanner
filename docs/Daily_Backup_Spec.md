# Daily Backup — automatic, or nagged into happening

**Status: PROPOSAL. Nothing here is settled.** Raised by a beta rebbi, who noticed
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
  bubble. Prune to the last ~14 files so the folder does not grow forever.

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

- Add `data.lastBackupAt` (ISO string). **Purely additive** — a `load2fix()`
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

## Open questions for the maintainer

- Is pulling File System Access **before** the cutover acceptable, or does it
  stay sequenced after the rebuild as currently written?
- Default folder guidance: do we actively steer rebbeim to a **Google Drive**
  folder on ChromeOS (making it a real off-device backup), or stay neutral and
  let them pick anything?
- Staleness threshold: 7 days, or tighter?
- Does the nudge belong on the Dashboard, or only on Backup & Sheets? Dashboard
  is where it will actually be seen; Backup & Sheets is where it belongs
  logically.
