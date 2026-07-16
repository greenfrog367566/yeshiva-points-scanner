# Menchmark — Print Wizard & Printable Library

*Spec. Grounded in the app's real QR/coin/code systems (verified against app.html).*

---

## Why this exists

Printing is currently four scattered tabs (Students / Activities / Seats / Points). Two problems:
1. There's a lot to print and no single place that guides a rebbi through it.
2. The **no-screen rebbeim** — the ones who don't want a computer in the room — need a *complete paper kit* they can run the whole system from. Right now there's no "print everything I need" path.

The Print Wizard is one guided entry point for all printing. It also produces a **full printable library** so a rebbi can operate entirely on paper + scanner.

---

## An important distinction up front: two kinds of "scanner codes"

These get bundled together in conversation but are fundamentally different, and the difference is a real build constraint:

**1. App control codes** — `ACT:<id>` (arm an activity), `CTRL:UNDO`, `CTRL:CUSTOM+/−`, `CTRL:PASUKNEXT/PREV`, `ANSWER:A/B/C/D` (quiz cards).
- The app **generates these itself** via `makeQrCard()`. Already working.
- Fully ours to print, size, style, and lay out however we want.

**2. Scanner HARDWARE config codes** — vibrate on/off, volume, COM/serial mode, USB-HID mode, storage/memory mode, "upload all," "clear all," timestamp prefix/suffix.
- These are **printed in the Tera manufacturer's manual**. They are Tera's own proprietary barcodes. **The app cannot generate them** — a "volume up" barcode is a specific image Tera designed; we can't mint it from a string.
- **Constraint:** to put these on a Menchmark printout we'd have to **reproduce Tera's barcode images**, which raises a redistribution question (are they free to reproduce? probably fine for a free tool, but worth confirming, not assuming). 
- **Honest options:**
  - (a) **Link/reference** the specific manual pages ("Scanner setup → see Tera manual p.12–14, or scan the QR below to open it") — safest, zero redistribution question.
  - (b) **Reproduce the specific codes** a rebbi actually needs (the handful: storage mode, upload all, clear all, timestamp prefix, COM mode, volume, vibrate) as images bundled with the app — only after confirming that's OK to redistribute.
  - **Recommend starting with (a)** — a clean "Scanner Setup Sheet" that references/links the manual and explains *which* codes to scan and why, without reproducing Tera's images until redistribution is confirmed.

Everything else below is category 1 (ours, freely printable) unless noted.

---

## The Print Wizard — structure

A single **"Print"** launcher in Manage (replaces the four scattered print tabs). Opens a guided chooser:

```
🖨 Print Wizard

What do you want to print?

  ▸ Student codes        (QR labels · personal scoring pages · full cards)
  ▸ Activity codes       (activity menu · control codes)
  ▸ Class materials      (class list · seating chart · point cards)
  ▸ Shulchani coins      (per-student coin codes · coin activity codes)   [Shulchani only]
  ▸ Scanner setup        (hardware config reference)
  ▸ 📦 Full paper kit     (everything, for running with no screen)
```

Each branch leads to that category's options (format, size, who/which, preview) — reusing the existing render functions (`renderLabels`, `renderPersonalPages`, `renderMenuLabels`, `renderPointsPrint`, `renderSeatChartPrint`) rather than rebuilding them. The wizard is a **navigation + assembly layer** over print machinery that mostly already exists.

**Universal principle:** every printable supports **all sizes** — Avery label sheets (existing), tiles/cut-outs (existing), and full-page/large-card formats (some new). Size is always a choice, never fixed per item.

---

## Component 1 — Student codes (exists, reorganized + extended)

From the current `printStudents` page. Keep all of it:
- **Student QR labels** — Avery 5160 / tiles, choose group/who/copies. (exists)
- **Personal Scoring Pages** — each student's page with one-scan-does-it-all codes (student+activity baked in). (exists)
  - ⚠ **Load-bearing:** these are the mechanism the No-Computer / Batch Import workflow rides on. Must survive the reorg — do not simplify away.

**New — the big double-sided student card:**
- One large card per student holding **all their QR codes** — their identity code plus a code for every activity (their personal scoring codes), laid out big enough to scan easily.
- Double-sided option: identity + most-used activities on front, the rest on back.
- All sizes available (index-card, half-page, full-page).
- Reuses `makeQrCard()` + the personal-page code generation; this is a new *layout* of existing codes, not new code types.

---

## Component 2 — Activity codes (exists, reorganized)

From the current `printActivities` page:
- **Activity menu** — the `ACT:<id>` cards that arm each activity. (exists)
- **Control codes** — `CTRL:UNDO`, `CTRL:CUSTOM+/−`, `CTRL:PASUKNEXT/PREV`, and the new `ANSWER:A/B/C/D` quiz cards. (mostly exists; quiz cards from the Quiz spec)
- All sizes available.

---

## Component 3 — Class materials

- **Class list** — a printable roster (names, optionally groups). *New but trivial* — the data's all there; just a clean printable table. Useful for a no-screen rebbi to have the roster on paper.
- **Seating chart** — from `printSeats` / the Dashboard seating setup. (exists)
- **Point cards** — per-student current-points cards from `printPoints`, using the Leader Board filter. (exists)

---

## Component 4 — Shulchani coins (Shulchani Mode only) — the distinctive one

This is the richest new piece, and it's specific to Shulchani Mode. The app already has everything needed: each denomination has a name, Prutot value, and **a defined color**:

```
Darkon  1536 pr  #9B7B1C      Maah     32 pr  #2E7D6E
Sela     768 pr  #A8772A      Pundion  16 pr  #3D5A98
Dinar    192 pr  #B04432      Isar      8 pr  #6B4E9E
                              Prutah    1 pr  #6A7187
```

**4a — Coin activity codes.** For each activity, instead of a plain points value, print a coin-denominated card: an activity worth 192 Prutot prints as a **Dinar** card. The QR still encodes the normal `ACT:<id>` (the app already knows the value); the *card face* shows the coin.

**4b — Color-matched coin backgrounds (the visual you asked for).** Each coin QR card gets a **printed background tint/border in that coin's color** — a Dinar card has the `#B04432` treatment, a Sela card the `#A8772A` treatment, etc. Uses the exact colors already in the app's `COINS` array, so it matches the on-screen scheme automatically. A rebbi (or student) can tell coins apart at a glance on paper, same as on screen.

**4c — Per-student coin codes, automatically.** For each student, print their personal coin-award codes — one per denomination, or per activity mapped to its coin — color-matched. So a no-screen Shulchani rebbi can scan "give this student a Dinar" straight off a sheet, and it lands correctly.

**4d — Preset values.** Where an activity has a preset value that maps cleanly to a single coin denomination, the wizard auto-labels it as that coin. (Values that don't map to one coin just show their breakdown, as the app already does on screen.)

**Honest note:** 4a–4d are all *new layouts + styling* over existing code types (`ACT:` codes, the `COINS` color data). No new scanning behavior — the app already handles the values. The work is print-layout and the color-background rendering, not new scan logic.

---

## Component 5 — Scanner setup sheet (the hardware-code constraint applies)

A reference sheet for the physical scanner config a no-screen rebbi needs:
- Which settings to change and why: **storage/memory mode**, **upload all**, **clear all**, **timestamp prefix**, **COM/serial mode**, **volume**, **vibrate**.
- **Per the constraint above:** v1 **references/links** the Tera manual for the actual config barcodes (option a) rather than reproducing Tera's proprietary images. The sheet explains the workflow in plain language ("to scan all day and upload later: 1. scan Storage Mode from the manual, 2. …") and can include a QR linking to the manual PDF.
- If redistribution of the specific codes is later confirmed OK, upgrade to reproducing the handful of needed codes directly (option b).

---

## Component 6 — 📦 Full Paper Kit (the payoff for no-screen rebbeim)

One button: **"Print everything I need to run on paper."** Assembles, in order:
1. Scanner setup sheet (Component 5)
2. Class list (Component 3)
3. Seating chart (Component 3)
4. Student codes — labels + personal scoring pages, or the big double-sided cards (Component 1)
5. Activity codes + control codes (Component 2)
6. Point cards (Component 3)
7. **If Shulchani:** coin activity codes + per-student coin codes, color-matched (Component 4)

- A checklist before printing (tick what to include, since a full kit is a lot of paper).
- This is the concrete deliverable that makes "run Menchmark with no computer in the room" real: print the kit once, and the rebbi + a scanner have everything.

---

## What's reused vs. new

**Reused (already in app):** `makeQrCard()`, `renderLabels`, `renderPersonalPages`, `renderMenuLabels`, `renderPointsPrint`, `renderSeatChartPrint`, the `ACT:`/`CTRL:`/`ANSWER:` code system, the `COINS` array (names, values, colors), all existing Avery/tile sizing.

**New:**
- The wizard navigation/assembly shell
- Class-list printable (trivial)
- Big double-sided all-codes student card (new layout of existing codes)
- Coin-denominated activity/student cards with color-matched backgrounds (new layout + styling over existing codes + colors)
- Scanner setup reference sheet (references manual; no proprietary-code reproduction in v1)
- Full Paper Kit assembler + checklist

**Constraint flagged, not hidden:** hardware config codes can't be app-generated; v1 references the Tera manual rather than reproducing Tera's barcode images until redistribution is confirmed.

---

## Build order suggestion

1. **Wizard shell + re-home the 4 existing print pages** into it (no new print logic — just the navigation layer + dissolving the old Print tab group). Immediately tidier.
2. **Class list + big double-sided student card** (small new layouts).
3. **Shulchani coin cards + color backgrounds** (the distinctive feature; needs the color-render work).
4. **Scanner setup sheet** (reference version).
5. **Full Paper Kit assembler** (ties it all together — do last, since it depends on 1–4 existing).
