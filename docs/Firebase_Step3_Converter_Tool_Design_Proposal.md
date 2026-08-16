# Firebase Rebuild — Step 3 Converter Tool Design (Proposal)

## Status

**✅ APPROVED 2026-08-13 by Ben.** Locked into `Firebase_Rebuild_Scope.md`'s build order as step 3's design. This doc is now the reference for the converter architecture, verification harness, throwaway-account proof plan, Cloud Function wiring, and staged rollout below.

## Recommended converter-tool design

**Where it runs:** Two thin surfaces, one core. `tools/admin-convert.html` (superadmin: bulk, provisioning, backup-upload for any rebbi) and a `<script>` mount inside `app.html`'s tier-1 first-run/Settings screen (self-serve, own-account only). Both call the same vanilla-JS module, `tools/converter-core.js` — no build step, rides the rule-3 SDK exception (**C**). Normalization is never re-implemented: backup JSON is run through `migrateData()`/`load2fix()` **in-browser** via C's hidden-iframe bridge (`window.__exportNormalized()`) before anything is written, so the converter can never drift from the shape app.html itself trusts — the exact failure mode `test-migration.html`'s duplicated copies already warn about.

**Writes route through Cloud Functions, not client `set()`s** (**A**+**B**): `accounts/{uid}` is `allow write:if false` by design, so account creation/adoption has no client-side path regardless. One function, `provisionRebbi({mode, payload})`, handles roster-only and backup-upload (see "Account and code creation" below for the full mode list, including admin-invite); self-serve restore is the same body with `auth.uid` forced as target instead of a payload field (**A**'s self-serve-is-the-same-path insight). Each call writes classes/students/trackedItems/trackedEntries/prizeLedger atomically in one batch — commit-whole-or-write-nothing, so partial-success is structurally impossible.

**Naming (2026-08-14, consistency pass):** this doc's draft originally called the function `provisionAndConvert`/`restoreOwnClass` in this section while the "Account and code creation" section below settled on extending `provisionRebbi` — that's the canonical name used everywhere else (including step 3b, which only ever calls `provisionRebbi`). Read every reference to `provisionAndConvert`/`restoreOwnClass` below as `provisionRebbi({mode:...})`.

**Four flows:**

- **Roster-only:** shared roster-entry component (scope doc's one-component/two-mount-point idea) → `provisionAndConvert({mode:"roster"})` → starter class + magic link.
- **Backup-upload:** JSON → iframe-normalized via `load2fix()` → preview/diff screen (counts + sample rows) → human confirms → function writes.
- **Bulk:** admin page loops `provisionAndConvert` sequentially over the beta list with per-row status (queued/running/verified/failed) — **B**'s client-side-loop-not-server-batch-job choice, so a bad row doesn't stall the rest and is individually re-runnable, and progress stays observable mid-run rather than opaque inside one giant function invocation.
- **Self-serve restore:** rebbi's own Settings button → `restoreOwnClass`, auth-checked, no admin involved.

**Safety properties, mapped to source:**

- *Never silently overwrite:* function checks for an existing non-empty class at the deterministic id first; refuses unless an explicit `force:true` confirm was shown (**B**'s surfaced-not-silent overwrite gate) — for self-serve this becomes A's "offer restore-as-new-class" rather than any overwrite at all.
- *Idempotent re-upload:* deterministic ids (`ownerId_seq`, `deviceId_ts_seq`) make every writer a no-op `set()` on rerun, proven by literally running the converter twice and asserting zero new docs (**A**'s stated verification step).
- *Non-destructive until verified:* count-parity + per-student spot-check + idempotence-rerun run server-side post-write; a run is not marked "done" until the harness reports zero mismatches (**B**).
- *Stored receipt:* `classes/{id}/importReceipts/{runId}` — counts, timestamp, mismatches — mirroring `data.attConversion`'s shape (**A**+**C** agree verbatim).
- *Carries the whole class:* falls out of reusing the same `load2fix()`-normalized object every writer already trusts (**C**) — nothing hand-picked field by field, satisfying the "partial import that reports success is worse than clean failure" bar directly.

**Traded away:** C's pure iframe-bridge failure mode (postMessage/CSP/load timing) is accepted for normalization safety; B's server-side Node CLI option is dropped — bulk stays browser-driven, matching beta-cohort scale (dozens, not thousands).

## Verification harness implementation

**Where it runs:** Server-side, inside `provisionAndConvert`/`restoreOwnClass` themselves, immediately after the atomic write batch commits and before the function returns success. Client-side verification can't be trusted as the gate — a closed tab or crashed browser would leave a write "unverified" forever with no one watching.

**Count parity + spot-check + idempotence:** Function re-reads back everything it just wrote (same batch's doc refs — cheap, no query fan-out), computes counts against the normalized source object it already had in memory, and diffs. Idempotence isn't a separate manual step: since every write is `set()` on a deterministic id, the function's own retry-safety *is* the idempotence check — the harness asserts zero new doc count on any re-run of the same `runId` input, which the bulk-mode "run twice" QA pass exercises directly.

**Result:** `classes/{id}/importReceipts/{runId}` — `{status: "verified"|"mismatch", counts:{before,after} per collection, mismatches:[], spotCheckSample:[...5 students], ts}`. `status` only becomes `"verified"` if every count matches and the spot-check sample round-trips clean; anything else writes `"mismatch"` and the batch is *not* rolled back (writes already committed atomically) but is flagged, never silently reported done.

**Manual diff report UI:** both mount points (`admin-convert.html` and the Settings self-serve panel) render the receipt as a before/after table — one row per collection (students, trackedEntries, log, prizeLedger, …) with old count → new count and a ✓/✗ — plus a 5-row student sample (name, section, tracked-entry count) for eyeball confirmation. A single "Looks right, retire local copy" button is the only thing that flips a local flag (`data.firebaseMigrated = runId`); it's disabled unless `status === "verified"` and reads directly off the receipt.

**What blocks retirement:** two independent gates — (1) the receipt's `status` field, computed server-side, and (2) that button, requiring an explicit human click. Neither the local copy nor the old localStorage blob is ever auto-deleted or auto-marked stale by the converter itself — retirement is 100% human-triggered, and the button is unreachable until the server-side harness says clean.

## Proving it on a throwaway account

Throwaway target: a second Firebase project (`menchmark-migration-test`, separate from prod), Blaze-sandbox tier, empty Firestore, brand-new Auth user created by the run.

Source data: `sample-backup.json` (repo's existing safe demo data) extended, not replaced — add to it until it's no longer thin: ≥15 students, ≥3 tracked items each with ≥10 `trackedData` entries spanning multiple dates, non-empty `attendance`/`hw`/`passes`/`trackerLog`, a closed `miniContestPast` entry, `store` purchases, `raffle` winners, and Shulchani `scores` as Prutot with `shulchaniMode:true`. This is the "gradebook data" the step exists to prove — a bare roster with no tracked history doesn't exercise the mirror/backfill logic at all.

Procedure:

1. Run the sanitized JSON through `migrateData()`/`load2fix()` in-browser (the iframe bridge), confirming it's the same normalized object app.html itself would trust.
2. Call `provisionAndConvert({mode:"backup-upload"})` against the throwaway project, targeting a fresh throwaway `uid`.
3. Run the existing count-parity + idempotence-rerun + per-student spot-check harness (already scoped) — necessary but explicitly *not* sufficient here.

Proof beyond count-parity — the part that actually validates "gradebook data survived," not just "N documents exist":

- **Read-model check, not just write check:** open `app.html` pointed at the throwaway project (tier-1 mode), sign in as the throwaway account, and confirm the Gradebook tab renders the same per-student/per-item numbers the original localStorage `data.trackedData` produced — computed independently by walking source JSON in a scratch script, not re-derived from the same converter code that wrote it. This catches shape-right-but-semantically-wrong bugs (e.g. `firstName`/`lastName` split misattributing entries, `entryId` collisions silently dropping same-timestamp entries) that count parity cannot see.
- **Referential check:** every `trackedEntries.itemId`/`studentId` and `prizeLedger.studentId` resolves to a doc that actually exists in that class's subcollections — no orphaned foreign keys.
- **Ledger-math check:** Shulchani balance recomputed from `prizeLedger` + `trackedEntries` deltas matches the migrated `scores` value directly, not just "row count matches."

Pass bar: all three checks green plus existing count-parity/idempotence, on the same throwaway run, before this step is called proven.

## Account and code creation (wired to step 2's Cloud Functions)

**Extend `provisionRebbi`, don't fork it.** One callable, `provisionRebbi({mode, payload})`, gains a `mode` param: `"admin-invite"` (existing behavior, unchanged), `"roster"`, `"backup"`. All three share the same body shape — verify caller, mint/find uid, batch-write `accounts/{uid}` + starter/converted class atomically — they only differ in what populates the class doc and whether roster rows or a normalized backup blob feed the student writes. Bulk mode is not a fourth code path; it's the admin page calling `provisionRebbi({mode:"roster"|"backup"})` once per row in a client-side loop (already scoped that way for per-row status/retry).

**Caller check branches on mode**, since roster/backup can be invoked two ways:

- Admin-driven (bulk or single, from `tools/admin-convert.html`): require `acct(caller.uid).role in ["admin","superadmin"]`, derive `schoolId` from the caller's account exactly as `provisionRebbi` already does — never trust a client-supplied `schoolId`.
- Self-serve restore (`restoreOwnClass`): same function body, but target uid is forced to `context.auth.uid` and the caller-role check is skipped — a rebbi restoring his own backup isn't "provisioning" anyone. This is `provisionRebbi({mode:"backup", self:true})` under the hood, not a separate function, so it inherits the identical batch-write/idempotence/receipt logic rather than a second implementation to keep in sync.

**Code issuance is unchanged, just parameterized by mode:** existing admin-invite flow generates a magic-link token via Admin Auth after the batch commits; roster/backup modes call the identical "generate token, return to caller" step at the end of the same function — the difference is only in what got written to `classes/{uid_1}` beforehand (empty starter vs. converted roster/backup data). For bulk, each row's response carries its own token, letting the admin page hand out N distinct magic links from one queued/running/verified/failed table, with no separate issuance mechanism to build.

**No second account-creation path exists at any point** — every route that ends in a new `accounts/{uid}` doc funnels through this one function, satisfying step 2's `allow write:if false` constraint by construction rather than convention.

## Staged rollout plan

Staged rollout for the converter, before any real beta rebbi:

**Stage 1 — synthetic data, unit level.** Run `converter-core.js` against `sample-backup.json` and hand-crafted edge-case blobs (empty class, 1 student, malformed `name` with no last-word split, huge `trackedData`, pre-v5 unmigrated save). Assert: `migrateData()`/`load2fix()` normalization happens before any write, count parity holds, idempotence (rerun → zero new docs) holds. All on a throwaway Firebase project, never the real one.

**Stage 2 — synthetic data, full flow.** Exercise all four flows (roster-only, backup-upload, bulk-of-N synthetic rows, self-serve restore) end-to-end against the throwaway project via the real Cloud Function (`provisionAndConvert`/`restoreOwnClass`), not a mock. Verify the overwrite-refusal gate actually blocks a second run without `force:true`, and that `importReceipts` gets written correctly. Kill the function mid-batch (simulate network drop) and confirm partial-write-treated-as-success cannot happen — batch-commit means it can't half-land.

**Stage 3 — real shape, fake identity.** Take Ben's own real backup (or a beta rebbi's, with permission) but write into a throwaway account (`test-superadmin` provisioning a fake email), never the rebbi's real `uid`. This is the first test with real class complexity — Shulchani balances, freeze state, contest history, seating — since synthetic fixtures won't naturally cover all of it.

**Stage 4 — one real rebbi, real account, opt-in.** Pick one cooperative beta rebbi. Run backup-upload into his real account. He personally reviews the diff screen before confirming. Keep his old localStorage/file:// copy untouched as fallback.

**Go/no-go gate before step 3b is trusted with the cohort:**

- Zero mismatches across 3 consecutive Stage-2 runs (count parity + idempotence)
- Overwrite gate proven to block, not just documented
- Stage 4 rebbi confirms his data (points, tracked items, coin balances) matches what he had
- Receipt doc present and correct for every run in Stages 2–4
- No partial-write observed under simulated failure

Only then does step 3b proceed to the full beta list.

## What this unblocks

With the converter's design, verification harness, throwaway-account proof plan, account/code-creation wiring, and staged rollout all settled, **step 3b (existing-cohort upload)** has an unambiguous, pre-tested path to run against the real beta list — no open questions about how a write happens, how it's proven safe, or how a rebbi gets his account and magic link. It also gives later steps (retiring the file:// offline copy, Sheets-as-database, and Apps Script) a concrete migration mechanism to point at, rather than a deferred "and then we convert everyone somehow."

**Flagged, not yet resolved (2026-08-14, consistency pass):** `tools/admin-convert.html` is a new standalone file loading the vendored tier-1 Firebase SDK, same as `admin.html` in step 5. CLAUDE.md rule 3's amendment scopes the SDK exception to `app.html` and says "anything beyond the SDK is a fresh PROPOSE FIRST" — this doc doesn't explicitly ask that question. `test-migration.html` is a precedent for a second local tool file, but it doesn't load the SDK, so it isn't a clean match. Confirm with Ben before implementation that a second/third SDK-loading file is within rule 3's intent, or get an explicit yes on the record the way the original SDK-vendoring call got one.
