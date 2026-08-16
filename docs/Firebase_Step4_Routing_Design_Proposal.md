# Firebase Rebuild — Step 4 Routing & Back Button Design (Proposal)

## Status

**✅ APPROVED 2026-08-13 by Ben.** Locked into `Firebase_Rebuild_Scope.md`'s build order as step 4's design. This doc is now the reference for the route shape, router-as-choke-point discipline, class-switcher contract, tier guard, 2d/Phase-3 re-anchoring, and migration path below.

## Recommended routing design

**Route shape:** `#/c/{classId}/{group}/{tab}` with an optional `/{subtab}`. Hash, not History-API path — static hosting (Cloudflare/GitHub Pages) has no deep-path rewrite, and CLAUDE.md already treats the file as static-served. `{group}`/`{tab}` are the persisted internal keys verbatim (`scan`/`standings`/`rewards`/`learn`/`manage`) — never the R-labels — reusing `groupOfTab()` for URL→group lookups. This is non-negotiable given the CLAUDE.md constraint.

**classId is always present:** no route without one, boot with no hash redirects to `#/c/{lastActiveClassId}/scan/scan` where `lastActiveClassId` is a small localStorage value separate from Firestore. An "classId optional" framing is rejected — the step-1 scope explicitly says class-switching must leave a history trail, and an optional segment makes that trail inconsistent depending on how a user arrived.

**`activateTab` becomes a pure renderer, not the entry point.** Keep its teardown/render/dispatch body untouched, but stop letting it call `pushState` itself. A single `router.go({classId, tab})` is the only thing that pushes history and then invokes `activateTab`'s body. Both click handlers (`groupTabs`, `subTabs`) and class-switch code call `router.go`, not `activateTab` directly — an "one extra line per call site" minimal-disruption discipline applied to a stricter architecture, so the blast radius stays small even though the choke point moved.

**Back button:** every user-shaped nav action (class switch, group switch, tab switch) is one `pushState`/one history entry — no coalescing — so back always undoes exactly the last action, including a class switch. Non-nav-shaped internal state (seat-arranging toggles, in-tab filters) uses `replaceState` or nothing, guarding against back-button spam. The documented line-11116 bypass gets a comment flagging it as a known gap rather than a forced rewrite — auditing every indirect `activateTab` caller is real cost; do it opportunistically, not as a step-4 blocker.

**Deep-link cold start:** `router.applyRoute()` runs in two phases.

- **Guard first, before any fetch:** resolve `classId → {ownerId, schoolId}` via a cached local class index; `schoolId` set → require `auth.uid === ownerId` (or admin share) or fail closed to an error screen with zero fetch issued; `schoolId` null → route straight to the tier-2 local adapter, no auth check.
- **Then hydrate:** render a loading shell in the tab's view container (never blank), fetch via the storage-seam adapter, populate `data` keyed by `classId`, then call `activateTab`'s render body.

This directly satisfies step-4 sub-scope 3 (tier guard before fetch) and sub-scope 4 (deep-link safety).

**What was left out of scope:** a "router only sees the front door" tradeoff is real but acceptable only for the line-11116 exception, not as a general design stance — the stricter single-choke-point model is worth the extra call-site edits for a feature the maintainer explicitly wants back-button-correct. A full architectural rewrite framing ("every `activateTab()` caller must be audited") is overstated for step 4 specifically; only nav-triggering call sites need touching now.

## Class switcher: the routing-only contract

Router exposes three primitives; step 6 builds UI against them, nothing more.

1. **`router.switchClass(classId)`** — the entire class-switch contract. Resolves the target class through the storage-seam adapter (`schoolId` set → Firestore/tier-1 guard-then-hydrate; `null` → local adapter), preserves the *current* `group`/`tab` if that tab is valid for the new class (fallback to `scan/scan` if not — e.g. Gradebook hidden in target class), writes `#/c/{newClassId}/{group}/{tab}` via `pushState` (one entry, no coalescing — matches "class switch is a nav action"), and re-runs `applyRoute()`'s guard+hydrate phases for the new `classId`. Returns a promise/result so a future picker can show a loading or error state — but owns none of that UI itself.

2. **`router.currentClassId()`** (or a reactive `router.state.classId`) — read-only accessor so step 6's picker can render "which class is active" without touching `activeGroupName`/module state directly, and so it can subscribe/re-render on route changes rather than polling.

3. **`router.listSwitchTargets()`** — thin pass-through to whatever class-listing the storage-seam adapter already exposes (tier-1: classes owned by `uid` or admin-shared; tier-2: local `classes` object), returning `{classId, name, schoolId}` tuples. This is deliberately *not* a rendered list — no DOM, no sort/filter logic, no admin cross-class view. Step 6 owns turning this into a dropdown/modal.

That's the full surface. No picker component, no keyboard/click handling, no "recently used classes" logic, no admin multi-class rendering — all of that is step 6 product surface, built by calling `switchClass()` on selection and `listSwitchTargets()`/`currentClassId()` to populate itself. Step 4's job ends at "calling this function correctly produces a correct, back-button-undoable navigation" — proven by a stub test harness (a plain `<select>` wired to `switchClass`), not a shipped picker.

## Tier-aware route guard

**Where:** Inside `router.applyRoute()`, as the very first step — before phase-2 hydration, before any `activateTab` call. It runs on every `popstate`, every `router.go()`, and once on cold boot after parsing the hash.

**What it checks:**

1. Parse `classId` from the hash.
2. Look it up in a small **local class index** (cached from `accounts/{uid}` on login — the approved step-2 shape gives `schoolId` per account, and each class row carries its own `schoolId`/`ownerId` per the entity design). This lookup is synchronous and local — no Firestore round-trip yet, which is what makes "before fetch" possible.
3. If the index has no entry for `classId` at all → fail closed (unknown/not-yet-synced class).
4. If `class.schoolId === null` → tier-2, route straight to the local adapter, no auth check (matches sub-scope 3).
5. If `class.schoolId` is set → tier-1. Require `auth.currentUser` to exist AND (`auth.uid === class.ownerId` OR an admin-share flag on the class for that uid's `schoolId`). This mirrors — not replaces — the security-rules check; it's the "before render" half of defense in depth, the rules are the real enforcement.
6. Any of these checks failing → fail closed immediately, skip hydration entirely.

**Failure path (what the rebbi sees):** The router calls `activateTab`'s render body with a dedicated error view (`view-routeError`, added alongside the existing view divs), not a blank screen and not silent redirect. Message: "You don't have access to this class" with a single button back to `#/c/{lastActiveClassId}/scan/scan`. This is a `replaceState`, not `pushState` — a bad deep link shouldn't leave a bogus history entry back can return to.

**Files touched:** the guard is new code in the router module; it reads but does not modify `accounts/{uid}` or the class entity shapes already locked in steps 1–2.

## Re-anchoring 2d and Phase 3's floating panel to classId

**2d's armed-item state** (`app.html` ~5396–5429): `armed` is a single module-level JS variable (`var armed = null`, `{label, delta, actId}`), plus `stripActLog`/`stripActLogNextId` (the scan-strip history) and `lastTabInGroup` — none namespaced by class. `armedActivity()` resolves `armed.actId` by scanning `data.activities`, which today is *the* single dataset. Under the router, `data` becomes per-`classId` (hydrated by `router.applyRoute()`), so `armed`/`stripActLog` must move from bare module variables to a `armedByClass[classId]` / `stripLogByClass[classId]` map (or live inside the per-class `data` object itself, alongside `data.activities`) — otherwise switching classes via `router.go` leaves the old class's armed activity/pill showing against the new class's activity list, or worse, resolves `actId` against the wrong class's `data.activities` and silently arms nothing or the wrong item. `setArmed()`/`armedActivity()` need a `classId` (or ambient "current class" from the router) threaded through them, and switching classes must re-arm (or explicitly clear) the pill on class change, the same way a tab switch already re-renders.

**Phase 3's floating Points panel**: it's a FAB (`pipWin`, plus per-teacher dropped-position storage at ~4587/22774) that reads/writes the same global `armed`/`data` — it's a view onto the single dataset, not the tab system, so it inherits the class-scoping problem directly rather than needing its own new bug: once `armed` is class-keyed, the panel's scan calls (`award()`/`recordTrackedScan()`) must resolve against `router`'s current `classId`, not whatever `data` happened to point at last. The panel's *position* (dropped x/y) stays global per-teacher — that's UI chrome, not classroom state, and shouldn't be split per class. Popped-out OS window (`pipWin`) content must also re-render on a class switch while popped out, which is new: today nothing forces it to refresh mid-session.

## Incremental migration path

Sequence: 5 small PRs, each independently mergeable and testable, router dormant until the last wire-up.

**PR1 — Router module, inert.** New `router.go({classId,group,tab})` / `router.applyRoute()` / hash parse-build functions, added as pure code with zero call sites touching them yet. Unit-testable via `test-migration.html`-style harness: feed hash strings, assert parsed `{classId,group,tab}` round-trips using the persisted internal keys. No behavior change to the live app — safe to merge, zero risk.

**PR2 — Back-button wiring, single implicit class.** Point the two click handlers (`groupTabs`, `subTabs`) at `router.go` instead of `activateTab` directly; `classId` is hardcoded to the one existing tier-2 local class for now. Add the `popstate`/`hashchange` listener calling `applyRoute()`→`activateTab`. This alone delivers the maintainer-requested back button with today's single-class app, fully testable in the browser today — no Firebase dependency.

**PR3 — Deep-link cold start.** Boot reads the hash instead of always cold-booting `scan`/`scan`; missing hash redirects to default. Still single implicit class, so no guard/hydrate logic needed yet — just proves `applyRoute()` on load works and doesn't blank the screen (per the loading-shell rule, even if hydrate is instant today).

**PR4 — Guard + hydrate phases, dormant until multi-class exists.** Add the `schoolId`-based backend resolution and pre-fetch auth guard, gated so with only one local class it's a no-op passthrough. This is the actual step-4 deliverable but ships inert — nothing calls it with a real Firestore `classId` until tier-1 auth (a later step) lands.

**PR5 — Opportunistic audit.** Sweep remaining indirect `activateTab` callers (line 11116 and any found), converting nav-shaped ones to `router.go`, flag-commenting the rest. Not a blocker for PR2–4 shipping.

Each PR runs `validate` + a manual browser back/forward pass before merge; PR1–3 are shippable to beta rebbeim with zero visible change beyond a working back button.

## What this unblocks

With `classId` established as a first-class routing concern — a resolvable, guardable, history-trailed unit rather than an implicit ambient value — step 6 (admin's gradebook view) can build its class picker directly against the three routing-only primitives (`switchClass`, `currentClassId`, `listSwitchTargets`) documented above rather than reaching into module-level state, inheriting a working, back-button-correct navigation substrate instead of needing to design one itself.

**Correction (2026-08-14, consistency pass):** step 5 (superadmin tools) does **not** get cross-school listing for free from `listSwitchTargets()`. As step 5's own design doc correctly notes, that primitive is account-scoped — tier-1 returns classes owned by `uid` or admin-shared to `uid`'s own school, tier-2 returns the local device's classes. Superadmin's cross-school activity overview needs its own query (a flat scan of `accounts`/`activitySummary`, per step 5's design), not a call to this router primitive. The two designs don't conflict on data or behavior — only this paragraph's earlier claim was wrong, and step 5's doc is the accurate account of what `listSwitchTargets()` does and does not cover.
