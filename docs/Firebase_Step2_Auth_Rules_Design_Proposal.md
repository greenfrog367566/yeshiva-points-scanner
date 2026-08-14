# Firebase Rebuild — Step 2 Auth & Security Rules Design (Proposal)

## Status

Draft proposal from an ultraplan design-panel session, pending Ben's review — not yet a committed decision, same status step 1's proposal had before approval.

## Recommended auth + security rules design

**Identity mapping: account-doc lookup (B & C), not custom claims (A).** Adoption (`schoolId` flipping null→set) and "view as" both need to work on the *next request*, not after a token refresh — that's a hard UX requirement from the scope doc, not a nice-to-have. Claims fail exactly this case. Firestore caches `get()` results per rule evaluation, so the extra read is cheap at beta scale. A's `get()`-per-subcollection pattern (one lookup on the parent `classes` doc, reused by every child match) is adopted wholesale — it's the cleanest way to avoid duplicating `ownerId`/`schoolId` onto every entry doc.

**"View as": no impersonation, no token trick — adopt C over B.** Superadmin's own `isSuperadmin()` grant already permits read of any class; "view as" is just the client querying normally with the superadmin's real token. This is strictly safer than B's approach (no forgeable elevated session to reason about) and no more complex. Keep B's one good idea on top: **every superadmin *write* stamps `lastWriteDevice: "superadmin:"+uid`**, so a rebbi sees the actor trail — writes stay rare (support fixes) and logged, never silent.

**Admin write access: field-restricted (C), not blanket.** Admin can toggle `sharedWithAdmin`/`archived` on a class via `diff().affectedKeys().hasOnly([...])` — never touch roster, entries, or ledger content. This closes the "admin edits the gradebook" hole that A and B both leave open by giving admin no special write path at all (safe, but C's explicit restriction is the more defensible statement of intent for a reviewer).

**`sharedWithAdmin` stays a class-level field**, per the *already-locked* step-1 shape — not A's separate `teachersBook` document. That document doesn't exist in the approved model; inventing it now would be scope creep on a settled entity. Flag it as an open follow-on: the scope doc's Class-Book-vs-Teacher's-Book split needs a `book` marker on `trackedItems` before rules can distinguish "always admin-visible" (attendance/homework/recognition) from "gated" content within the same flat `trackedEntries` collection — today the class-level flag is the only lever, so treat it as gating everything until that item-level field lands.

**Codes:** `read: if request.auth != null` (B) — needed pre-account-doc, at signup. **Redemption (`usedBy` append) goes through a Cloud Function transaction, never a raw client write** (C) — closes the race-condition over-redemption hole neither A nor B addresses.

### Full rule coverage

```
function acct() { return get(/databases/$(db)/documents/accounts/$(request.auth.uid)).data; }
function isSuperadmin() { return acct().role == 'superadmin'; }
function isAdminOf(sid) { return acct().role == 'admin' && acct().schoolId == sid; }
function isOwner(c) { return c.ownerId == request.auth.uid; }
function canRead(c) { return isOwner(c) || isSuperadmin() || (isAdminOf(c.schoolId) && c.sharedWithAdmin == true); }
function parentClass(classId) { return get(/databases/$(db)/documents/classes/$(classId)).data; }

match /accounts/{uid} {
  allow read: if request.auth.uid == uid || isSuperadmin() || isAdminOf(resource.data.schoolId);
  allow write: if false; // Cloud Function (provisioning, adoption) only
}
match /codes/{code} {
  allow read: if request.auth != null;
  allow write: if isSuperadmin() || isAdminOf(resource.data.schoolId); // usedBy: Cloud Function txn only
}
match /classes/{classId} {
  allow read: if canRead(resource.data);
  allow write: if isOwner(resource.data) || isSuperadmin()
    || (isAdminOf(resource.data.schoolId)
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['sharedWithAdmin','archived']));

  match /students/{sid}       { allow read, write: if isOwner(parentClass(classId)) || isSuperadmin() || (isAdminOf(parentClass(classId).schoolId) && parentClass(classId).sharedWithAdmin == true && request.method == 'read'); }
  match /trackedItems/{iid}   { same pattern as students }
  match /trackedEntries/{eid} { same pattern as students }
  match /prizeLedger/{eid}    { allow read, write: if isOwner(parentClass(classId)) || isSuperadmin(); } // no admin default-read — private ledger
}
```

Activity overview: separate `activitySummary` collection, superadmin-read-only, written only by a Cloud Function trigger — never client-writable (C's isolation, so a compromised rebbi client can't fake "last active").

## Sign-in flows (Path A and Path B)

### Path A — Provisioned (magic link)

**Before**: superadmin/admin runs a Cloud Function: creates `accounts/{uid-placeholder-or-email-keyed-doc}` with `role:"rebbi"`, `schoolId` set, plus a Firebase Auth email-link invite. No `classes` doc yet (or one pre-seeded with `ownerId` = the invited email/uid).

**Screens**: Rebbi clicks link → Firebase Auth email-link sign-in completes → app reads `accounts/{uid}`. If account already carries `schoolId`+`role`, skip straight to app (no code screen at all — the provisioning *was* the approval).

**Reads/writes**: 1 read (`accounts/{uid}`) on load. If no `classes` doc exists for this `ownerId` yet, show a one-time "name your class" screen → single `classes/{ownerId}_1` write.

### Path B — Self-serve (Google Sign-In + code)

**Screens**: "Sign in with Google" → optional code field (blank = beta/tier-2) → "Continue."

**Flow**:
1. Google Sign-In completes (Firebase Auth).
2. App reads `accounts/{uid}`. **Missing** → this is first sign-in.
3. If code entered: client reads `codes/{code}` (rule: `auth != null`). Client validates unrevoked + under `maxUses` locally for immediate UX, but the real redemption is a **Cloud Function call** (`redeemCode(uid, code)`) that transactionally re-checks and appends `uid` to `usedBy`, then writes `accounts/{uid}` with `schoolId`/`role` from the code (or `schoolId:null, role:"rebbi"` if blank).
4. Function returns; client re-reads `accounts/{uid}` (or receives it in the function response) → now has `schoolId`/tier.
5. "Name your class" screen → `classes/{uid}_1` write with `ownerId:uid`, `schoolId` from account.
6. `localStorage.lastKnownSchoolId` set to match — arms the promotion-edge check for later adoption, never fires on this first run since there's no prior local data to migrate.

**Existing account, later sign-ins**: `accounts/{uid}` read → straight into the app, no code screen, no class-creation screen.

## Proving gating works before step 4's UI exists

### Rules Verification Harness (step 2's "test-migration.html")

**Tool:** Firebase Emulator Suite (`firebase emulators:start --only firestore`) + `@firebase/rules-unit-testing`. This is the standard way to unit-test Firestore rules without any app UI — analogous to how `test-migration.html` exercises `migrateData()` without the full app.

**Concrete artifact: `firestore.rules.test.js`**, run via `firebase emulators:exec`. Structure:

1. **Seed fixtures** directly into the emulator (bypassing rules, as admin): two `accounts` docs (rebbi A `uid:"a"`, rebbi B `uid:"b"`, both `schoolId:null`), two `classes` docs each owned by A and B respectively, plus one `admin` account and one `superadmin` account, one school-scoped class with `sharedWithAdmin:true` and one with `false`.

2. **A fixed matrix of (actor, target, operation) → expect allow/deny**, one test per row — this is the whole point, expressed as data, not prose:
   - A reads/writes own class → allow
   - A reads B's class → **deny** (the core gating claim)
   - A reads B's `students` subcollection directly → **deny**
   - A writes `sharedWithAdmin` on own class → allow; A writes it on B's → deny
   - Admin reads school class with `sharedWithAdmin:false` → deny; `true` → allow
   - Admin writes roster/entries/ledger → deny (field-restricted, not blanket)
   - Admin writes `archived`/`sharedWithAdmin` only → allow; same call adding a third key → deny
   - Superadmin reads/writes any class → allow
   - Unauthenticated read of `codes/{code}` → allow; write → deny
   - Any client write to `accounts` or `codes.usedBy` → deny (Cloud-Function-only)

3. **CI wiring:** add a `firestore-rules` job to `.github/workflows/validate.yml` alongside the existing JS/CSS checks, gated by the same `main-protection` ruleset — so step 2 is provably done when this suite is green, not "rules look right."

This proves the gating claim mechanically, before step 4's UI exists to click through it.

## "View as this rebbi" mechanism

**Server-issued, short-lived scoped session — not the superadmin's own token used directly, and not a real credential handoff.**

**Flow:**

1. Superadmin clicks "View as" on a rebbi's account. Client calls a Cloud Function `viewAs(targetUid)`.
2. The function checks `acct(callerUid).role == 'superadmin'` server-side, then mints a **custom token** via Admin SDK with extra claims: `{ uid: callerUid, viewAs: targetUid, viewAsExp: now+30min }` — note the token's `uid` stays the superadmin's own; `viewAs` is a claim, not an identity swap.
3. Client signs in with that custom token in a **second, isolated Firebase Auth instance** (`initializeApp(config, "viewAs")`), keeping the superadmin's primary session untouched in the default instance. This makes it a side panel/second tab experience, not a silent identity switch — the UI chrome should visibly banner "Viewing as {rebbi}" so it's never ambiguous which session is live.
4. Security rules add one function: `viewAsUid() { return request.auth.token.viewAs; }` and `canRead` becomes `isOwner(c) || isSuperadmin() || (request.auth.token.viewAs != null && c.ownerId == request.auth.token.viewAs)`. Critically, **the `viewAs` claim only grants read** — write rules never check it, so a compromised or copy-pasted view-as token can't be used to mutate the rebbi's data. Support fixes still go through the real superadmin write path (`isSuperadmin()`), which already stamps `lastWriteDevice: "superadmin:"+uid` per the design above.
5. Token expires in 30 min (short-lived by construction, no revocation list needed); client also has an explicit "Exit view-as" button that just signs out the second instance.
6. Every `viewAs` mint is logged (function writes to `activitySummary` or a dedicated `viewAsLog` collection) — a superadmin looking at a rebbi's data always leaves a trail, even though no write occurred.

**Why this satisfies both constraints:** no credential ever moves (the rebbi's password/token is never touched or exposed); superadmin has zero standing blanket-read grant on `students`/`trackedEntries`/`prizeLedger` — `isSuperadmin()` alone still covers full access per the rules above for support writes, but the *read-only, time-boxed, logged* `viewAs` claim is what's actually exercised for the common "look at his screen" case, keeping the everyday path least-privilege even though the escape hatch (full superadmin) still exists for genuine fixes.

## Admin self-provisioning

**Both writes route through a single callable Cloud Function, `provisionRebbi(email)` — never a direct client write.**

Why a function, not a rule-gated client write: `accounts/{uid}` already has `allow write: if false` (identity docs are function-only, settled above), so provisioning can't be a client `set()` no matter how the rule is worded. Doing it in a function also lets the *server* derive the school, closing the cross-school hole a client-supplied `schoolId` param would open (an admin client could just lie about which school it's provisioning into).

**Function logic (Admin SDK, bypasses rules, enforces the constraint itself):**
1. Verify caller: `acct(caller.uid).role == "admin"`. Reject otherwise.
2. Ignore any `schoolId` in the request payload entirely — pull it from `acct(caller.uid).schoolId` instead. This is the actual guarantee: an admin can only ever mint accounts inside his own `schoolId`, because the function never trusts the caller for that value.
3. Create/find the invitee's `uid` (Admin Auth `getUserByEmail`/`createUser` for the magic-link target).
4. Batch-write, atomically:
   - `accounts/{newUid} = { role: "rebbi", schoolId: adminSchoolId, ... }`
   - `classes/{newUid_1} = { ownerId: newUid, schoolId: adminSchoolId, name: "", sharedWithAdmin: false, archived: false, lastWriteDevice: "admin:"+caller.uid, ... }` (empty starter class, Path A pattern — deterministic id keeps it idempotent on retry)
5. Send/return the magic-link token for that `uid`.

**Rules stay unchanged and still do real work:** `classes` write rule already lets `isAdminOf(schoolId)` touch only `['sharedWithAdmin','archived']` on *existing* docs — that path is irrelevant here since the function uses Admin SDK, but it means even if someone tried a direct client-side class creation as "admin," the field-restriction rule would reject a `create` outright (a create's diff is against `{}`, so `hasOnly` fails), forcing the function path by construction, not just convention.

## What this unblocks

With identity mapping, both sign-in paths, the rules matrix, "view as," and admin provisioning all specified and mechanically provable via the emulator harness, **step 3 (the converter tool)** can now target a concrete, testable account/class shape — it knows exactly which fields (`ownerId`, `schoolId`, `sharedWithAdmin`) a converted class must carry to pass the rules it will be written under. **Step 4 (the UI)** can build sign-in, code-redemption, and "view as" screens against Cloud Functions whose contracts are already fixed here, rather than guessing at them. Later steps that depend on tier gating being real (not just described) can point to the `firestore-rules` CI job as evidence rather than re-deriving trust in the rules by hand each time.
