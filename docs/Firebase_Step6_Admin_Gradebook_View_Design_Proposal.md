# Firebase Rebuild — Step 6 Admin Gradebook View Design (Proposal)

## Status

**✅ APPROVED 2026-08-14 by Ben.** Locked into `Firebase_Rebuild_Scope.md`'s build order as step 6's design. This doc is now the reference for the item-level `book` field, the sharing mechanism, the admin UI, and the updated security rules below.

## Recommended design

### Item-level `book` field

**Field:** `trackedItems.book: 'class' | 'teacher'`, written once at item creation, entries carry nothing — visibility is always resolved by looking up the parent item via `itemId`. All three proposals converged here independently; it's the only shape that keeps `trackedEntries` writes cheap and gating auditable at a single document per item rather than per-scan.

**Defaults (from B and C, not A):** attendance/homework/recognition items are seeded `'class'` at creation — they mirror what's already implicitly public today. Every other tracked item defaults `'teacher'`. A's "class by default, teacher opt-in" was rejected: the scope doc's own words are "private notes stop being honest the moment they're watched by default," and A's design contradicts that for anything a rebbi invents freeform. Default-private is the point, not a side effect.

**Security rules — B/C's override structure, A's terse resolver style:**

```
function itemBook(classId, iid) {
  return get(/databases/$(db)/documents/classes/$(classId)/trackedItems/$(iid)).data.book;
}
function itemVisible(classId, iid) {
  return itemBook(classId, iid) == 'class' || parentClass(classId).sharedWithAdmin == true;
}
match /trackedItems/{iid} {
  allow read: if isOwner(parentClass(classId)) || isSuperadmin()
    || (isAdminOf(parentClass(classId).schoolId) && itemVisible(classId, iid));
}
match /trackedEntries/{eid} {
  allow read: if isOwner(parentClass(classId)) || isSuperadmin()
    || (isAdminOf(parentClass(classId).schoolId) && itemVisible(classId, resource.data.itemId));
}
```

Class-level `sharedWithAdmin` is repurposed as a whole-book override rather than the sole gate (B, C) — this is the load-bearing fix to A: A's item field is the *only* lever, which forces "share everything" and "share one item" into the same mechanism with no blanket option except a bulk batch-write. Keeping the class boolean as an OR'd override gives a real all-in path without a per-item write storm, while the item field stays the default lever for the common case.

**Admin UI — C's continuous book, not B's separate section:** default view is a single Gradebook filtered to `book == 'class'` (or override-opened) items, no toggle, no "N hidden" counter — a visible private-item count defeats the privacy promise, per C. When a rebbi shares one Teacher's Book item, it renders inline with a small "shared by [rebbi]" badge rather than a segregated tab. B's instinct — never let shared-in content pass as standard oversight — is preserved by the badge itself; it doesn't need a whole separate section to avoid deception, and one continuous book is the more usable admin surface (the lens this step is optimizing for).

**Sharing mechanism — C's two distinct triggers, never the same button (B's non-negotiable):** per-item "Share with admin" reuses the existing promote-to-visible confirm dialog, retargeted, and flips just that item's `book`. A separate, more prominent Settings-level "Share your entire Teacher's Book" confirm flips the class `sharedWithAdmin` override — different copy, different surface, so clicking one can never be mistaken for triggering the other.

**Migration:** backfill `book` via the same name-matching predicates already used for `trackedActIdsStamped` (C) — no new classification logic needed, reuses a proven one-shot stamping pattern already in the codebase.

**What was dropped:** A's class-default seeding (undermines the privacy promise) and A's single-lever-only rules (forces an unwanted all-or-nothing UI); B's separate "Shared by" section (redundant given a badge already prevents the same confusion, at a UX cost the admin-usability lens argues against).

## Default book classification for new items

Default classification (no manual triage):

- **Attendance, Homework, Recognition/Middos items**: seeded `book: 'class'` at creation — matches "already-locked" default from this session's design.
- **Every other item** (custom tracked items, Passes, Contest-adjacent items, anything a rebbi invents freeform): seeded `book: 'teacher'`.

**Classifier is name/type-based, not a rebbi decision.** Reuse the exact predicate set already proven for `trackedActIdsStamped` — `PASS_ACT_NAME`, `ATT_ACT_NAME`, `homeworkActivity()`-style name tests — but this time to set `book` instead of `tiId`. Those predicates already exist solely to identify "is this attendance/homework/recognition" for the one-shot stamp; step 6 doesn't invent new classification logic, it reads the same signal a second time. Any item that doesn't match one of the three known predicates falls through to `'teacher'` by default — so a brand-new custom item type invented after this ships is automatically private without needing to be added to an allowlist.

**Migration (existing installs):** one-shot `book` backfill in `load2fix()`/the Firestore migration step, run once per item using the same predicates, alongside — not replacing — `trackedActIdsStamped`. Idempotent, matches the pattern CLAUDE.md already sanctions for additive fields.

**Interaction with promote-to-visible:** the classifier sets the *default*, not a lock. A rebbi can still hand-promote a `'teacher'` item to admin-visible via the per-item "Share with admin" confirm (reusing the existing promote-to-visible dialog, retargeted at admin) — that's the same mechanism already designed above for manual sharing, just now sitting downstream of an auto-classified starting point rather than a blank one. Nothing about auto-classification bypasses or shortcuts that confirm; it only decides what the item starts as before a rebbi ever touches it. This keeps day-one onboarding zero-effort (a rebbi with years of Attendance/Homework history gets correct class-visible defaults with no batch action) while preserving the non-negotiable: nothing becomes admin-visible without either matching a known public-type predicate at creation or an explicit confirm afterward.

**Ambiguous/renamed items:** if a predicate can't classify an item (custom name collides with no known pattern), default `'teacher'` — consistent with "default-private is the point, not a side effect" from the locked design; false-negative (privately-defaulted attendance-like item) costs a rebbi one manual share-confirm, false-positive (auto-exposed private note) costs trust.

## Migration of existing trackedItems

Migrated items get `book: 'class'` at converter-write time, keyed off the same name-matching predicates already used for `trackedActIdsStamped` (attendance/homework/recognition-shaped items → `'class'`), and everything else → `'teacher'`. This is not new inference logic — it's the identical classification the converter and `trackedActIdsStamped` already run today to route legacy stores into the mirror, applied once more to assign `book` instead of a tracked-item id. "Loop and copy, no inference" governs *values* (scores, timestamps, counts) — it was never a ban on reusing an existing, already-approved predicate to set a new field; step 3's discipline is about not guessing at data, not about refusing to carry forward a classification decision this project already made and shipped.

No rebbi confirmation gate before admin can see anything from a converted class. Three reasons this stays consistent with the locked design rather than undermining it:

1. **It's not a new exposure — it's status quo continuing.** Pre-migration, there was no admin role at all, so nothing was "private" from an admin in the first place. Classifying migrated attendance/homework/recognition as `'class'` doesn't newly expose a rebbi's private notes; it reproduces the same default freshly-created items get under the approved design (attendance/homework/recognition seeded `'class'` at creation).

2. **The privacy promise is about freeform content, not oversight data.** The scope doc's "private notes stop being honest the moment they're watched by default" line targets the Teacher's Book — arbitrary tracked items a rebbi invents. Legacy attendance/homework/recognition items are definitionally Class Book content by the same predicate used everywhere else in this codebase; gating them behind a confirm step would be *more* restrictive than the rule this step is implementing, not consistent with it.

3. **`sharedWithAdmin` is still off by default.** Anything the name-match can't classify as class-shaped defaults `'teacher'` — private, same as new items — so ambiguous legacy data lands on the conservative side without needing a prompt.

## Admin's Class Book UI

**Route:** `#/admin/classes/{classId}/book`, reached from an admin-only "Schools" list → class row → "View Gradebook." Gated at render by `acct().role in ('admin','superadmin')`. Not a tab in `TAB_GROUPS` — the rebbi's own nav never shows it; it's a standalone admin-tier screen.

**Correction (2026-08-14, consistency pass):** step 4's approved router design only specifies the `#/c/{classId}/{group}/{tab}` scheme and its tier/ownership guard — it does not define an `#/admin/` route namespace or a role-based guard, so "same guard pattern as step 4's other admin-only routes" overstated what step 4 actually built. This route needs its own role-checked entry in the router (parse `#/admin/...`, check `role` before mounting, fail closed exactly like step 4's tier guard does for `#/c/...`) — flagged here as a small addition step 4's implementation owes, not a redesign of either doc.

**What it shows:** One table, one class at a time — students down the side, tracked items across the top, exactly the existing Gradebook layout reused. The item set is server-filtered by the rules above (`itemVisible`), so nothing client-side decides inclusion — an item admin can't query simply isn't in the response. No "N items hidden" counter anywhere (per C's privacy lens).

**Visual distinction — the load-bearing part:** every column header carries a small icon + label baked into its render, driven by the `book` field the row itself returns:

- `book: 'class'` → plain header, no badge. This is the default, unmarked state — attendance/homework/recognition read exactly like today's Gradebook.
- `book: 'teacher'` (only present because it or the whole class was shared) → header carries a small amber "🔓 shared by [rebbi name]" badge, non-dismissible, rendered every time the column appears — never a one-time toast. The badge text itself distinguishes the two share triggers: per-item shares say "shared by [rebbi]"; a whole-book override (`sharedWithAdmin`) instead prints a one-line banner above the *entire table* — "[Rebbi] has shared their full Teacher's Book" — so admin can tell "this one item" apart from "everything, on purpose" at a glance, matching the two distinct UI triggers from the sharing design.

No hover-only or icon-only distinction — the badge always shows text, because a color-only or icon-only cue is exactly the kind of thing that reads as "just another column" under a quick glance, which is the failure mode this has to prevent.

## Updated security rules

```
function itemBook(classId, iid) {
  return get(/databases/$(db)/documents/classes/$(classId)/trackedItems/$(iid)).data.book;
}
function itemVisible(classId, iid) {
  return itemBook(classId, iid) == 'class' || parentClass(classId).sharedWithAdmin == true;
}

match /classes/{classId} {
  match /trackedItems/{iid} {
    allow read: if isOwner(parentClass(classId)) || isSuperadmin()
      || (isAdminOf(parentClass(classId).schoolId) && itemVisible(classId, iid));
    allow write: if isOwner(parentClass(classId)) || isSuperadmin();
  }
  match /trackedEntries/{eid} {
    allow read: if isOwner(parentClass(classId)) || isSuperadmin()
      || (isAdminOf(parentClass(classId).schoolId) && itemVisible(classId, resource.data.itemId));
    allow write: if isOwner(parentClass(classId)) || isSuperadmin();
  }
}
```

**Consistency with step 2:**

- `isAdminOf(sid)` and `isSuperadmin()` are reused unchanged — no new role-check helper is invented.
- `canRead(c)` is **not** reused as-is for these two subcollections, because it resolves purely at the class document (`c.sharedWithAdmin == true`) and has no notion of an item. `itemVisible()` is a new, narrower helper that composes the same class-level check (`parentClass(classId).sharedWithAdmin == true`) with the new per-item `book` lookup, OR'd together — it doesn't replace `canRead()`, it's the item-scoped analog step 2 flagged as missing. `students/` and `prizeLedger/` keep using `canRead()`/the class-level check untouched; only `trackedItems`/`trackedEntries` gain the extra branch.
- `parentClass(classId)` is reused verbatim as the existing single get() for the class doc, so `itemVisible` costs one additional get() (the item doc) beyond what step 2 already paid.
- Ordering matches step 2's convention: owner/superadmin short-circuit first, admin-gated clause last.

This is the concrete fix for the flagged gap: `book` is now the default lever per item, `sharedWithAdmin` survives as the whole-book override, and nothing outside `trackedItems`/`trackedEntries` changes.

## What this unblocks

Step 7 (fragile-storage warning) and step 8 (real beta migration) now have a settled shape for how admin visibility resolves per item and per class, so neither has to re-derive the class/teacher book split or invent its own gating rule when it touches `trackedItems`/`trackedEntries` — step 7's warning copy can rely on `book`/`sharedWithAdmin` being the actual visibility model, and step 8's migration can run the same one-shot backfill predicates already specified here rather than designing new ones. This also **closes step 2's flagged open follow-on**: the missing item-scoped read rule for `trackedItems`/`trackedEntries` now has a concrete `itemVisible()` implementation that composes cleanly with step 2's existing `canRead()`/`isAdminOf()`/`isSuperadmin()` helpers.
