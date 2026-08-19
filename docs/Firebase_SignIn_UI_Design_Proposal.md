# Firebase Rebuild — Sign-In UI Design (Proposal)

## Status

**✅ APPROVED 2026-08-16 by Ben. Entry points A/B/C SHIPPED.**

**AMENDED — a fourth entry point, D, added on `setup.html`'s Restore/Import
screen.** §1's three doors all answer "how does a rebbi *start* using an
account." None of them answer the question a rebbi actually arrives with on a
new computer — *"where is my class?"* — which is asked on the Restore screen,
where the only two answers on offer both required him to still be holding
something (a `.json` file, or his Apps Script URL). Entry point D is a third
option on that screen, deliberately placed there and **not** on setup's welcome
screen: a rebbi who reaches Restore is already asking the question sign-in
answers, so it reads as an answer rather than a nudge, which keeps §'s "never a
wall" / "never imply they're missing something" constraint intact.

**Also corrected here: what signing in on a new device actually does.** This
doc's §3.3 says an existing account "skip[s] everything below, go[es] straight
into the app on that account's class" — that was never implemented. Nothing
read a class *down* into local `data`; every path was upload-only, including
the misleadingly-named `signinAcceptDriveRestore()`. The restore half now
exists, sourced from the **Drive backup** (a full `data` blob) rather than from
Firestore (whose class doc holds only roster, scores and tracked data — not
activities, log, rewards or settings, so it cannot reconstitute a class on its
own). See CHANGELOG `[Unreleased]`. This doc fills a gap surfaced twice during
step 4's implementation: `docs/Firebase_Step2_Auth_Rules_Design_Proposal.md`
specifies the sign-in *flows* (screens, reads, writes) and
`docs/Firebase_Step4_Routing_Design_Proposal.md` assumes sign-in UI exists
somewhere, but **no doc actually designs the screens** — where they live in
`app.html`, what triggers them, how the SDK-free/SDK-loaded split works in
practice, or how this coexists with the tier-2/offline promise. Implementation
in progress on `feat/firebase-step2-auth-rules` (PR #290) — see
`docs/NOW.md` for current status.

## Why this is the actual critical path

Three things are already built and waiting on this:

- **Step 3's self-serve restore mount** (`provisionRebbi({mode:"backup",
  self:true})`) — backend built and tested, no UI to call it from.
- **Step 4's PR4** (tier guard + async hydrate) — can't be tested without a
  real signed-in session.
- **Step 3b** (existing-cohort upload) — designed in full, but its "same-device
  adoption" offer has to appear *during* sign-in, so it can't be built before
  sign-in has a shape.

## The one constraint that overrides everything else: never a wall

`docs/Universal_SignIn_Proposal.md` §8, already accepted: *"sign-in must be
**default, not wall**."* A real, non-trivial slice of the beta cohort runs the
downloaded `file://` copy and some are never online at all. **Every screen
below is skippable, and skipping it must leave the app exactly as
functional as it is today.** This isn't a nice-to-have — it's the same
promise rule 3's SDK amendment already made ("tier-2 majority... re-download
nothing extra"), extended to UI: tier-2/never-signed-in users must not just
avoid downloading the SDK, they must never even see a screen that implies
they're missing something by not signing in.

## Recommended design

### 1. Entry points — three, not one, because "default" needs more than one door

**A. A new, skippable step in `setup.html`'s wizard**, after "You're all
set!" (the last existing step). New users are the cheapest moment to offer
this — no retrofit, no nudge needed. Copy: *"Want your class backed up
automatically? Sign in with Google — or skip this, you can do it anytime
from Settings."* Skipping writes nothing and shows nothing again; this is a
one-time offer per the *setup flow*, not a recurring nag inside it.

**B. A permanent card in Settings**, next to the existing Backup & Restore
section (same tab, new subsection: "Account"). This is the door for
existing users and the only door that always exists, so it's the one this
design leans on — everything below assumes a rebbi can always reach sign-in
from here, whether or not he ever saw the setup-wizard step.

**C. A one-time nudge banner for existing installs**, reusing the *exact*
mechanism already shipped for the backup-staleness nudge (`data.lastBackupAt`
/ `backupNudgeSince` pattern) rather than inventing a second banner system.
New field: `data.signinNudgeSeen` (boolean, `load2fix()` backfill, no
`DATA_VERSION` bump — additive, matches the standing rule). Shows once,
dismissible, points at Settings → Account. Never reappears once dismissed or
once the rebbi signs in — this is an invitation, not a recurring interruption,
and CLAUDE.md's own standing rule (`docs/NOW.md` "Standing rules") already
warns against building a second nag pattern when one exists.

**What none of these three do:** block app boot, appear over the scan screen,
or require a decision before scanning works. A rebbi who never touches any of
them gets the identical app he has today.

### 2. The SDK-free-until-tier-1 mechanism

This is the part no existing doc worked out: **every sign-in starts SDK-free,
and the vendored Firebase SDK loads only after the account turns out to be
tier-1** — not before, not speculatively. This resolves the tension between
"we don't know the tier until after auth" and "tier-2 must never load the
SDK."

1. **"Sign in with Google" is a plain OAuth redirect** — the exact code path
   the Drive spike (#243) and tier-2's own account write already use. Zero
   `<script>` tags, zero SDK, at this point.
2. **Token comes back in the URL fragment** (same pattern as the spike).
   Exchange the Google credential for a Firebase ID token via **Firebase
   Auth's REST API** (`identitytoolkit.googleapis.com/v1/...`) — still no SDK,
   per `Universal_SignIn_Proposal.md` §5's already-verified claim that this
   API exists and takes a plain `fetch`.
3. **Call `redeemCode`** (or, on a later visit, just read `accounts/{uid}`)
   via a plain `fetch` to the callable function's HTTP endpoint
   (`POST .../redeemCode` with `{data: {...}}` and the ID token as a bearer
   — the same envelope `tools/converter-core.js` would need if it went
   SDK-free, so this repo now has one documented pattern for it, not two).
4. **Branch on the result's `schoolId`:**
   - **`null` (tier-2):** done. No SDK ever loads. All further account-record
     reads/writes stay on this same plain-`fetch`-to-REST-API path, forever,
     for this account.
   - **set (tier-1):** *now* inject
     `<script src="/vendor/firebase/firebase-app-compat.js">` etc.
     (dynamically created `<script>` elements, appended once, guarded so a
     second sign-in this session doesn't reload them), initialize
     `firebase.initializeApp()`, and adopt the credential already obtained in
     step 2 via `firebase.auth().signInWithCredential(...)` — **no second
     consent screen**, the rebbi already said yes once.

**Why this matters enough to spell out:** it means the "tier-2 majority never
downloads the SDK" promise holds even for people who click "Sign in" and
decide against it, or who turn out to be self-serve/standalone — the SDK
literally cannot load until a `schoolId` is confirmed set. It also means
tier-1's SDK-loaded state and tier-2's SDK-free state converge on the exact
same first three steps, so there's one sign-in code path with a branch, not
two parallel implementations to keep in sync.

### 3. Screen sequence

Matches `Firebase_Step2_Auth_Rules_Design_Proposal.md`'s "Sign-in flows"
section exactly — this doc adds the screens, that doc already fixed the
reads/writes:

1. **Entry** (any of the three doors above) → **"Sign in with Google"**
   button. **The privacy note link sits directly above this button, not
   after it** — `docs/Account_Privacy_Note.md` Part 2§D is explicit that this
   is where it has to go before the note can ship at all. *(That note is
   itself still unpublished — see Open Questions.)*
2. Google redirect completes → back in the app, a brief loading state
   ("Signing you in…") while steps 2-3 of the mechanism above run.
3. **Existing account** (`accounts/{uid}` already exists) → skip everything
   below, go straight into the app on that account's class.
4. **First sign-in, no account yet** → **code screen**: optional text field
   ("Have a code from your school? Enter it here — or leave blank"),
   **Continue** button. Calls `redeemCode`.
5. **After `redeemCode` succeeds**, check for a local class before deciding
   what screen comes next (this is step 3b's same-device-adoption offer,
   surfacing here for the first time in an actual UI):
   - **Local `data.students.length > 0`* AND *not already claimed*** (see
     step 3b's three-signal detection — present, non-trivial, recent) →
     **"This device has a class — {className}, {N} boys, last scan
     {relative time}. Add it to your account?"** with **Add it** / **Start
     fresh instead** buttons. "Add it" calls `provisionRebbi({mode:"backup",
     self:true, normalized: <bridge output>})`; "Start fresh" falls through
     to the next screen.
   - **No local class, or "Start fresh" chosen** → **first-run setup
     screen**: name the class, then the *same roster-entry component*
     `tools/admin-convert.html`'s roster-only mode already built (paste
     three columns or add manually) — per the data model doc's locked "one
     roster-entry component, two mount points" decision. Calls
     `provisionRebbi({mode:"roster", ...})` with `self:true` semantics (own
     account, no admin role check) — **note:** `provisionRebbi` today only
     accepts `self:true` for `mode:"backup"`; extending it to `mode:"roster"`
     is a small, explicit addition this doc is flagging, not assuming.
6. **Land in the app**, now on the account's real class.

### 4. Account status display

Once signed in, Settings → Account shows (never elsewhere — no header
badge, no persistent chrome; this is deliberately quiet, matching "tier is
invisible plumbing" from `Universal_SignIn_Proposal.md` §4):

- **Tier-1:** *"Signed in as {email} · {School name}"*
- **Tier-2:** *"Signed in as {email} · Class backed up to your Drive {relative
  time}"* (once the Drive backup feature ships — until then, *"Signed in as
  {email}"* alone)
- A **Sign out** button. Signing out clears the Firebase Auth session (and,
  for tier-1, unloads nothing — the vendored SDK script tags stay loaded for
  the rest of this page's lifetime; there's no clean way to un-inject a
  `<script>`, and re-signing-in later just reuses it) but **never touches
  local data** — signing out of the account is not signing out of the class
  sitting in `localStorage`.

### 5. Error and edge cases

- **Redirect fails / network drops mid-flow:** land back on the entry
  screen with a plain error line, no partial state — nothing was written
  server-side yet at this point in the flow (accounts are function-only,
  `allow write: if false` for clients, so there's no client-side partial
  write to clean up).
- **Invalid/revoked code:** the code screen shows the `redeemCode` error
  inline (`"That code isn't recognized"` / `"has been revoked"` /
  `"has reached its use limit"` — already exact `HttpsError` messages from
  step 2's implementation) and lets the rebbi retry or leave it blank and
  continue as tier-2.
- **Same-device adoption offer, declined, then the rebbi changes his mind:**
  the local class is untouched either way ("Start fresh" only skips the
  *offer*, never deletes anything) — he can always reach the offer again via
  Settings → Account → "I have a class on this device" (a manual re-trigger,
  same detection logic, for exactly this case).
- **Sign-in attempted while offline:** the Google redirect itself will fail
  before reaching Menchmark at all — no special handling needed, the browser
  handles that failure natively.

## What this doc does not decide

- **The privacy note itself isn't published.** `docs/Account_Privacy_Note.md`
  is still DRAFT per its own status line — this design assumes it will have a
  URL to link to, not what that URL is or when it ships. Flagging rather than
  blocking on it: the sign-in UI can be built with a placeholder link and
  wired to the real page once it exists, same as any other doc dependency.
- **Q3 (what a school signs)** — untouched, not this doc's concern.
- **The Drive backup UI itself** (the actual "backed up N minutes ago" nudge
  wiring for tier-2) — referenced above as a future-tense feature, not
  designed here. That's its own build slice per `Daily_Backup_Spec.md`.
- **`provisionRebbi`'s `mode:"roster"` + `self:true` combination** — flagged
  above as a small necessary extension, not designed in full here (payload
  shape, validation) — worth a short addendum to
  `Firebase_Step3_Converter_Tool_Design_Proposal.md` once this doc is
  approved, rather than re-litigating step 3's design inside this one.

## What this unblocks

Once approved: step 4's PR4 (tier guard) has a real session to test against;
step 3's self-serve restore mount has a screen to live on; step 3b's
same-device-adoption offer has a UI to surface in, exactly where §3.5 above
places it. All three have been sitting on backend-only implementations
waiting for exactly this.
