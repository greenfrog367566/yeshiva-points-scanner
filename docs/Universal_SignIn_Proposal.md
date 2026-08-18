# Universal sign-in — decision record (identity for everyone, custody still tiered)

> 🔗 **Consolidated 2026-08-18 under `Data_Custody_Decision.md`.** Both records
> were ACCEPTED the same day (2026-08-09) and this doc's conclusions are fully
> restated in `Firebase_Rebuild_Scope.md`'s "Locked decisions." Kept as its own
> file — not folded in — because five other docs (`Data_Custody_Decision.md`,
> `Firebase_Rebuild_Scope.md`, `Firebase_SignIn_UI_Design_Proposal.md`,
> `Account_Privacy_Note.md`, `app.html`) cite it by specific section number
> (§4, §5, §8, §10); collapsing it would break every one of those pointers.
> **Read `Data_Custody_Decision.md` first** — it's the shorter, current
> reference and links back here for the full audit/comparable-products case.

**Status: ACCEPTED, 2026-08-09.** Rabbi Steinerman took it — *"take it — make
sure to include a data upload for current beta rebbeim"* — so §10 is now a
**required part of the accepted design**, not an enhancement, and the doc is a
decision record rather than a proposal.

Written in response to Ben's reaction to the tier-2 data story: *"it looks
half baked and not professional … maybe some sort of sign in for everyone or a
pin? something real besides jsons in drives."* This doc audits the current
setup honestly, grounds the comparison in what similar products actually do,
and takes one change — **everyone signs in** — that fixes the
unprofessional feel without reversing the custody decision taken two days ago.

Related records: `Data_Custody_Decision.md` (the ACCEPTED split),
`Firebase_Rebuild_Scope.md` (open question 11, Path B), issue #218.

---

## 1. The honest audit — what is actually half-baked, and what only looks it

Ben's instinct is right, but the weakness is not where it seems. Four parts:

**Genuinely half-baked — the app has no concept of *who you are*.** Today the
"account" is a browser profile on one machine. Nothing carries a name, nothing
survives a device change, support means "email me your backup file," and two
devices are two unrelated apps. Every professional comparison point below has
identity at the center; Menchmark has none. **This is the real source of the
amateur feel** — everything else is downstream of it.

**Genuinely half-baked — the `file://` offline copy.** Until this morning it
destroyed a rebbi's saved work on every reopen (fixed in #244, but copies in
the field stay broken until re-downloaded). It forks storage, gets no updates,
and can never authenticate to anything. It should be an explicitly-labeled
emergency mode, not a distribution channel.

**Genuinely half-baked — Sheets-as-database via Apps Script.** Paste a script,
deploy it, redeploy on every change, email twelve rebbeim. Already slated to
retire in the rebuild; nothing here changes that.

**NOT half-baked — the Drive backup itself.** "JSON in the user's own Drive"
is the exact pattern WhatsApp uses for chat history (hidden app-scoped Drive
storage, restored on a new phone) — a billion-user production pattern, not a
hack. And "the local copy is the working store, the cloud syncs it" is the
**local-first** architecture that has become a mainstream approach for
offline-capable apps in the last few years — it is what Firestore's own
offline persistence does. The *storage design* of tier 2 is defensible.
**What makes it read as amateur is that it is anonymous** — a naked backup
file with no signed-in experience around it. The frame is the problem, not
the file.

## 2. What comparable products actually do

- **ClassDojo** — free for teachers, and *everyone creates an account*
  (email or Google). Class data lives on their servers (AWS, us-east-1,
  encrypted at rest and in transit), with published security/privacy pages a
  school admin can read. Codes exist — but as **join codes** for students and
  parents, never as authentication.
- **PBIS Rewards / LiveSchool** — school-contracted products. Staff sign in
  with school email + password or one-click SSO through **Clever/ClassLink**
  (the school-SSO brokers most US districts already run); rosters sync from
  the school's SIS. Accounts are provisioned, not self-made.
- **The pattern across all of them:** identity is universal and comes first;
  codes are for joining, not signing in; the storage story sits *behind* the
  account, invisible to the user.

Nobody ships "your browser profile is your account." That is the gap.

## 3. The insight the proposal rests on: identity and custody are separable

The two-tier decision (#218, accepted) is about **custody** — whose
infrastructure holds a school's student records. It was never about whether a
rebbi *has an account*. Those got conflated: tier 2 was sketched as
anonymous-local-plus-Drive, and the anonymity is what feels cheap.

**Proposal: everyone signs in. The tier decides where the CLASS DATA lives —
not whether you exist.**

| | Identity | Class data (students, scores, history) |
|---|---|---|
| **Tier 1** | Google sign-in / magic link (as scoped) | Firestore (as scoped) |
| **Tier 2** | **Google sign-in — same button** | Local (localStorage/IndexedDB) + backup to **his own** Drive (as scoped) |

What Ben's Firestore holds for a tier-2 rebbi is an **account record only**:
email, display name, tier, `schoolId` (null), created-at. No student names, no
scores, no photos, no behavior records — those never leave the rebbi's device
and his own Drive. Holding a consenting adult's email address is ordinary
SaaS territory (a privacy page and a deletion promise, i.e. part of Q3's
writing task); holding a stranger school's student records was the liability
the split exists to avoid. **The custody decision stands untouched.**

## 4. What this buys, concretely

- **The professional feel Ben is asking for.** The app opens with *"Signed in
  as bsteinerman@gmail.com · Class backed up to your Drive 12 minutes ago."*
  Same button, same account system for every rebbi. Tier is invisible
  plumbing, exactly as it is in every comparable product.
- **The Drive spike's `login_hint` requirement solved structurally.** The
  spike proved silent token renewal works *only when the app names the
  account*. Under universal sign-in the account **is** the hint — captured
  once, persisted, sent on every renewal. The multi-account-browser failure
  mode (the one that misled the spike for an hour) can't recur.
- **Tier migration collapses to a field flip plus the converter.** Open
  question 11's sub-question 4 (a standalone rebbi adopted when his school
  signs on) currently implies creating an account *and* moving data. With the
  account already existing, adoption = set `schoolId` + run the
  backup-upload converter. Q2's verification stays; the account half vanishes.
- **Support gets a name.** "Which rebbi are you?" stops being a question.
  Even without tier-1 view-as, a tier-2 support thread starts from a known
  account with a known backup location.
- **Multi-device for tier 2 becomes *possible* later** (restore-from-Drive on
  a second machine is already real; the account makes it discoverable —
  "found your backup from Aug 9, restore it?"). Not promised now; unlocked.
- **The middle-tier exit gets cheaper, not dearer.** If two storage
  implementations ever prove too costly, every tier-2 rebbi *already has an
  account* — promoting them into a gated single backend is a data migration,
  not an identity migration.

## 5. How it fits rule 3 and the SDK question (no new conflict)

This does **not** drag the Firebase SDK into tier 2:

- **Sign-in:** the Drive spike already proved no-SDK Google sign-in — plain
  redirect, token from the fragment, zero external scripts. Tier 2 reuses
  exactly that code path (it needs it anyway for the Drive backup; identity
  rides the same consent).
- **The account record:** Firestore has a **full REST API**
  (`firestore.googleapis.com/v1/…`) that accepts a bearer token from plain
  `fetch` — and Firebase Auth likewise has a REST API for exchanging a Google
  credential for a Firebase ID token. Writing one small account document at
  sign-in needs no SDK, no bundler, no new `<script src>`.
- Tier 1 still loads the vendored SDK per open question 1's recommendation.
  Nothing about that choice moves.

Security note, stated honestly rather than papered over: the class data on a
tier-2 machine is unencrypted local storage, and sign-in does not change
that — anyone with the rebbi's OS session can read it. That is equally true
of Firestore's local cache and of every comparable product's offline cache.
The real mitigation is OS-level user accounts, and the docs should say so
plainly rather than implying a PIN fixes it.

## 6. What a PIN is, and is not (answering "or a pin?")

Three different things hide in that word — they need three different answers:

1. **A join/scoping code typed once at signup** — ✅ already designed. This is
   `Firebase_Rebuild_Scope.md` open question 11: a school's code drops the
   rebbi into that school (tier 1); a beta PIN creates a standalone account.
   Comparable products all have this (ClassDojo class codes); none call it
   sign-in.
2. **A device screen-lock for a shared classroom machine** — a real idea,
   explicitly out of this build (OQ11's "what it does NOT mean"). Worth
   keeping on the someday-list for shared Chromebooks; changes nothing about
   data custody.
3. **A PIN as the actual credential** — ❌ recommend against, firmly. A short
   guessable secret with no recovery story and no identity behind it is
   *less* professional than what exists today, and no comparable product does
   it. Google sign-in is the same one-tap gesture and brings a real identity.

## 7. The alternative, considered and NOT taken (2026-08-09)

If the true objection is not "anonymous" but "two storage implementations,"
the honest alternative is the **middle tier now**: one Firestore backend for
everyone behind an explicit "I am authorized to enter student data" gate plus
a written deletion/breach policy — what most free ed-tech ships, and what Ben
named as the fallback when accepting the split. It is simpler (one
implementation) and more capable (sync and view-as for all), and it reinstates
exactly the liability the split was taken to avoid: strangers' student records
in Ben's project, now with a checkbox in front. This proposal deliberately
does *not* recommend it — but if Ben reads §4 and still wants "one real
backend," that is the shape of that decision, and `Data_Custody_Decision.md`
§1 already records how to take it without unpicking the architecture.

## 8. The cohort sign-in cannot reach — and why it doesn't sink this

The truly-never-online rebbeim (a real subset — most current offline users
run the downloaded `file://` copy, and some can never get online at all)
cannot sign in to anything, ever. So sign-in must be **default, not wall**:

- Any rebbi who ever touches the network signs in — at setup for new users,
  via a one-time "connect your account" nudge for existing ones.
- The never-online path survives as today's storage under an explicit
  **emergency/offline label** (the hardened post-#244 file), documented as
  outside the backup and support story. That is a *truthful* label for what
  it already is — and it is precisely the cohort the File System Access
  local-folder backup (`Daily_Backup_Spec.md`) exists to protect. That build
  gets *more* urgent under this proposal, not less, because it is the only
  net under the one cohort sign-in can't cover.

## 9. Accepted — the edits this now owes

**⚠️ Sequencing, and it is the reason these are not in this PR.** Items 1 and 2
below rewrite `Firebase_Rebuild_Scope.md` and `Data_Custody_Decision.md` —
**the same two files PR #242 rewrites, and #242 is still open.** On `main`
today `Data_Custody_Decision.md` still reads *PROPOSED* and the rebuild scope
has no custody section at all, so writing these edits from a `main`-based
branch would produce a guaranteed conflict and two contradictory versions of
the same decision. **Merge #242 first; these land immediately after, in one
clean pass.** Nothing here is blocked on anything else.

1. `Firebase_Rebuild_Scope.md`: "Tiers and gating" gains **"identity is
   universal; tier gates where class data lives"**; the tier-2 bullet in the
   custody section gains the account-record line; open question 11 absorbs
   the account-exists-before-tier framing (its sub-question 4 shrinks); the
   converter-tool section gains **self-serve restore** (§10.2) and the
   build order gains the beta upload path **ahead of** any sign-in rollout.
2. `Data_Custody_Decision.md`: a dated addendum — Q1's "tier 2 is everything
   Menchmark is today" now *plus a sign-in*; the account-metadata liability
   note lands under §1's risk list.
3. Q3's writing task (what a school signs) gains a small sibling: a
   plain-language privacy note covering the account record itself, needed
   before *any* self-serve signup, both tiers.
4. The Drive backup feature (post-spike) is built **behind the account**, so
   the backup UI always shows which Google account holds the file.
5. No `DATA_VERSION` bump anywhere in this — account state is additive
   (`load2fix()` backfill for a `data.account` stub or a separate key,
   decided at build time with the migration diff shown first, per CLAUDE.md).
6. **§10's upload path gets its own build slice with a verification harness**,
   not a bullet inside another step. It is the largest data migration in the
   project's history after 2c, and open question 6 already notes the rebuild
   has *no* Firestore analogue to `test-migration.html`. Whatever proves the
   converter correct must prove this correct too — same harness, same gate.

## 10. Bringing the current beta cohort in — REQUIRED, and it gates sign-in itself

**Ben's condition on accepting: *"make sure to include a data upload for
current beta rebbeim."*** This section is that requirement.

**Why it is a gate rather than a nice-to-have.** The beta cohort onboarded on
v0.9.0 (2026-07-18) and has real classes in `localStorage` **today** — scores,
attendance, homework, Shulchani balances, months of history. Universal
sign-in makes signing in the front door of the app. If a rebbi signs in and
his class is not there, sign-in is a **downgrade**, and we will have taken the
one thing he trusts and hidden it behind a new screen. **So the upload path
ships before any beta rebbi is asked to sign in — not after, not alongside.**

### The three ways his data gets in

**1. Same-device adoption — the common case, and the one to make excellent.**
Most beta rebbeim will sign in on the very machine they already teach with,
where the class is already in `localStorage`. That needs **no file and no
export**: the app detects a local class at sign-in and offers to claim it.

> *"This device has a class — Sample Class 1, 24 boys, last scan today. Add it
> to your account?"*

One button, no round trip. Anything more than that will lose people.

**2. Backup-file upload — new device, recovery, and the `file://` cohort.**
He downloads a backup (the existing `downloadBackupFile()`), signs in
anywhere, uploads the JSON. This is the converter tool's **backup-upload
mode**, with one change that is the actual scope addition: **it must be
self-serve.** `Firebase_Rebuild_Scope.md` currently scopes the converter as
"Superadmin-gated at minimum." A rebbi restoring *his own* class into *his
own* account must not need Ben to run it for him — that is exactly the
"email me your backup file" support burden this rebuild exists to end. Keep
the superadmin bulk/provisioning modes gated; ungate self-restore.

**3. Drive restore — tier 2, once the Drive backup ships.** *"Found a backup
in your Drive from Aug 9 — restore it?"* This is what makes the account feel
like an account on a new machine, and it is the cheap win noted in §4.

### Safety properties — non-negotiable, and each one is a lesson already paid for

- **Never silently overwrite a class already in the account.** If the account
  holds data and the upload differs, that is the rebbi's choice, not an
  automatic action. **Exactly the #244 seed-guard shape** — the offline copy
  destroyed months of work by writing a snapshot over live data without
  asking. Do not rebuild that bug in the cloud.
- **Idempotent.** Uploading the same backup twice must not duplicate students,
  log entries, or tracked rows. Tier 1 gets this from the rebuild's
  deterministic write IDs (open question 3); **tier 2 needs the same
  discipline explicitly**, since it has no server-side dedup.
- **Non-destructive until verified.** The scope says "old localStorage retires
  on conversion" with a one-time *"your class has moved"* screen. That screen
  **must not fire until the data is provably in the account** — read it back
  and compare counts, then retire. A conversion that half-succeeded and then
  cleared the local copy is the worst outcome available.
- **A stored receipt**, in the shape this codebase already uses
  (`data.attConversion`, `data.mirrorBackfill`): what was uploaded, when, and
  from where. It makes a second run safe and gives support something to read.
- **Carry the WHOLE class, not the obvious half.** Students and scores are the
  easy part. It must also carry activities, the log, tracked items and
  `trackedData`, Shulchani balances, raffle/prize history, seating, and
  settings. **A partial import that reports success is worse than a clean
  failure** — the rebbi trusts it and finds the hole in November.

### What "upload" means per tier — the counterintuitive half

- **Tier 1:** upload → Firestore collections, via the converter path. Data
  genuinely moves to the server.
- **Tier 2:** the data **does not go anywhere.** It stays on his device, as
  designed. "Upload" here means *claim it under his account and start backing
  it up to his Drive* — the class becomes his account's class, with a backup
  behind it. Nothing about custody changes; §3's table still holds.

### The cohort this cannot reach, stated plainly

Rebbeim running the downloaded `file://` copy hold their class in a **separate
origin's storage** that same-device adoption cannot see, and some of them are
never online at all. For them the only route is: export a backup from inside
that copy, carry the file to a connected machine, upload it there. That works,
but it is manual and it will not happen by itself — it needs Ben to walk them
through it, and it is one more reason the `file://` path should be an
explicitly-labeled emergency mode (§8) rather than a distribution channel.

## 11. What this doc does not decide

- ~~Whether Ben takes it.~~ **Taken 2026-08-09** — §4 was the case, §7 the
  alternative, and the alternative was **not** chosen. Left visible so nobody
  re-derives the comparison from scratch.
- Anything about Firestore collection design — that stays step 1 of the
  rebuild, which this proposal feeds but does not preempt.
- The screen-lock PIN (§6.2) — someday-list, separate.
- Retiring the `file://` copy — related (§8), argued elsewhere, not decided
  here.
