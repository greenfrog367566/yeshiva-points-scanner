# Firebase Rebuild — Step 7 Fragile-Storage Warning Design (Proposal)

## Status

**✅ APPROVED 2026-08-14 by Ben.** Locked into `Firebase_Rebuild_Scope.md`'s build order as step 7's design — the last of the 8 build-order steps to be designed. This doc is now the reference for the trigger sequence, tier-branched copy, action buttons, and managed-Chromebook verification plan below.

## Recommended design

**Trigger sequence** (from A's minimal gate structure + C's fail-closed ordering):
1. Post-boot, existing 1200ms timer fires `maybeShowBackupNudge()`, unchanged.
2. `navigator.storage.persisted()` — if API missing, skip straight to today's staleness-only path (no false alarm, from C).
3. Read tier from `data.firebaseClaimedBy` + `driveBackupEnabled`: tier1 / tier2 / none. **Unknown or mid-read state is treated as tier2** (fail closed, from C's #5) — never assume the more-reassuring tier1 copy on a bad read.
4. `persisted === true` → fall through entirely to existing 7-day/`daysSinceBackup()` logic, unchanged.
5. `persisted === false` → show **now**, ignoring the 7-day floor (unpersisted storage is a volatility risk, not staleness — A and B agree, and it's correct: a fresh install with zero backup history but no persisted storage shouldn't wait a week to be warned).

**Component: reuse vs. new**

Reuse untouched: `#backupNudge` DOM/CSS, `hideBackupNudge()`, sessionStorage dismiss key, `daysSinceBackup()`, the 1200ms call site, `backupNudgeSince` floor idiom.

New, from C: a **second, red/urgent CSS variant** of the bar, used only for tier2+unpersisted — that's the one state where data can vanish outright with no cloud copy at all, and it must not look like routine 8-day staleness. Tier1 stays amber (informational) in every case, including unpersisted. B's "force a sync check + new `lastSyncConfirmedAt` field" is dropped — that's new plumbing outside step 7's scope; C's framing (Firestore already has it, nothing to verify locally) is the honest, buildable claim.

`markBackedUp()` gains one caller per tier (A's point): tier1's write-success path and tier2's Drive-write success path both call it, exactly like the folder-backup path does today. No new fields beyond what already exists.

**Copy — three variants, tier-branched, unpersisted case:**

*Tier 1:*
> This browser can be wiped without warning — but your class is already saved to Menchmark's account, not just here. Nothing is at risk.

Button: "Got it" (dismiss only — no forced-sync action, since there's nothing to verify without new plumbing).

*Tier 2 (red/urgent):*
> **This Chromebook can wipe your data at any time, and this class only lives on this device.** Get on wifi so it backs up to your Drive automatically, or export a backup right now.

Buttons: "Back up now" (`downloadBackupFile()`, unchanged) + "Save to Drive" if online (0b's token surface).

*No tier (local-only):* existing copy/buttons, unchanged.

**What was taken from each panelist and why:**
- **From A:** the minimal-retarget discipline — no new data fields, `markBackedUp()` as the sole choke point gaining callers rather than new machinery, tier detection reusing existing flags.
- **From B:** firing immediately on unpersisted storage rather than waiting for the 7-day floor — correctly treats this as a different *kind* of risk (severity, not staleness). B's `lastSyncConfirmedAt` addition is rejected as scope creep for this step.
- **From C:** the fail-closed tier lookup, the four-variant copy matrix collapsed to three (tier1 informational / tier2 urgent-red / no-tier unchanged), and giving tier2-unpersisted its own visual severity instead of reusing amber.

This keeps step 7 a true retarget of existing machinery, adds exactly one new visual state (not four), and never tells a tier-2 rebbi his data is safe when it isn't.

## Check timing and when the warning shows

**Check timing:** Once per app load, immediately after `navigator.storage.persist()` resolves in `reportStorage()` (lines 25034-25063) — not a timer, not re-polled mid-session. Cache the boolean into a module-level var (e.g. `_storagePersisted`) that `maybeShowBackupNudge()` reads. `persisted()` is fast and stable within a page lifetime (it doesn't flip mid-session under normal use), so one read at boot is sufficient — re-checking on a timer just adds complexity for a value that won't change without a reload.

**Decision logic in `maybeShowBackupNudge()`, evaluated in this order:**

1. Existing gates first, unchanged (preview mode, empty roster, session-dismissed) — bail out if any hit.
2. If `navigator.storage.persist`/`persisted` API is missing → skip straight to today's staleness-only path (existing behavior, from C).
3. Determine tier (fail-closed: unknown/mid-read → tier2).
4. **Tier 1 branch:** if `data.firebaseClaimedBy` is set AND the last Firestore write succeeded recently enough to trust (reuse `lastBackupAt`/`markBackedUp()` stamped by the sync-success path, per the design) — i.e. `daysSinceBackup() < BACKUP_NUDGE_DAYS` — suppress the unpersisted-storage alarm entirely, even if `persisted === false`. His data already has a durable copy; the browser-storage risk is real but not urgent, so it collapses into the existing amber staleness path (which will fire on its own 7-day schedule if sync itself goes stale). Only show the tier-1 unpersisted copy if BOTH `persisted === false` AND sync is *also* stale (`daysSinceBackup() >= 7` or `lastBackupAt` is 0) — two independent risks compounding is what earns the interruption.
5. **Tier 2 / no-tier branch:** `persisted === false` shows immediately regardless of `daysSinceBackup()` — no cloud source of truth exists to fall back on, so unpersisted storage is urgent on its own, exactly as originally designed.
6. **`persisted === true`** (either tier): fall through entirely to existing 7-day staleness logic, unchanged.

This means the unpersisted-storage warning's urgency is gated by "is there already a safe copy elsewhere," not by tier label alone — a tier-1 rebbi with fresh sync sees nothing; a tier-1 rebbi whose sync has also gone stale sees the real compound risk; tier-2 always sees it on unpersisted storage since Drive/local is all there is.

## Action buttons per tier

**Tier-1: informational only, no forced sync.** "Get on wifi so it syncs" is not a trigger for any new action — Firestore writes already happen live over whatever connection exists; there's no queued/pending state to flush and no `lastSyncConfirmedAt` plumbing (deliberately rejected above). The copy is honest about *why* wifi matters (writes need connectivity to reach Firestore at all) but the button is just "Got it" — dismiss. Building a forced-sync-check button would imply a verification state that doesn't exist yet and is out of step 7's scope.

**Tier-2: both actions offered, Drive is primary.** Two buttons:
- **"Save to Drive"** (primary, shown when online) — calls the same 0b token-surface write that `driveBackupEnabled` devices already run automatically on a timer/event basis. This warning is really saying "your automatic Drive backup may be stale or the device may die before the next automatic write" — so the recommended action is to force that same write *now*, on demand, not wait for its normal cadence. This is the correct primary because it's already the tier-2 safety net per step 3b, and it requires no new mechanism — just invoking the existing write path synchronously and calling `markBackedUp()` on success (per the design above).
- **"Back up now"** (secondary, always available, works offline) — the existing CSV/JSON `downloadBackupFile()`. This stays available specifically because Drive requires connectivity and the whole point of the unpersisted-storage warning is "the device could wipe before you're back online" — a local export is the only option that works with no network at all.

If tier-2 and offline: only "Back up now" shows (Drive button hidden/disabled, since it can't succeed), and copy should say so plainly rather than offer a dead button.

## Migrating the existing staleness nudge

**Tier-1 event:** the Firestore write itself succeeding — specifically, the client's onSnapshot/commit callback for a `trackedEntries`/`classes` write resolving without error. Concretely: wrap `markBackedUp()` as the success callback on the same write path that already gates via the overwrite-refusal/verification harness (step 3's proven write surface), OR — simpler and preferred, since tier-1 writes are frequent (every scan) and hammering `save()`/localStorage on every single point-scan is undesirable — fire it on a **throttled** basis: the first successful Firestore write per session, plus once per subsequent 7-day window if the session stays open that long. No periodic background sync check (that's new plumbing outside step 7, matches the earlier decision to drop `lastSyncConfirmedAt`). No polling — a write success is the only signal, consistent with "Firestore already has it, nothing to verify locally."

**Tier-2 event:** exactly what step 3b defined — `markBackedUp()` called from the Drive-write success path, same as the existing `fbWrite()` folder-backup callsite today (line 22298 pattern), just retargeted from the old Sheets-folder writer to 0b's Drive token-surface writer. This is the literal retarget: same function, same call shape, different underlying write.

**Pure retarget confirmation:** yes — `lastBackupAt` and `backupNudgeSince` keep their exact types, names, and semantics ("timestamp of last confirmed durable copy" / "nag floor for pre-existing saves"). `daysSinceBackup()`, the 7-day threshold, and the `load2fix()` guards are untouched. `markBackedUp()` is unchanged internally (`data.lastBackupAt = Date.now(); save();`); it simply gains two new callers (tier-1 write-success, tier-2 Drive-write-success) alongside its existing ones (Download button, folder-backup). No new field, no `DATA_VERSION` bump — this is exactly the "additive field / behavior change only" case CLAUDE.md says needs no version bump, and here it's not even additive, just a new caller of an existing setter.

**One asymmetry worth flagging explicitly:** tier-1's "backup" is now a *sync confirmation*, not a *file export* — `lastBackupAt` no longer means "a downloadable file exists" for tier-1 rebbeim, only for tier-2/no-tier. The nudge copy (already tier-branched per the design above) is what carries that distinction to the user; the field itself stays generic.

## Managed-Chromebook verification plan

Three separate claims, each needs its own test — don't let one pass stand in for all three.

1. **`navigator.storage.persisted()` actually reports `false` in the guest/managed profile.** Load the app fresh on a managed-Chromebook guest session (or whatever profile type the beta cohort actually uses — confirm which, since "managed" and "guest" aren't always the same profile), open devtools, call `navigator.storage.persisted()` directly. This is the load-bearing assumption the whole step rests on — if it actually returns `true` on these devices, the warning never fires and step 7 is dead code. Test this *first*, before anything else, because it gates whether the rest is even reachable.

2. **The warning bar actually renders correctly** — right variant (tier1 amber / tier2 red-urgent / no-tier default), right copy, at the right trigger point (immediately, not waiting on the 7-day floor). Test as three separate accounts on the same device: no-tier, tier1-claimed, tier2-Drive-linked.

3. **The recommended action actually works end-to-end on that device**: tier1's "Got it" dismiss; tier2's "Back up now" (does `downloadBackupFile()` succeed under managed-Chromebook download restrictions — some lock the Downloads folder) and "Save to Drive" (does the 0b token surface's OAuth popup even open under managed-profile extension/popup policies).

**Who/when:** this cannot be simulated — Ben (only person with a managed-Chromebook unit) runs it manually before step 7 is marked ready, same pattern as step 0c's flagged-but-undone check. Fold both into one Chromebook session rather than two, since 0c's folder-backup and step 7's Drive-save/download path likely fail for the same underlying policy reasons (download/popup restrictions) if either does. **Do not ship step 7 to beta rebbeim until this session runs and both `persisted()`-false and the action paths are confirmed** — an unverified assumption here means either a warning that never shows (silent risk, the exact failure mode the CLAUDE.md fragile-storage rule exists to prevent) or one that shows but whose fix-it buttons don't work on the device it targets.

## What this unblocks

Step 7 is the last *design-only* step in the Firebase rebuild's 8-step build order — once this design is locked (same way steps 1 through 6 were), the build order's design phase is complete end to end. Step 8, the real beta migration, is the last step overall, but it depends on everything through step 7 being **built and verified**, not merely designed — including the managed-Chromebook session above, which must run and pass before step 7 itself is considered done, let alone before step 8 begins.
