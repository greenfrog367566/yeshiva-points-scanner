# Two-tier data custody — decision record (#218)

**Status: ACCEPTED, 2026-08-09.** Rabbi Steinerman took the split. His
reasoning, in his words: *"do the split — can always do the middle tier
later."* That second half is load-bearing and is recorded in §1 as the
fallback, not as an afterthought.

Nothing here is built yet. This document was written on 2026-08-07 as a
PROPOSED record, because issue #218 is long and its open questions are easy to
re-litigate piecemeal; the goal was to make each one decidable in one read.
That has now happened — the per-question status is stamped inline in §2, and
§4 is the live to-do list rather than a conditional.

Read `#218` itself for the full feasibility case (OAuth verification, the
`drive.file` scope, the no-SDK argument). This document does not repeat that —
it only works the five open questions the issue left for Ben.

---

## 1. The decision this doc is downstream of — ACCEPTED 2026-08-09

**Data custody follows institutional relationship, not product tier.**
Tier 1 (schools with a real relationship — starting with Ben's own) gets the
Firebase rebuild as scoped: real accounts, Firestore, admin oversight,
view-as. Tier 2 (an independent rebbi with no institutional agreement) stays
local — localStorage as today — plus a backup written to **his own** Google
Drive instead of a Sheet he has to redeploy Apps Script for.

This was the premise the five questions below sat under, and it is now
**taken**. Everything past this section is live rather than conditional.

### Why it was taken, and the fallback that made it safe to take

The deciding argument was **not** the liability case, strong as that is. It
was sequencing: the rebuild's step 1 has to replace whole-blob `save()` with
incremental writes regardless, so a storage seam is being cut either way. The
only question the split adds is whether that seam has one implementation
behind it or two — and that is a design conversation *now* versus a rewrite
*later*. This is the one moment the split is cheap.

**The fallback, recorded because it is what made the decision reversible.**
The alternative considered and not taken was a single backend for everyone
behind an explicit "I am authorized to enter student data here" gate at
signup, plus a written deletion/breach policy, kept invite-only. Call it the
**middle tier**. It is cheaper, it is what most free school tools do, and
crucially **it stays available**: a tier-2 rebbi who later accepts such a gate
is exactly the tier-migration path Q2 already describes. So if two
implementations prove more expensive than they look, the exit is to promote
tier 2 into a gated tier 1 — not to unpick the architecture.

**The real risks accepted knowingly, so nobody rediscovers them as surprises:**

- **Two implementations to maintain, permanently.** Every future feature has
  to ask "does this work in tier 2?"
- **Tier 2 drifts by default, not by decision** — server-side is always the
  easier place to add something. Q1 names the intent; it cannot enforce it.
- **No view-as for tier 2**, so support for exactly the rebbeim with nobody
  else to ask goes back to "send me your backup."
- **Tier 2's data is less durable, not more private-in-practice.** A wiped
  managed Chromebook destroys it; Firestore would not. The Drive backup
  narrows that gap; it does not close it (1-hour tokens, silent re-auth
  failure, whole-blob overwrite). This is why Q4's answer is *more*
  load-bearing under the split, not less.
- **Custody relocates rather than disappears** — a rebbi's *personal* Google
  account holding his school's records is not self-evidently better governed
  than a Firebase project with rules and a deletion process. What the split
  genuinely fixes is that Ben stops holding records for schools he has never
  spoken to.
- **Ben does hold a little tier-2 data after all — account metadata** (added
  2026-08-09 with universal sign-in, below): email, display name, tier,
  created-at. Deliberate and small, but it means "Ben holds nothing for tier
  2" is no longer literally true and should not be said that way. It is
  ordinary SaaS ground — a consenting adult's own contact details, not a
  child's record — and it carries one obligation: the plain-language privacy
  note owed alongside Q3, needed before *any* self-serve signup in *either*
  tier.

### Amendment, 2026-08-09 — identity is universal; only custody is tiered

Ben's reaction to the tier-2 story as first written: *"it looks half baked and
not professional … something real besides jsons in drives."* The audit agreed,
and located the fault: **the storage design was sound, but tier 2 had been
sketched as anonymous**, and the anonymity is what read as cheap. Identity and
custody are separable, and this document had quietly fused them.

**Accepted: every rebbi signs in, both tiers, same Google button. The tier
decides where his CLASS DATA lives — not whether he exists.** Full reasoning,
the comparison against ClassDojo / PBIS Rewards / LiveSchool, and the rejected
alternative are in `docs/Universal_SignIn_Proposal.md` (ACCEPTED 2026-08-09).

Nothing in §1 above is reversed by this. Tier 2's student records still never
leave the rebbi's device and his own Drive; what Firestore gains is an account
row. Every "Q" below still stands as answered, with one addendum to Q1 and one
new required deliverable, both marked in place.

---

## 2. The five open questions, with recommendations

**Status after 2026-08-09.** Ben's answer was to the split itself (§1). Q1,
Q2, Q4 and Q5 are therefore recorded as **adopted as recommended** — none of
them turns on a judgment the yes didn't already imply, and each is one line
away from being overridden if he wants a different answer. **Q3 stays
explicitly open on Ben**, as this doc always said it would: it is a liability
and relationship question, not an architecture one, and it does not block any
code. Each heading carries its own stamp below.

### Q1 — Where's the feature line for tier 2? — ADOPTED AS RECOMMENDED

Tier 1 gets admin oversight, view-as, the class entity, archive/un-archive,
multi-device. Tier 2 gets none of it by construction — there's no server
holding a second copy to view or oversee. Left undecided, that gap can rot
into "tier 2 is the thing nobody maintains" rather than a deliberate second
product.

**Recommendation: tier 2 is everything Menchmark already is today, kept
whole.** Not a stripped-down mode — every tab, every feature, the full
localStorage app, exactly as a rebbi running it right now already has it. The
*only* things tier 2 doesn't get are the things that require a server to
exist at all (view-as, cross-device sync, admin oversight of someone else's
class) — those were never available today either, so nothing is being taken
away. The backup target changes (Drive instead of Sheets); nothing else does.

This is the same shape as the **hide-until-ready model** already established
in this codebase (`CLAUDE.md` — "Hide what isn't ready"): a feature not being
built yet is not the same as a feature being degraded. Tier 2 isn't degraded
tier 1 — it's the app as it exists today, continuing to exist, with a better
backup story than it has now.

**Addendum 2026-08-09 — "everything Menchmark is today" now means that PLUS a
sign-in.** Universal sign-in (see the amendment in §1) changes this answer in
one direction only: tier 2 gains a real account, so the feature line is *the
whole app as it stands today, plus identity, plus the Drive backup*. It loses
nothing. The recommendation above was written when tier 2 was going to be
anonymous, and "not a stripped-down mode" is now true in a stronger sense than
originally meant — a tier-2 rebbi is a fully-fledged signed-in user of the
product, and the only things he lacks are the ones that need a server-side
copy of his class to exist at all.

**And one new required deliverable, which is Ben's condition on accepting it:
existing beta rebbeim must be able to get their current class into their new
account themselves.** They onboarded on v0.9.0 (2026-07-18) and have real data
in `localStorage` now, so sign-in without an upload path would be a downgrade
for exactly the people who trusted the app first. Specified in
`Universal_SignIn_Proposal.md` §10 and carried into
`Firebase_Rebuild_Scope.md` ("Bringing the existing cohort in", build order
step 3b). It **gates the sign-in rollout** — not a follow-up to it.

### Q2 — Tier migration: does the converter tool already cover it? — ADOPTED AS RECOMMENDED (verification owed)

A tier-2 rebbi whose school later signs on has to move his data into
Firestore. The issue notes the converter tool's backup-upload mode "already
does exactly this" but flags it as needing confirmation, not an assumption.

**Recommendation: confirm before relying on it, don't assume.** This is a
one-line verification task once the converter tool exists in its rebuilt
form: does backup-upload mode, fed a tier-2 localStorage export, produce a
correct Firestore import? If yes, no new code path — migration is "export
from tier 2, import through the same tool tier 1 already uses to onboard a
class." If the converter tool's current scope doesn't cover this shape yet
(e.g. it currently expects Sheet-shaped input, not the JSON blob a Drive
backup would produce), that's a scope note for the rebuild doc, not a new
open question — the fix is making sure the converter's input formats include
"raw localStorage export," which tier 2 already produces via the existing
`sample-backup.json`-shaped download.

**Two changes 2026-08-09, both from universal sign-in.** First, **the account
half of tier migration has collapsed to a field flip** — the rebbi already has
an account, so adoption sets `schoolId` rather than creating anything (see
`Firebase_Rebuild_Scope.md` open question 11, sub-question 4). The *data* half
below is unchanged and its verification is still owed. Second, **this same
converter path is now also the beta cohort's way in**, which raises its
priority sharply and means it must be **self-serve for own-account restore**
rather than superadmin-gated. Verifying it therefore stops being "a one-line
check once the tool exists" and becomes part of a real verification harness.

### Q3 — What does a school have to agree to, to become tier 1? — STILL OPEN, ON BEN

Not a code question — a real-world one that gates onboarding school #2 (school
#1 is Ben's own, where the relationship already exists by virtue of him being
staff there).

**Recommendation: something in writing, even if short, before the first
outside school's data lands in Firestore.** This doc is not the place to
draft that agreement — it needs someone who can speak to what a school's
administration would actually need to see (data ownership, deletion on
request, breach notification, who to contact). Flagging it here so it isn't
forgotten, not attempting to answer it. **This is the one question of the
five that should stay explicitly on Ben, not get a technical recommendation**
— it's a liability and relationship question, not an architecture one.

**A smaller sibling, added 2026-08-09 with universal sign-in — and this one
gates more than Q3 does.** Q3 gates onboarding *school #2*. The account record
now created for **every** rebbi in **both** tiers (email, display name, tier,
created-at) needs a plain-language privacy note before **any** self-serve
signup happens at all — including the very first tier-2 rebbi, and including
Ben's own school. It is a much smaller piece of writing than Q3's agreement:
what is stored, why, that it is never sold or shared, and how to have it
deleted. But it is the earlier gate of the two, so don't let it ride along
behind the school agreement.

### Q4 — Does tier 2 still get the fragile-storage warning and CSV export? — ADOPTED AS RECOMMENDED

**Recommendation: yes to both, and more load-bearing than they are today, not
less.** `docs/Daily_Backup_Spec.md`'s staleness nudge already exists for
exactly this reason — PWA persistent storage doesn't survive an admin-forced
clear-on-exit or Guest-mode wipe on managed Chromebooks, and that's still
true for tier 2 under this proposal. Two changes fall out of the split:

- **The Drive backup becomes what the nudge is nudging toward.** Today the
  nudge's endpoint is "connect a Sheet." Under this proposal it's "the Drive
  write succeeded recently" — same UX, same staleness logic
  (`data.lastBackupAt` / `data.backupNudgeSince`), different backend behind
  it. No new nudge design needed; retarget the existing one.
  - **And it is built behind the account** (2026-08-09): the backup UI always
    names *which* Google account holds the file. That is not decoration —
    the Drive spike proved silent token renewal only works when the app sends
    a `login_hint`, so the account is load-bearing for the backup continuing
    to work at all, and a rebbi with a personal and a school Google account
    in one browser is the normal case, not an edge case.
- **CSV export doesn't change at all.** The issue is explicit that Drive-JSON
  covers backup only, not the readable role a menahel or secretary needs —
  CSV export stays exactly as scoped for tier 1 *and* tier 2 alike, since a
  tier-2 rebbi's secretary has the same need a tier-1 one does and there's no
  reason to gate it on tier.

### Q5 — Sequencing: does the Drive spike ship before the rebuild starts? — ADOPTED AS RECOMMENDED (spike is next)

**Recommendation: yes — spike now, as the issue itself proposes.** The
reasoning holds up: no dependency on accounts, Firestore, or the data-model
session, and it de-risks the one real unknown (the token/re-auth UX in actual
classroom conditions — a rebbi on a shared Chromebook, signed out of Google,
mid-lesson — not the API surface, which is well-documented and already
scoped as non-sensitive/no-verification-needed in the issue).

It also has a second payoff the issue names but doesn't dwell on: it closes
the gap `docs/Daily_Backup_Spec.md` flags, where retiring the Sheet snapshot
leaves nothing automatic behind it. If the spike lands well, tier 2's backup
story is *already better than today's* independent of whether or when the
Firebase rebuild itself starts — it doesn't have to wait on tier 1 being
built to ship value.

**What "spike" means concretely, so it doesn't quietly grow into the real
build:** a throwaway Google Cloud project, an OAuth client ID scoped to
`drive.file` only, a page (not wired into `app.html` yet) that does
sign-in → create-a-file → write-JSON → re-auth-after-expiry, tested on an
actual shared/logged-out Chromebook if one is available. The deliverable is
confidence in the UX and a small amount of reusable fetch-based code — not a
merged feature.

---

## 3. What this doc does not decide

- ~~**Whether the two-tier split happens at all.**~~ **Decided 2026-08-09 —
  see §1.** Left visible rather than deleted, because it is the shape of how
  this went: the doc deliberately did not resolve the split by piling
  recommendations under it. Ben answered it directly.
- **Path B's reframing** (self-serve defaults to tier 2, code promotes to
  tier 1) and **open question 1's "vendor the SDK as a separate same-origin
  file, load only for tier 1"** — both are `Firebase_Rebuild_Scope.md`
  amendments that follow *from* the split being accepted, not decisions this
  document needs to make independently. They're listed in #218 as consequences,
  not open questions, so they aren't repeated here. **Both were applied to that
  doc on 2026-08-09** — the Path B reframe as a locked decision, the SDK option
  as a narrowed recommendation under open question 1 that **still needs Ben**,
  since it amends CLAUDE.md rule 3 and only he changes a hard rule.
  **The mechanic behind the reframe has its own written proposal** —
  `Firebase_Rebuild_Scope.md`, open question 11 (2026-08-07): the code typed at
  signup decides where the account lands, so a beta tester's PIN creates a
  standalone (tier-2) account while a school's code includes the rebbi in that
  school (tier 1). **Still PROPOSED, but no longer gated** — it was waiting on
  §1, which is now answered, so it is ready to be worked at step 1. Its
  sub-question 4 (a standalone rebbi being adopted once his school signs on) is
  the account-side half of **Q2** above, so answer the two together.
- **The GCP project / OAuth client setup itself** — that's an account-creation
  step that has to happen in Ben's Google Cloud Console, not something Claude
  can do unprompted (account creation is outside what Claude acts on without
  the user doing it directly).

---

## 4. Accepted — what happens now

1. **Start the Drive OAuth spike per Q5.** ← the next actionable thing.
   **Blocked on one human step only:** the GCP project and the OAuth client
   ID have to be created in Ben's own Google Cloud Console (see §3). Nothing
   else gates it — not accounts, not Firestore, not the data-model session.
   Scope is fixed in Q5 and must not grow: sign-in → create-a-file →
   write-JSON → re-auth-after-expiry, on a page not yet wired into
   `app.html`. The deliverable is confidence in the re-auth UX plus a little
   reusable `fetch`-based code, **not** a merged feature.
2. **Amend `Firebase_Rebuild_Scope.md`** with the Path B reframe and the
   split-SDK option from #218. **Done 2026-08-09** in the same branch as this
   edit, shown as a draft-PR diff rather than applied silently, per CLAUDE.md's
   PROPOSE-FIRST rule for anything reshaping the data story.
3. **Carry the two-tier split into the rebuild's step 1 agenda**, ahead of
   collection design, exactly as #218 requests. Recorded in that doc's build
   order and in open question 1.
4. **Answer Q3 before school #2's data lands in Firestore.** Not a blocker on
   1–3 and not a code task, but the thing that gates onboarding any school
   other than Ben's own. Tracked in `docs/NOW.md` under "Not code, still owed".
