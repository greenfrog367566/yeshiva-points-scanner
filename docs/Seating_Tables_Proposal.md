# Menchmark — Tables in the Seating Chart

**Status: PROPOSED — 2026-08-19. Not built. Needs a yes from Ben before any code.**

Asked for: *"some rebbeim have tables — can we make a CSS for both the on-screen
and printed seating chart to include seating tables — maybe drag and drop names
together to make a table and then move that whole block around — perhaps can use
the same idea as chavrusa mode when we build that."*

---

## 1. What is being proposed, in one paragraph

A **table is furniture drawn underneath the seats** — a rounded rectangle (long
table) or a circle (round table) painted behind a block of grid cells, with the
boys' cards sitting on top of it. It is created by selecting cells and pressing
"Make a table", carries a name you can rename, and can be **dragged around the
room as one block, taking its boys with it**. It renders identically on the
live chart and the printed class sheet, because both already share the same
`.seat-grid` / `.seat` rendering.

**The central property, and the reason this is a small change rather than a
scary one: a table never owns a student.** `lay.seats` stays the single source
of truth for who sits where, exactly as today. Tables are a second, parallel
list of rectangles. The worst possible bug in this feature loses a rectangle,
never a boy.

---

## 2. Why not free-form (absolutely positioned) tables

The obvious alternative is a canvas: tables with x/y pixel positions, boys
dropped anywhere. Rejected. The flat row-major `lay.seats` array is load-bearing
in about ten places — `seatResize()`, `seatAutoPlaceUnplaced()`,
`seatPruneAndFillUnplaced()`, the unplaced tray, Rebbi's view's reversal, the
print fit check, the QR sizing, arranging's drag/drop, the print auto-place. A
canvas invalidates all of them at once, and the reward is arbitrary angles that
no rebbi asked for.

Staying on the grid means **every one of those keeps working untouched.** The
cost is that a table must be a grid-aligned rectangle, which is what a table in
a classroom is anyway.

---

## 3. Data model — additive, no `DATA_VERSION` bump

```js
data.seating[classKey] = {
  rows, cols, seats:[ sid|null, ... ],          // UNCHANGED
  tables: [                                      // NEW
    { id:"…", name:"Table 1", r:0, c:0, w:4, h:1, shape:"rect" }
  ]
}
```

- `id` — from the existing `newId()` (`app.html:5888`). No new id scheme.
- `r`,`c` — top-left cell, 0-based.
- `w`,`h` — span in cells.
- `shape` — `"rect"` (long table) or `"round"`.
- `name` — free text, defaults to `Table N`.

**Invariants**, enforced at create, at move, and again on load:
`w ≥ 1`, `h ≥ 1`, `w*h ≥ 2`, `r+h ≤ rows`, `c+w ≤ cols`, and **no two tables
overlap**.

### `load2fix()` backfill

Purely additive, so **no `DATA_VERSION` bump** — per CLAUDE.md rule 1, a version
branch is only for converting existing values, and nothing here converts
anything. Alongside the existing `data.seating` guard:

```js
if(!Array.isArray(lay.tables)) lay.tables=[];
lay.tables = lay.tables.filter(validTable);   // typeof / Array.isArray guards,
                                              // never bare falsiness
```

`validTable` drops malformed, out-of-bounds and overlapping entries.
`test-migration.html`'s copies of `migrateData()`/`load2fix()` get the same
lines, and the harness is re-run — including "Corrupted data".

### What `seatResize()` does to a table

The one genuine data question, and it has a clean answer.

| Grid change | Tables |
|---|---|
| grows (rows and/or cols) | untouched, still valid |
| `cols` shrinks, table still fits | clamped left (`c = cols - w`) |
| `cols` shrinks below the table's own width | **dissolved** |
| rows grown by the never-drop-a-boy floor | untouched |

Overflow re-seating already moves boys around; the furniture does not chase
them. **Net: a resize can lose a rectangle. It can never lose a boy** —
`seatResize()` itself is not modified at all, this is a pass that runs after it.

---

## 4. Rendering — one code path, screen and print

`.seat-grid` is already `display:grid` with explicit `gridTemplateColumns` /
`gridTemplateRows`, and `renderSeatChartPrint()` already reuses the exact same
classes as `renderSeatGrid()`. So a table is **one extra grid item per table**,
appended before the seat loop in both:

```js
var back = el("div","seat-table seat-table-"+t.shape);
back.style.gridRow    = (t.r+1)+" / span "+t.h;
back.style.gridColumn = (t.c+1)+" / span "+t.w;
```

```css
.seat-table{
  border:2px solid var(--line); border-radius:14px;
  background:var(--gb-row,#f7f8fc);
  z-index:0; pointer-events:none;
  margin:-5px;                     /* half the grid's 10px gap */
}
.seat-table-round{border-radius:50%}
.seat-grid .seat{position:relative; z-index:1}
.seat.at-table{background:transparent; border-color:transparent}
.seat.at-table.empty{color:transparent}     /* bare table surface, not "Empty seat" */
```

**Every seat must be placed explicitly too — this is not optional.** Both render
loops currently rely on CSS grid *auto-placement*: seats are appended in order
and land in reading order by themselves. The moment an explicitly-placed item
(the backdrop) is in the same grid, auto-placement skips the cells it occupies,
and every seat after the first table would slide somewhere new — a silent
rearrangement of the whole chart, which is the exact class of bug the comment
block above `seatResize()` exists to warn about. The fix is two lines in each
loop, deriving the cell from the index that is already in hand:

```js
seat.style.gridRow    = Math.floor(dispIdx/lay.cols)+1;
seat.style.gridColumn = (dispIdx%lay.cols)+1;
```

That makes both charts fully deterministic rather than order-dependent, which is
worth having on its own.

**Tables are a Seating-chart-view feature only.** List mode's grid is
`auto-fill, minmax(112px,1fr)` — it has no room geometry to attach a rectangle
to — so `lay.tables` is simply not rendered there. Nothing to guard, just
stated so it is not mistaken for a gap.

Two more details that make it read right rather than merely work:

- **`margin:-5px`** bleeds the surface half the grid gutter in every direction,
  so it runs *underneath* the gaps between its own seats. Without it a table
  reads as a box drawn around four separate tiles instead of one continuous
  surface they are sitting at.
- **A vacant cell inside a table shows bare table**, not the dashed
  "Empty seat" tile. An empty chair at a table is a normal thing; a dashed
  placeholder sitting on the tabletop is not.

The table's name renders as a small caption on the backdrop's top-left corner.
It is what makes the printed sheet legible.

### Print

Same DOM, same classes — the print sheet inherits all of the above for free.
Two print-only rules:

```css
body.print-seating .seat-table{
  border:2px solid #333; background:#f0f0f0;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
  break-inside:avoid; page-break-inside:avoid;
}
body.print-seating .seat.at-table{border-color:transparent}
```

**A table must read by its BORDER, not its fill.** The seating-chart print block
does not set `print-color-adjust` globally — only the activity badge
(`app.html:1744`) and the gradebook do — and browsers drop background colours
from print by default. A fill-only table would print as nothing at all. The 2px
outline plus the name caption carry it; the grey tint is a bonus wherever the
browser honours the hint.

**Honest caveat on page breaks:** `break-inside:avoid` on a grid item spanning
several rows has patchy browser support, so a tall round table straddling a
page boundary may still split. The existing non-blocking fit warning stays the
backstop, and the risk is small — most tables are 1–2 rows tall.

**The print fit check is unaffected.** Tables are backdrops occupying cells that
already existed, so they add exactly zero height, and
`renderSeatChartPrint()`'s measurement needs no change.

### Rebbi's view — the one bug that would look most broken

Both charts implement "Rebbi's view" by reversing the flat `lay.seats` array, a
true 180° rotation. Tables are positioned by `(r,c)`, **not** by flat index, so
they do not rotate for free and must be mirrored explicitly at render time:

```js
if(rebbiView){ dr = lay.rows - t.r - t.h;  dc = lay.cols - t.c - t.w; }
```

Miss this and the boys rotate around tables that stay put. Nothing is corrupted
— it is a render-time transform only, `lay.tables` is never written — but it
would look thoroughly broken, so it is called out here rather than discovered
on paper.

---

## 5. Interaction — a "Tables" sub-mode inside arranging

Arranging already exists (behind a toggle on the live chart, always on for the
class sheet). Add one `🪑 Tables` toggle inside it.

While Tables mode is on:

1. **Seat drag is suspended.** Dragging a boy onto another boy already means
   *swap*; overloading it to also mean *bond into a table* is exactly the kind
   of ambiguity that makes a rebbi lose a seating arrangement. One line of
   helper text says so.
2. **Click cells to select.** The selection is always the bounding box of what
   has been clicked, so it is always a rectangle — this is what guarantees the
   `w`/`h` invariant without a fiddly polygon model, and it is predictable.
   Tap-to-select works on touch, matching the tray's existing fallback.
3. **"Make a table"** appears once ≥2 cells are selected and the box overlaps no
   existing table. Names it `Table N`, saves, redraws.
4. Every table gets a **grip bar** — `⠿  Table 1  ▭/◯  ✕`:
   - **Drag the grip to move the whole block**, and *every boy on it moves with
     it.* This is the ask, and it is the only part that writes to `lay.seats`.
   - The move is **refused** — grip flashes, nothing written — if it would leave
     the grid, overlap another table, or land on a cell occupied by a boy who
     is not at this table.
   - **`▭`/`◯` toggles the shape.** Pure CSS.
   - **`✕` dissolves the table. Every boy stays exactly where he is sitting.**
     Non-destructive by construction, so it needs no confirm.
   - Clicking the name renames it inline.

### The one write to guard

Moving a table is the only operation in this feature that touches student data.
It is a permutation — the same multiset of ids, just at different indices — and
it will be written that way: copy the flat array, blank the source cells, write
the destination cells, then **assert the non-null id count is unchanged and bail
without saving if it is not.** Cheap insurance, and consistent with how the
rest of the seating code already refuses to drop a boy.

---

## 6. The Chavrusa seam

**Recommendation: build seat-anchored tables now, keep Chavrusa's
people-anchored groups separate, and connect them later with one optional
field.**

The two look similar and are not the same thing:

| | Tables | Chavrusas |
|---|---|---|
| Anchored to | a place in the room | a set of boys |
| Lifespan | the year — furniture | a session, often weekly |
| Survives a roster change | yes | no, it is regenerated |
| Prints | yes, it is the room map | as bracketed groups in List mode |

Collapse them into one model and you get one of two bad outcomes: the furniture
vanishes when a chavrusa session ends, or every session permanently rearranges
the room.

Kept separate, the join is one optional field when Chavrusa is built —
`table.groupId` — and "seat this chavrusa at Table 3" becomes a *projection*:
the group owns *who*, the table owns *where*. This also leaves the redesign
summary's List-mode bracketed grouping (§2 / §6) free to work in classrooms
that have no tables at all, which is most of them.

**Nothing in this proposal builds any of that. It only avoids foreclosing it.**

---

## 7. Scope

One PR, roughly:

- ~60 lines CSS (a new `.seat-table` block + 5 print rules)
- ~180 lines JS — a `seatTables*` helper block, plus insertions into
  `renderSeatGrid()`, `renderSeatChartPrint()` and the arrange toolbar
- the explicit per-seat grid placement described in §4 (2 lines × 2 loops),
  which is a prerequisite, not a nicety
- a `load2fix()` backfill, mirrored into `test-migration.html`
- CHANGELOG under `[Unreleased] → ### Added`

No `DATA_VERSION` bump. No new dependency. No change to any existing seating
function's behaviour when a class has no tables — `lay.tables` is `[]` and every
loop over it is a no-op, so the feature is invisible to the rebbeim who do not
have tables.

---

## 8. Open questions for Ben

1. **Round tables — worth it, or is `rect` enough for v1?** `◯` is genuinely two
   CSS lines, but a round table that reads properly usually wants a hollow
   middle (a 3×3 block with the centre cell left empty), and that is a
   convention to explain rather than a feature to build. Cheap to add later.
2. **Should a table be able to carry its own colour?** Useful if a rebbi runs
   fixed chaburos at fixed tables; more state and more print-colour risk. Left
   out of this proposal deliberately.
3. **Does this want to be in the Print Wizard's component list?**
   `Print_Wizard_Spec.md` does not mention tables today. If tables ship, the
   class-sheet component's description should mention them.
