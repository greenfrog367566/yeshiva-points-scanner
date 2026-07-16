# Menchmark — UI Redesign & Feature Planning Summary

*Working summary from planning session — July 2026. Nothing here is built yet; this is the agreed spec to implement against.*

---

## 1. New Tab Map (top-level restructure)

Old structure: 6 groups (Scan, Rewards, Learn, Tools, Print, Setup), 24 subtabs, heavy overlap.

**New structure — 5 groups:**

```
SCAN        → Dashboard, History
STANDINGS   → Leader Board, Trends, Contest
REWARDS     → Raffle, Auction, Store, Prizes (new ledger)
MANAGE      → Students, Activities, Gradebook (+ Tracked Items config),
              Brachos, Random, Spinner, Backup & Restore, Settings,
              Chavrusa Mode (future build)
LEARN       → Text, Chart (folds into Gradebook), Pesukim, Mishnayos,
              Shorashim (trimmed), Quiz (new)
```

Key principle applied throughout: **Print is not a top-level group** — print actions attach as buttons on the screen whose data they print (Standings prints from Standings, Seating prints from its own setup panel, etc.), rather than living in a separate navigational destination.

**"Seating" was removed from the Manage list** — it's not a separate tab at all. It's fully contained inside Dashboard's Class View, with its own already-well-built collapsible "⚙ Setup" panel (Rows/Cols, Arrange, Print) hidden by default. No changes needed there.

---

## 2. Dashboard (Scan → Dashboard)

**Cut:** the separate "Scanbar" panel — redundant with the global scan bar already pinned at the top of the app.

**New: two view modes, one toggle**
- **List mode** (default) — activities at normal size (left), student list (right)
- **Class view** — activities compress to a narrow column with **full activity names** (never truncated — stack name/points on two lines instead), seating chart expands to fill the space
- Toggle button switches between them; state persists

**Mini leaderboard strip**
- Collapsed by default: thin bar, one-line top names
- Expands **upward** (bottom-up), not downward — seating chart/list compresses modestly to make room; nothing scrolls, no dead space
- Full leaderboard with all filters/print still lives on the dedicated Standings tab

**List mode grouping (Chavrusa integration)**
- When a Chavrusa session is active, List mode clusters students into bracketed groups (visually matching the seating chart's grouping treatment), ungrouped students below, plain alphabetical
- Reverts to plain alphabetical when no session is active

**Chavrusa Mode touchpoints on Dashboard** (only visible during an active Group/Group Entity session — zero impact otherwise):
1. Scan bar shows `🎯 Target: Dovid's group (3)` instead of normal armed-activity display
2. Grouped tiles get a subtle shared-color border/bracket (List mode and Class view both)
3. Multi-tile confirmation flash — all group members' tiles flash together on a group award
4. Dismissible strip above the mini leaderboard when Group Entity mode has unresolved pooled points: *"🧩 2 groups have unresolved points — Resolve"*

**Recent scans panel** — cut; the global bar's mini history covers "did that scan register," History tab covers deep search.

---

## 3. History (Scan → History)

- **New: Include/Exclude Contest filter** — segmented control (`All` / `Regular only` / `Contest only`) next to the existing student filter, closing a previously-unfinished gap
- **New: Bulk select + bulk undo**
  - Checkbox per row, "select all visible" scoped to current search/filter (not the whole log)
  - Bulk action bar appears when 1+ selected: `[↩ Undo selected] [✕ Clear selection]`
  - One confirmation dialog before running; reuses the existing safe `undoEntry()` per row
  - Scoped to the main History tab for now (not the Contest tab's own history view)

---

## 4. Standings group

### Leader Board
- Kept largely as-is (podium, ranked list with gap-to-next, filters, print) — already well-built
- **"Reset spendable points" button moved to Manage** — too destructive to sit next to routine filter controls
- **Print gets two options**: *Individual cards* (existing) and *Full standings list* (new) — both inherit the active filter, both live here rather than a separate Print tab

### Trends — redesigned
- **Old:** one dense weekly table (6 behavior columns × 10 weeks) trying to show the whole class at once
- **New:** Class overview (sortable-by-biggest-change list, sparkline + trend arrow per student) → tap a student → drill into the old detailed weekly table, now scoped to one student
- **Pace-vs-total fix (Option C):** the trend arrow compares "this week through today" against "last week through the same day" (like-for-like), not full-week-to-partial-week — a student with 20 pts by Tuesday isn't falsely shown as "down" against last week's completed 40. A daily-average figure is shown as secondary context alongside the arrow.
- **"Send totals to Sheet" button — removed.** Confirmed redundant: the Apps Script already auto-rebuilds a live "Leader Board" sheet tab on every scan. The button pushed to a *second*, manually-triggered "Standings" tab that could silently go stale — actively worse than doing nothing. (Same redundant button also existed in Backup & Sheets — removed there too.)

### Contest
- Moved into the Standings group (was under Scan) — infrequent enough that it shouldn't sit in the daily-use group; thematically it's a scoped/temporary leaderboard anyway
- **New "Today" duration option** alongside existing 1 week / 1 month / custom — one tap, no date picker, for single-day contests
- **New explanatory copy** above the Start button: concrete examples (color war, single-day challenge), what happens to real points, what happens at the end (merge is a deliberate choice)

---

## 5. Rewards group

### Raffle — redesigned layout
- Mode toggle relabeled: **"Student chooses tickets"** (was "Boys choose tickets" — flagged as part of a broader gendered-language cleanup, see §9)
- "Tickets from" dropdown **collapses/hides** when in "Student chooses tickets" mode (only relevant to auto mode)
- Big, centered wheel (60–70% width) replacing the small wheel-beside-sidebar layout
- Large Spin button centered directly under the wheel
- Manual mode's ticket pool becomes a collapsible section (open during setup)
- Recent winners collapses to a bottom strip, tap to expand
- **New: prize tracking on every winner** — a checkbox *"This raffle had a prize"*; if checked, reveals an optional "What did they win?" field (blank defaults to "Raffle prize"). Applies to both auto and manual mode. Feeds the shared Prize Ledger. Cost populates from actual ticket spend in manual mode; blank/dash in auto mode (non-destructive draw).

### Auction — audit fix (no UI redesign, a data-integrity fix)
- **Confirmed gap:** ticket purchases never touch the permanent log — only live in mutable, clearable state. Inconsistent with Raffle/Store, invisible in History, never reaches the Sheet.
- **Fix:** at the moment a prize is **drawn** (locks all placed tickets on it, win or lose), write a permanent log entry for every student with tickets on that prize. Preserves the current no-spam behavior during exploratory ticket placement while closing the audit gap at the one moment it becomes a real, final transaction.
- **New:** the winner (not losing bidders) gets an entry in the shared Prize Ledger.

### Store — no changes needed
- Already has a "Received" checkbox system with an auto-mark setting (`data.store.autoReceived`) and a sensible migration default. This becomes the foundation the shared ledger is built on.

### Coin Deposit / Withdraw (new — Shulchani Mode only)
Purpose: loss protection, not a savings/spending split. A student holding real physical Shulchani coin tokens (rewards, or handed out separately from app scans) can have those coins converted into a permanent digital balance by the rebbi — trading "at risk of being lost" for "safely recorded." Full withdraw-back-to-physical direction included too, for symmetry.

- **One combined tool** with a Deposit/Withdraw direction toggle (not two separate screens) — reuses one denomination-picker UI either direction
- **Rebbi-only, deliberate action** — never student-initiated, never automatic
- **Coin-denomination entry** (e.g. "2 Sela, 1 Dinar"), reusing the same breakdown picker already used elsewhere in Shulchani Mode — not raw Prutot math
- **Deliberately loses granular activity history** — this is a known, accepted tradeoff, not a bug. A single lump-sum log entry is written instead of per-activity detail, and the rebbi is shown a calm inline note (not a blocking warning) before confirming, since they already understand and accept the tradeoff
- **Still logged, just tagged distinctly:** `"Physical coin deposit"` / `"Physical coin withdrawal"`, positive/negative delta, with a small 🪙 tag in History so it's visually distinguishable from a normal activity-based entry
- **Direct addition/removal on the student's normal spendable balance** — no separate "banked" pool
- **Effects, both true and both fine, not flagged as problems:**
  1. Changes Standings/leaderboard immediately, same as any other spend/award
  2. Does **not** touch Trends/lifetime-earned — consistent with how Store and Auction spending already work (spending never erases earning)
  3. Withdraw reintroduces the physical loss risk Deposit exists to eliminate — worth a brief inline note so a rebbi makes that trade knowingly, not a warning dialog
- **Location:** Rewards group, only visible when Shulchani Mode is on. Tab named **"Coin Deposit"** (not "Bank") to avoid implying a fuller banking metaphor (interest, savings goals) that doesn't exist here.

### Prizes (new) — shared ledger
- New 4th item under Rewards
- Unifies Store purchases, Auction wins, and prize-flagged Raffle wins into one list
- Search by student, filter by Source (Store/Auction/Raffle) and Status (defaults to Pending)
- Summary line + **"Mark all as received"** bulk action, scoped to current filter
- Per-row action is source-conditional: Store entries keep "Refund" (real, reversible operation); Auction/Raffle entries get "Remove from ledger" only (tickets are already locked/non-refundable by the time a prize is won)
- Per-student drill-down, consistent with the By-Student pattern used elsewhere

---

## 6. Manage group

### Students
- **Consolidated to one "Add students" launcher** (Manual / Paste a list / Import from Sheet as method tabs inside one collapsible block) instead of three permanently-stacked add-methods — collapsed by default once a roster already exists

### Activities
- No changes — already minimal and correct

### The big consolidation: Attendance / Homework / Tracker / Passes → **Gradebook**
Confirmed real architectural redundancy: four separate hand-built implementations of the same "student + timestamp + value" pattern. Replaced with one engine:

**Tracked Items (data layer only, minimal UI)**
- Five value shapes: **Count** (tap = +1: Chazan, Called On, Line Leader), **Status** (pick one of N labels: Attendance Present/Absent/Late, Homework Full-credit/No-credit), **Checked** (legacy/simple on-off), **Limited-use** (capped per period, auto-resets: Bathroom Passes), **Grade** (enter a value on scan: test grades, quiz results — letter/numeric/pass-fail scale configurable per item)
- No dedicated views of its own — just: a simple setup list to create/edit items, the "armed item" mechanic reusing the existing global-scan-bar pattern, and a lightweight confirmation flash on scan
- **Count-type items get a staleness badge** on student tiles while armed: "last: 3d" / "never" — answers "who hasn't had a turn in a while" right where the teacher is looking, without a trip to Gradebook
- Status-type items (Attendance, Homework) get an "unmarked" indicator instead, since these are typically applied to the whole class in one sitting
- Limited-use items (Passes) show "used / available" directly on the tile while armed

**Gradebook (the one full UI)**
- Auto-populated matrix: rows = students, columns = Tracked Items (adapts per item's value shape)
- **Toggleable columns** — one picker covering both Tracked Items and (optionally) point Activities as an opt-in overlay; Tracked Items on by default, point Activities off by default; selection persists as the teacher's default
- Global search + date-range filtering
- **Weekly grid view** (new) — the "gradebook chart" format: rows = students, columns = Mon–Fri, ✓/✗/— cells, tap-to-cycle without scanning, prev/next week navigation, printable. Built as a reusable view mode; Homework is the default use case
- By-Student drill-down — full record for one student (attendance, homework rate, counts, grades) — the parent-conference view
- Print support, matching the rest of the app's print treatment

**Note:** Attendance/Homework/Passes stop being separate tabs — they become presets (Tracked Item configs) that show up as Gradebook columns and armable scan items, with their existing specialized copy/defaults preserved.

### Brachos
- Restructured to two sub-tabs at the top: **"After Snack"** (Al Hamichya + Borei Nefashos, unchanged) and **"Asher Yatzar"** (new, simple card, no toggle needed)
- Overall tab title stays "Brachos"; sub-tab labels carry the specific context

### Random (renamed from "Picker")
- Renamed to resolve a real naming collision — the app's own user guide needed a footnote to distinguish "Raffle" (weighted, points-based) from "Picker" (equal-odds, no points), which is a sign the names weren't doing their job
- Two instances share the name: the floating quick-access widget and the concept generally; the full-featured **Spinner tab** keeps its name since it does more than turn-picking (custom lists, saved sets)

### Spinner — bigger wheel, cleaner layout
- Wheel becomes the dominant element (~60–70% width) instead of a small wheel beside a narrow side column
- Mode toggle (Class names / Saved lists / Custom) moves to the very top, out of the way
- Spin button becomes large and centered directly under the wheel
- Select All/None + save-list actions collapse into one slim row

### Backup & Sheets → simplified to "Backup & Restore"
Was 9 flat cards + a separate sync section. Consolidated to:
- **Backup & Restore** — one 2×2 concept: Google Sheet (Save now / Restore) and Backup file (Download / Restore), plus a small "Download offline copy" callout nearby (distinct — a working app copy, not a restorable backup format)
- **Sync to Google Sheets** — kept mostly as-is (link config, auto-sync toggle, Resync all scans); **"Send standings now" removed** (confirmed redundant, see §4); first-time setup instructions collapsed by default
- **Other exports** — Export standings CSV, small and clearly labeled as "not a backup"
- **Emergency recovery** — Restore from Log CSV, demoted to a collapsed `<details>` since it's a lossy last-resort, not a primary path
- **Danger zone** — Start new period / Clear ALL data, isolated at the very bottom with clear separation from routine actions

### Settings — grouped, and three cards relocated
Was 11 flat cards with no hierarchy, mixing global prefs with feature-specific config.

- **Relocated out of Settings entirely** (they only matter to one feature, should live with it): Teach Mode (flip arrow keys / flip columns) → onto the Teach view itself; Shorashim Quiz delay and Game Show auto-advance timing → onto their respective mode panels
- **Remaining 8 grouped into 4 sections:**
  - Display & Layout (Hebrew date, page width, header shortcuts, tabs shown)
  - Sound & Interaction (sound effects, tap-panel breakdown-on-tap)
  - Scoring Mode (🪙 Shulchani Mode — kept prominent, its own card, since it's structural/data-affecting, not cosmetic)
  - Hardware (Barcode/QR Scanner Serial/COM — collapsed by default, rarely needed)

### Chavrusa Mode (future build — not yet implemented)
Full spec captured from the uploaded build prompt; UI reuses existing components rather than inventing new ones:
- Manual mode (tap tiles to build groups) reuses the existing tap-panel/seating-chart tile component
- Automatic mode (group size, avoid-previous-pairings toggle, generate/clear)
- Rule editor as a modal off a student tile, same interaction pattern as editing a student
- Past Chavrusas — collapsible panel, load/delete saved sessions
- **Point Target modes**: Individual (default, no Dashboard changes) / Entire Group / Group Entity (shared pool + "Resolve Group Points" action)
- Fallback warnings (relaxed rules/history) surface as a dismissible banner, not a blocking modal
- See §2 above for the specific Dashboard integration points

---

## 7. Learn group

### Text / Chart / Pesukim / Mishnayos
- Confirmed these already share one efficient underlying engine (`view-pesukim`, internally mode-switched) — Teach and Match are correctly reused between Pesukim and Mishnayos. No bloat here.
- **"Chart" mode folds into Gradebook** — it was a bespoke fifth implementation of the exact Tracked-Item pattern (arm a pasuk, scan a student to mark tested, timestamped, chart view, points-on-mark). Becomes a Grade/Status-type Tracked Item with **per-verse columns instead of per-day columns**, reusing the same armed-scan-bar mechanic and the same weekly-grid-style engine. Results show up as Gradebook columns automatically.
- **Text mode** (AI-prompt-builder / Sefaria-fetch / CSV import / set list / stitch tool) — collapse by default once text sets already exist, same fix applied to Students
- **Dead code flagged:** a legacy internal segmented control superseded by the external subtab nav, currently `display:none` — remove during implementation, zero functional impact

### Shorashim — trimmed
- **Cut:** Cards (flashcards), Memory, Quiz (old bespoke version), Game Show — four modes removed
- **Kept:** **Words** (setup) + **Match** (the one matching game)
- Emoji-instead-of-English toggle **now defaults OFF** (English shown by default)
- **Emoji becomes a required field** on Words setup (was optional free text) — since it's now the secondary/opt-in display mode, every word needs one if a teacher does flip the toggle on

### Quiz (new — replaces the old Shorashim-only quiz)
One unified quiz engine across **Chumash, Mishna, and Shorashim**, pulling from whichever content sets already exist rather than requiring separate setup.

**Distractor generation — false-negative fix (the core correctness requirement):**
1. The correct answer can never also appear as a distractor (checked by translation *string* equality, not item ID — two different verses can share a translation)
2. No two distractors can duplicate each other
3. If a content set is too small to yield enough unique distractors, the quiz gracefully reduces option count (down to 3, or true/false) rather than ever risking an ambiguous/unfair question

**Two modes:**
- **Standard Quiz** — source + set picker, question count, optional timing
- **Speed Mode** — countdown timer + running correct-count, auto-advances instantly on answer, ends automatically at time-up, result shown as "X correct / Y attempted"

**Gradebook integration:** both modes log a Grade-type Tracked Item entry per student at completion (percentage/letter/pass-fail for Standard, "X/Y attempted" for Speed Mode — kept as a separate column type since it measures throughput, not just accuracy). Grade scale configurable per individual quiz, matching general Grade-type Tracked Item flexibility.

**Student selection for Speed Mode — both options available:**
- **Spin for student** — opens the redesigned Random/Spinner wheel inline, respects "skip already-picked"
- **Manual pick** — direct student dropdown/tap-list
- Teacher can switch between the two freely between rounds

**Printable Answer Cards (new):** four generic, reusable A/B/C/D cards (printed once, laminated) with QR codes encoding a lightweight `ANSWER:A`-style code, following the same code-prefix pattern as existing `ACT:`/`CTRL:UNDO` codes. Lets a student without a device hold up/point to a card; teacher scans it to log correct/incorrect. Uses the same QR-generation and print-layout infrastructure as existing Activity Menu / Personal Scoring Pages — not a new subsystem.

- **Spin-for-student wheel auto-opens as Picture-in-Picture** the moment that mode is selected (reuses the existing floating-scanner/floating-Picker PIP mechanism) — keeps the quiz question visible on the projector at all times; closes automatically when switching to Manual pick or ending the session.

---

## 8. Floating panels

### Floating Points panel — redesigned for PIP
- **Problem confirmed:** activity buttons and student-name tiles rendered at full Dashboard size inside a small PIP window — too large, cramped, forced the existing "Compact names" toggle as a workaround
- **Fix:** replace both button grids with **dropdowns** (Activity, Student) — renders at native compact size regardless of window size, no overflow, no wrapping
- Scan input remains the primary interaction; dropdowns are the manual/mouse fallback
- The "Aa Compact names" toggle becomes unnecessary and can be removed
- Panel sizing becomes dynamic (adapts to available space) rather than trying to force a fixed grid to reflow

---

## 9. Cross-cutting cleanup items (flagged, not yet actioned)

- **Global gendered/camp-specific language sweep:** "boy/boys/camper" language found in multiple places (Raffle's old mode label, manual-panel copy, Apps Script sheet column headers "Camper"). Standardize on "student" throughout. Needs a full find-and-replace pass across the file when implementation starts.
- **Onboarding — Shulchani Mode as a first-run choice:** when a rebbi does initial setup (roster import, activities config), Shulchani Mode should be offered as one of the first-run questions, not just discoverable later in Settings. Settings' Shulchani card becomes the "change your mind later" path once onboarding exists.

---

## 10. Check against the original philosophy docs

Revisited the imported philosophy/ideology docs against everything above. Most core complaints are directly addressed:

**Addressed:**
- "Maximum 5 tabs" → landed on exactly 5 (Scan/Standings/Rewards/Manage/Learn)
- "Air traffic control, not a dashboard" / "no scrolling" → Dashboard's List/Class-view toggle, bottom-up leaderboard strip, no-scroll seating chart
- "QR scanner as the global input engine" → armed-item pattern now extends across points, Tracked Items, and Quiz
- "Make Tools a launcher" → Manage's reorganization, Gradebook consolidation
- "Less Minecraft, more Duolingo" (avoid flashy gamification) → Shorashim trimmed from 6 modes to 2; Chart mode folded into a quiet Gradebook column instead of its own flashy tool

**Not addressed — genuine gaps against the original vision, not yet designed:**
- **Student View** — a dedicated student-facing screen (coins, level, progress bar, recent wins) sketched in the UI ideology doc. Never designed this session; only ever referenced as "the teacher shows individual progress" on demand. The new Coin Deposit/Withdraw screen could become this view's content later, but the screen itself doesn't exist yet.
- **Teacher Command Bar** — a Spotlight-style command input ("give yosef 5", "open chavrusa") called out as "the killer feature" in the Optimization doc. Not touched.
- **Double-scan detection** — a soft "scan again?" warning when the same student is scanned twice within ~2 seconds. Not built.
- **Class Goal / status badges** ("🔥 On Fire", a class-wide progress bar) — the "Duolingo-style" gamification layer from the ideology doc. Not designed.

Worth a decision on whether any of these still matter before treating the map as fully closed.

---

## 11. Parked for later (not designed yet, or blocked on external info)

- **Batch Import / offline scanning workflow** — for rebbeim who don't want a computer in the classroom, using a scanner's onboard Storage Mode all day, uploaded by a secretary at day's end.
  - Confirmed the Tera 1300-series scanner supports this: Storage Mode → Upload All Barcodes Stored → Total Records → Clear All Barcodes Stored, plus a configurable **Timestamp Prefix/Suffix** (scan-to-configure barcodes confirmed from the manual).
  - **Blocked on:** the literal timestamp output format (date order, separators, delimiter between timestamp and barcode data) — the manual's relevant page is a scanned image, not machine-readable, and doesn't print a sample output string. **Next step:** do one real test scan with the Timestamp Prefix enabled, paste the raw resulting text, and the parser gets speced against real data.
  - Design direction already agreed: pair this workflow with **Personal Scoring Pages** (self-contained student+activity QR codes) rather than the normal armed-activity + student-code flow, since a single self-contained code per scan eliminates any risk of the whole day's attribution desyncing from a dropped or reordered buffer entry.
  - Review-before-commit screen planned (preview list, flag unparseable lines, confirm before touching real data).

- **Full Chavrusa Mode build** — spec is complete (§6), implementation not started.
