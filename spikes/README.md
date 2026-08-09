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

**Status:** written 2026-08-09, **not yet run against a real client ID.**
Findings go in the page's own Findings section once it has been.
