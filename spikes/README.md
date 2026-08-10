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

### Silent re-auth — it works, and the first run said otherwise because of a bug in this harness

**This section replaces an earlier, wrong conclusion.** The first run reported
`interaction_required` from every silent route and concluded that automatic
background backup was not achievable. That was a defect in the spike, not a
platform limit. It is recorded here rather than quietly overwritten, because
the wrong version was committed and read.

| Test | First run (no `login_hint`) | After the fix |
|---|---|---|
| ⑤ `prompt=none` in a hidden iframe | ❌ `interaction_required` | ✅ **new token, no UI at all** |
| ⑥ real 401 → automatic silent recovery | ❌ write abandoned | ✅ **recovered and completed, twice** |
| ⑦ `prompt=none` as a top-level redirect | ❌ `interaction_required` | not needed — ⑤ works |

**The cause: no `login_hint`.** Google's account chooser appeared during
sign-in and the auth URL carried `authuser=unknown` — this browser has more
than one Google account and no default. `prompt=none` cannot succeed while
Google is left to guess *which* account is meant, and `interaction_required`
is the correct, documented answer to an ambiguous silent request. Naming the
account resolves it. The first run also forced `prompt=consent` on the
interactive sign-in, which is not what the real feature would do; fixed too.

The recovery loop, verbatim, with the token deliberately replaced by garbage
so Google rejected it for real:

```
401 on find/create folder — attempting silent recovery…
Silent recovery worked — retrying find/create folder, rebbi saw nothing.
Token replaced with a garbage value.
401 on write backup — attempting silent recovery…
Silent recovery worked — retrying write backup, rebbi saw nothing.
Backup updated in place (509 bytes) in 1819ms
```

**The testing-mode confound is moot for this question** — all of the above
happened with the client still in Testing / unverified status.

### What this means for tier 2

**The 60-minute token is a non-issue, provided two conditions hold.** The app
renews silently in a hidden frame and the rebbi never sees it. "Keeps your
backup up to date automatically" is an honest sentence again.

The two conditions are not optional, and both are the app's job:

1. **The app must know which Google account it is renewing for, and say so on
   every request.** `login_hint` is mandatory, not a nicety — a rebbi with a
   personal and a school Google account in one browser is the *normal* case,
   and without the hint his backup silently stops renewing. Step ⑧ shows where
   to get it: Drive's own `about.get` returns `user.emailAddress` under
   `drive.file` with **no extra scope**. Capture it at first sign-in, persist
   it, send it forever after. The real feature wants it visible anyway, so the
   rebbi can see *which* account his class is backed up to.
2. **The rebbi must still be signed into Google in that browser profile.**
   This rides on the Google session cookie, not a refresh token — browser-only
   OAuth cannot have one, because Google requires a `client_secret` to mint one
   and, unlike most providers, **PKCE cannot substitute**. So a shared
   Chromebook where he signs out at day's end needs one interactive sign-in the
   next morning. That is a reasonable price, and it is what the interactive
   path is for.

**Neither the token lifetime nor the session length is extendable.** The 1-hour
access token is fixed for user OAuth — the "extend to 12 hours" option that
turns up in search results is for **service accounts** via a Cloud org policy
(`constraints/iam.allowServiceAccountCredentialLifetimeExtension`) and does not
apply to a rebbi's own Google account. The answer to "make it longer" is not a
longer token; it is renewing invisibly, which now works.

**Design consequences that survive the good news:**

- **Silent renewal can still fail** — signed out, session expired, consent
  revoked. The app must treat a failed renewal as a first-class state and say
  so, rather than letting a backup stop quietly. The staleness nudge in
  `docs/Daily_Backup_Spec.md` remains the backstop, exactly as
  `Data_Custody_Decision.md` Q4 anticipated.
- **Never persist the access token.** This spike holds it in memory only and
  the real feature should too — renewal is cheap, a stored token is a liability.
- **The interactive path still uses a redirect**, which discards in-memory
  state, so pending work must be persisted before it runs. Only the *silent*
  path is frame-based and state-preserving.

### Still owed

- **Run it on a shared / logged-out Chromebook.** Still the case the decision
  rests on, now with a sharper question: not "does silent renewal work" — it
  does — but "how often is the rebbi signed out of Google entirely, and what
  does the app do that morning?"
- Publishing the consent screen is no longer needed to answer the re-auth
  question, though it is still required before real rebbeim use it.

