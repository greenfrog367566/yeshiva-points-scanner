# Two-tier data custody — decision record (#218)

**Status: PROPOSED, 2026-08-07 — awaiting Rabbi Steinerman's decision on the
five open questions below.** Nothing here is built. This document exists
because issue #218 is long and its open questions are easy to re-litigate
piecemeal; the goal is to make each one decidable in one read, with a
recommendation, so a "yes/no/other" per question is enough to move to the
OAuth spike and the rebuild's step 1.

Read `#218` itself for the full feasibility case (OAuth verification, the
`drive.file` scope, the no-SDK argument). This document does not repeat that —
it only works the five open questions the issue left for Ben.

---

## 1. The decision this doc is downstream of

**Data custody should follow institutional relationship, not product tier.**
Tier 1 (schools with a real relationship — starting with Ben's own) gets the
Firebase rebuild as scoped: real accounts, Firestore, admin oversight,
view-as. Tier 2 (an independent rebbi with no institutional agreement) stays
local — localStorage as today — plus a backup written to **his own** Google
Drive instead of a Sheet he has to redeploy Apps Script for.

That split is the proposal. It is *not* one of the five open questions below
— it is the premise they sit under. If it gets rejected, none of the five
questions apply and this document is moot. Everything past this section
assumes the split is taken.

---

## 2. The five open questions, with recommendations

### Q1 — Where's the feature line for tier 2?

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

### Q2 — Tier migration: does the converter tool already cover it?

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

### Q3 — What does a school have to agree to, to become tier 1?

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

### Q4 — Does tier 2 still get the fragile-storage warning and CSV export?

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
- **CSV export doesn't change at all.** The issue is explicit that Drive-JSON
  covers backup only, not the readable role a menahel or secretary needs —
  CSV export stays exactly as scoped for tier 1 *and* tier 2 alike, since a
  tier-2 rebbi's secretary has the same need a tier-1 one does and there's no
  reason to gate it on tier.

### Q5 — Sequencing: does the Drive spike ship before the rebuild starts?

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

- **Whether the two-tier split happens at all.** That's §1, and it's Ben's
  call, not a question this doc resolves by writing recommendations under it.
- **Path B's reframing** (self-serve defaults to tier 2, code promotes to
  tier 1) and **open question 1's "vendor the SDK as a separate same-origin
  file, load only for tier 1"** — both are `Firebase_Rebuild_Scope.md`
  amendments that follow *from* the split being accepted, not decisions this
  document needs to make independently. They're listed in #218 as consequences,
  not open questions, so they aren't repeated here.
  **The mechanic behind that reframe now has a written proposal** —
  `Firebase_Rebuild_Scope.md`, open question 11 (2026-08-07): the code typed at
  signup decides where the account lands, so a beta tester's PIN creates a
  standalone (tier-2) account while a school's code includes the rebbi in that
  school (tier 1). Still PROPOSED, still downstream of §1 — but its
  sub-question 4 (a standalone rebbi being adopted once his school signs on) is
  the account-side half of **Q2** above, so answer the two together.
- **The GCP project / OAuth client setup itself** — that's an account-creation
  step that has to happen in Ben's Google Cloud Console, not something Claude
  can do unprompted (account creation is outside what Claude acts on without
  the user doing it directly).

---

## 4. If accepted

Once Q1–Q4 have a yes/no/other from Ben (Q5's recommendation can proceed
independently regardless — see above):

1. Start the Drive OAuth spike per Q5, against a GCP project Ben creates.
2. Amend `Firebase_Rebuild_Scope.md` with the Path B reframe and the
   split-SDK option from #218, once the split itself is confirmed — that's a
   PROPOSE-FIRST edit shown as a diff, not applied silently, per CLAUDE.md's
   data-model caution.
3. Carry the two-tier split into the rebuild's step 1 agenda, ahead of
   collection design, exactly as #218 requests.
