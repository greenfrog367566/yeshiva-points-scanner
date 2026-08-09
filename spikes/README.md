# spikes/

Throwaway experiments. **Nothing in this folder ships, and nothing in the app
may import from it.**

A spike exists to answer one question with running code and then be deleted or
rewritten properly. If something here turns out to be worth keeping, it gets
rebuilt inside `app.html` under the normal rules — it does not get promoted by
being moved.

Rules for this folder:

- **Not linked from anywhere.** No entry in `app.html`, `home.html`,
  `quick-start.html`, the service worker, or the manifest. A rebbi must never
  be able to reach one of these by accident.
- **Not covered by the data-safety rules**, because it never touches
  `localStorage` under the real key. A spike that needs saved data uses
  `sample-backup.json`, never a real roster.
- **Allowed to break the app's architecture rules**, on purpose. A spike may
  use external scripts, multiple files, whatever answers the question fastest
  — CLAUDE.md rule 3 governs `app.html`, not scratch work. Where a spike
  deliberately honors a rule anyway (as the Drive one does), it says so and
  explains why.
- **Carries its own findings.** A spike whose results live only in someone's
  memory has failed. Write what you learned into the file or a doc.

---

## `drive-oauth-spike.html` — Google Drive backup for tier 2

**Question it exists to answer:** what does the sign-in and re-authorisation
experience actually feel like for a rebbi on a shared, logged-out Chromebook
mid-lesson — and does the no-library route work at all?

Background: `docs/Data_Custody_Decision.md` (ACCEPTED 2026-08-09) splits data
custody two ways. Tier 2 — an independent rebbi with no institutional
agreement — keeps his data local and backs it up to **his own** Google Drive
instead of a Sheet he has to redeploy Apps Script for. This spike is Q5 of
that decision, and it is the next actionable step in `docs/NOW.md`.

**What is genuinely uncertain, and therefore what this tests:** not the API.
The Drive REST API is well documented and `drive.file` is a non-sensitive
scope needing no OAuth verification review. What is uncertain is the *token
lifetime UX*. Browser-only OAuth gives a 1-hour access token and **no refresh
token** (refresh tokens require a backend the app deliberately doesn't have).
So "keeps your backup updated automatically" is only honest if silent
re-authorisation actually works in classroom conditions. That is the thing to
find out before anything gets built or promised.

**It deliberately uses no external scripts**, even though a spike is allowed
to. Google's own recommendation is their Identity Services library, which is a
`<script src>` to a Google CDN — exactly what CLAUDE.md rule 3 forbids inside
`app.html`, and exactly what a service worker cannot reliably precache for
offline use. So the library route is not available to the real feature, which
makes it the wrong thing to spike. This page proves out the route that would
actually be usable: a plain redirect to Google's authorisation endpoint, the
token read from the URL fragment, and every Drive call made with `fetch`.

**Setup and results live in the page itself** — open it and read the top.

---

## Findings — run 2026-08-09

**Conditions:** Windows 11, Chrome, on Rabbi Steinerman's own laptop, signed
into Google, served over `http://localhost:8080`. OAuth client publishing
status **Testing (unverified)**, scope `drive.file` only. This is the *easy*
case — a machine where the user is permanently signed in. It has not yet been
run on a shared or logged-out Chromebook.

### What works — the entire API surface, first time

| Step | Result |
|---|---|
| Sign-in (redirect → consent → token) | ✅ token issued, lifetime **3599s (~60 min)** |
| Create folder in the rebbi's own Drive | ✅ |
| Write backup JSON (multipart create) | ✅ **509 bytes in 1084 ms** |
| Read back and verify round trip | ✅ content intact |
| Update in place on a second run | ✅ found the existing file, patched it |

No SDK, no external script, plain `fetch` throughout. **The feasibility claim
in #218 holds: `drive.file` needed no verification review, and the no-library
route works.**

### What does not work — silent re-auth, which was the whole question

| Test | Result |
|---|---|
| ⑤ `prompt=none` in a hidden iframe | ❌ `interaction_required` |
| ⑥ real 401 → automatic silent recovery | ❌ `interaction_required`, write abandoned |
| ⑦ `prompt=none` as a **top-level redirect** | ❌ `interaction_required` |

⑦ was added specifically to disambiguate ⑤, and its answer is the important
one. Had ⑦ succeeded, the blocker would have been the third-party iframe
context — annoying but survivable, costing a page bounce rather than a
sign-in. **It failed too.** So the Google session will not mint a fresh token
without the user acting, regardless of how the request is framed. This was
measured **three minutes after a successful consent grant**, on a machine with
a live Google session, so it is not explained by staleness or a missing prior
grant.

### The one confound left, and it is worth clearing before this is treated as final

The OAuth client is in **Testing / unverified** publishing status. Google
treats grants to testing apps as short-lived, and it is plausible — not
established — that a **published** client with only non-sensitive scopes
behaves differently for `prompt=none`. **Publishing the consent screen and
re-running ⑤ and ⑦ is the single remaining test**, and it has to happen in
Ben's Cloud Console. Until it does, read the result above as *"silent re-auth
failed in every form tried, with one untested explanation remaining"* — not
as *"silent re-auth is impossible."*

### What this means for tier 2, if the finding holds

**It does not sink the Drive backup — it changes what may be promised.**

- **"Automatically keeps your backup updated" is not deliverable.** Anything
  built on a background write that survives token expiry would be a promise
  the app cannot keep. `docs/Data_Custody_Decision.md` Q4 already said the
  staleness nudge would be *more* load-bearing under the split; this makes
  that concrete rather than cautionary.
- **What is deliverable is still a large improvement on today.** One sign-in
  buys a **60-minute window in which backups are genuinely automatic and
  invisible**. A rebbi who opens the app and works through a period is covered
  for that period without touching anything. Past the hour, it costs one
  click — and compared with the Apps Script path it replaces (paste a script,
  redeploy, "Manage deployments → New version"), that is not a close contest.
- **Design consequence:** the app must persist pending work *before* it
  redirects for re-auth, since the redirect discards in-memory state. The
  spike deliberately holds its token in memory only and does not model this —
  the real feature has to.
- **The honest sentence** for the UI is something like *"backed up 12 minutes
  ago — sign in again to keep it current,"* not *"backup is on."*

### Still owed

- Run the whole thing on a **shared / logged-out Chromebook**. The laptop case
  is the easy one and has now been done; the classroom case is the one the
  decision actually rests on.
- Publish the consent screen and re-run ⑤ and ⑦ (see the confound above).
- Neither is a code change. Both need Ben's Google account.
