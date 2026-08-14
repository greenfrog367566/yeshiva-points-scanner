# Firebase Rebuild — Step 5 Superadmin Tools Design (Proposal)

## Status

**✅ APPROVED 2026-08-14 by Ben.** Locked into `Firebase_Rebuild_Scope.md`'s build order as step 5's design. This doc is now the reference for `admin.html`'s shape, the activitySummary triggers, the view-as UI transition, the email export, and the access boundary below.

## Recommended design

**Where it lives:** Separate `admin.html`, not a route inside `app.html` (Design A + C over B). This is the highest-privilege surface in the system — cross-school reads, token-minting, full-roster export — and B's argument for reuse (shared router/auth) doesn't outweigh C's blast-radius point: a distinct file means the 99% of users on `app.html` never ship this code, and the privileged surface isn't one client-side role check away from the main bundle. It's a flat page, no router integration (A) — Berel is one person acting outside class-scoped context, and step 4's contract is explicitly account-scoped, not superadmin-scoped, so fighting it for reuse buys nothing. Loads the vendored tier-1 SDK independently, gated server-side by `isSuperadmin()` on every call.

**Activity overview UI:** B's table shape with C's load discipline. A live-updating table isn't right for a cross-school privileged read (C's objection to A's `onSnapshot`), but B's zero-friction "email just came in" workflow matters more than C's paranoia suggests — so: an explicit "Load activity" button (C) fetches once, then the table is sortable/filterable client-side in memory (B's search box + sort), default sort **last-active ascending** (B) since surfacing who's stuck is the actual job. Columns merge both: name/email, school, last-active, last-write, class count, days-since-invite-flag. The load itself is logged (C) — even reading everyone's activity is privileged and belongs in the same audit trail as view-as mints.

**View-as entry point:** C's confirmation + new-tab isolation, B's destination precision. One click with zero modal (B's "already read-only and logged" reasoning) is too casual for a support tool wielding a token mint — keep C's confirmation naming the rebbi/school. But send the opened tab straight to `#/c/{theirDefaultClassId}/scan/scan` under the banner (B), not just `app.html?viewAs=1` and a manual navigate (A) — the whole point is screen-to-screen speed. New browser tab, not same-tab navigation or an iframe (C) — admin.html's privileged context must never share a DOM with a scoped rebbi session, and "Exit view-as" returns to the admin overview (B), not Berel's own class. This uses `viewAs(targetUid)` and the second isolated Auth instance exactly as step 2 specified — no redesign.

**Email export UI:** All three converged here; keep it minimal (A's + C's identical framing). One button, "Export emails (CSV)," a Cloud Function reads `acct` docs server-side and returns `name,email,school,role,lastActive` as CSV, browser downloads. No filters, no preview, no scheduling — matches the scope doc's "export the list, don't build a mailer" constraint exactly. C's addition: log the export event with row count, consistent with logging every privileged read on this page.

**What this leaves open:** step 5 still needs its own cross-school listing query (per the step-4 analysis — `listSwitchTargets()` doesn't cover it) if a future "browse by school" view is wanted; today's activity table sidesteps that by listing rebbeim flat, not grouped by school. That's a PROPOSE-FIRST addition, not a gap in this design.

## activitySummary: what populates it

Every sign-in and every write are the two triggers — activity, not scans specifically, since scan volume is noise for "is this rebbi stuck," while sign-ins and writes both signal a live human.

**Triggers (Cloud Function, `onCall`/`onWrite`, not client-invoked):**

1. **Auth `onCreate`/sign-in callable** — every successful sign-in updates `lastActive` and `lastSignIn`.
2. **Firestore `onWrite` trigger on `classes/{classId}/**`** (scans, tracked entries, roster edits, prize ledger — any owned-data write) — updates `lastActive` and `lastWrite`. This is a wildcard trigger over the rebbi's write surface, not one trigger per collection, so a new write-path added later is covered for free.

Both triggers write to the **same doc**, keyed by owner uid, not appended as a log — this is a summary, not a history:

```
activitySummary/{uid}:
  name, email, school (schoolId), role
  lastActive: timestamp   // max(sign-in, any write)
  lastWrite: timestamp    // last data write specifically
  lastSignIn: timestamp
  classCount: number      // updated on class create/delete, not every write
  invitedAt: timestamp    // copied once from acct doc at account creation
```

`classCount` updates only on class-create/delete triggers, not on every scan — cheap, and it's the "days since invite, still zero classes" signal, not a live counter.

**Freshness: periodic, not real-time.** The design above already rejected `onSnapshot` for this table (C's load-discipline point) — an explicit "Load activity" button does one read of `activitySummary` (one doc per rebbi, cheap even at hundreds of rows), sorted client-side. The writes themselves are real-time (trigger fires on the actual event), but the *overview's read* is on-demand. This matches the actual job: "who's stuck" doesn't change minute-to-minute, and a stale-by-a-few-minutes read costs nothing while an `onSnapshot` on a superadmin cross-school collection is a standing privileged listener for no benefit.

## The view-as UI transition

Click "View as" on a rebbi's row in the (already-loaded) activity table. That single click, before anything else, shows the confirmation naming the rebbi and school (per the C-derived design). Confirming does three things synchronously:

1. Calls `viewAs(targetUid)`, getting back the scoped custom token.
2. `window.open()`s a **new browser tab** — never same-tab, never an iframe — pointed at `app.html#/c/{theirDefaultClassId}/scan/scan`.
3. Logs the mint (already specified in step 2).

**Why a new tab, not the current one navigating:** `admin.html` is the highest-privilege surface in the system (cross-school reads, token minting). Navigating the current tab away from it and back is exactly the kind of DOM/state entanglement C's isolation argument rules out — the admin overview must stay untouched in its own tab so "Exit view-as" has somewhere stable to return to, and so a superadmin never accidentally leaves a privileged admin session sitting behind a rebbi-scoped one in the same tab's history.

**In the new tab:** `app.html` boots normally, sees a `viewAs` bootstrap param (passed via the URL fragment before the route, or a short-lived sessionStorage handoff key set by `admin.html` just before `window.open` — simplest is a query param alongside the hash, e.g. `app.html?viewAs=<custom-token>#/c/.../scan/scan`), and on load signs into the **second isolated `initializeApp(config, "viewAs")` instance** with that token instead of touching the tab's own default-instance auth state. This new tab has no superadmin session of its own to protect — it's a fresh tab, so "second instance" here just means: don't let this token collide with whatever default-instance auth `app.html` normally sets up on load.

**The banner:** a fixed top bar, rendered whenever the active Auth instance is the `"viewAs"` one (checked at app-shell mount, not per-component), reading "Viewing as {rebbi} — {school}" with an "Exit view-as" button inline. Exit signs out only the `"viewAs"` instance and closes the tab (`window.close()`), returning focus to the still-open admin tab — never re-navigates within the same tab.

## Email export scope

**Columns:** `name,email,school,role,lastActive` — exactly the five fields already named in the synthesized design's Email export UI section. No phone, no class list, no ledger data. `role` lets Berel filter rebbi vs. admin recipients in whatever mailer he pastes this into; `lastActive` lets him segment "onboarded but gone quiet" without a second tool.

**Data source:** `acct` docs only, read server-side. `name`/`email`/`school`/`role` live on `acct` directly (per step 1/2's account model). `lastActive` also needs to come off `acct` — not a join against `activitySummary` — because `activitySummary` is populated by a Cloud Function trigger on write activity and the export function should stay a single flat collection scan, not a fan-out join across two collections for a CSV nobody's paying latency for. If `acct` doesn't already carry a `lastActive` timestamp, that's a one-line addition to whatever already stamps it (the same write path `activitySummary` reads from), not a second read.

**Trigger:** one button, "Export emails (CSV)," on `admin.html`. Click calls a Cloud Function (`exportEmails`, gated `isSuperadmin()` server-side like every other call on the page). Function queries all `acct` docs, builds CSV server-side, returns it as the response body; browser triggers the download from the response. No client-side Firestore query, no client CSV assembly — keeps the privileged read entirely server-side and auditable in one place.

**Zero sending infrastructure — confirmed.** No SMTP, no template, no recipient selection, no scheduling, no unsubscribe handling. The function's only job is read-and-serialize; sending happens outside this system entirely, in whatever mail client Berel already uses. Matches "export the list, don't build a mailer" exactly.

**Logging:** the export call logs `{event: "emailExport", uid, rowCount, ts}` to the same audit trail as `viewAs` mints and activity-overview loads — one consistent privileged-read log, not a special case.

## Access boundary

**Client-side gate (defense in depth only):** `admin.html` loads the vendored tier-1 SDK, waits for `onAuthStateChanged`, then reads the caller's `acct` doc (or a custom claim, if step 2's tokens carry `role` as a claim — check that doc; if not, a single `getDoc(acct/{uid})` read). If `role !== 'superadmin'`, the page never renders the shell: swap the entire body for a plain "Not authorized" message and stop. No table, no buttons, no export control mounted — not hidden via CSS, not present in the DOM at all, so there's nothing to inspect/unhide via devtools.

**Real gate (server-side, per call, not per page-load):** every privileged operation — the activity-overview read, `viewAs(targetUid)`, the CSV export function — independently re-checks `acct(callerUid).role == 'superadmin'` server-side, exactly as step 2's `viewAs` already does. The Firestore security rules never grant a blanket read to anyone whose only credential is "loaded admin.html" — a non-superadmin's Firestore queries for the activity table simply fail with permission-denied regardless of what the client rendered, and the Cloud Functions throw before minting a token or building a CSV. The client-side check exists purely to avoid flashing a broken/error-riddled UI at the wrong person; it is not load-bearing for security, and this should be a one-line code comment at the check site so nobody later "fixes" it into being the real gate.

**Non-superadmin lands on the route:** they see the "Not authorized" screen (no leaked layout, no error stack, no partial data flash) and, per step 5's audit-everything stance, the failed authorization attempt itself gets logged — a Cloud Function call (even a no-op "checkAccess" ping) writes to the same audit trail as `viewAs` mints, so repeated probing by a curious rebbi is visible to Berel too.

## What this unblocks

Step 5 closes out the superadmin-facing half of the rebuild: `admin.html` now has a defined shape (separate file, server-gated on every call), a defined data source for "who's stuck" (`activitySummary`, populated by write/sign-in triggers rather than client pings), a defined view-as transition (new-tab, banner, exit-closes), and a defined email export (single server-side CSV function, no mailer). Nothing here is load-bearing for the rebbi-facing tiers — `app.html` and its two-tier custody split are untouched by this design.

What's left in the build order: **step 6** (admin gradebook view — read-only cross-class visibility for school admins, distinct from Berel's superadmin scope here), **step 7** (fragile-storage warning — surfacing to rebbeim when their data isn't safely synced), and **step 8** (the real beta migration onto this stack). None of those three depend on step 5's internals beyond the account/role model steps 1–2 already locked, so step 5 doesn't block them — it just finishes the one piece of surface area (Berel's own tools) that had no design yet.
