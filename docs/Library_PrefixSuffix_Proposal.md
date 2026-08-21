# Library — Prefix/Suffix (Dikduk) Format Proposal

**Status: PROPOSED, 2026-08-21 — scope only, nothing built.** This document
and a copy of the source sample are the entire deliverable of this pass, per
Ben's explicit ask ("scope and docs only — make a copy in repo for future
reference"). No `library/` files were added, no `app.html` code was touched,
and none of the choices below are decided. This is a PROPOSE-FIRST item under
CLAUDE.md's Agentic Work Mode — it's new scope the existing specs don't cover.

---

## Where this came from

A rebbi built a full word/phrase-by-word breakdown for Parshiyos Noach, Lech
Lecha, and Vayeira, styled after Torah Umesorah's linear-translation PDFs,
using Claude's Excel add-in (the file carries a `claude.fileId` webextension
binding, saved via `openpyxl`). The file's own `docProps/core.xml` metadata
happens to carry the rebbi's name — not repeated here; that's Ben's call to
share, see open question 3.

The source file is now saved in this repo for future reference:

```
docs/library-sources/Noach_through_Vayeira_Prefixes_and_Suffixes.xlsx
```

Copied from `Downloads\Noach through Vayeira with Prefixes and Suffixes.xlsx`
and verified byte-identical (SHA-256 matches, 212,412 bytes both). Nothing
has been extracted, converted, or reviewed; it's parked here so it isn't only
a personal Downloads file.

---

## What's actually in the file

Three sheets, one per parsha (Hebrew sheet names: `פרשת נח`, `פרשת לך לך`,
`פרשת וירא`), each a table with these columns:

| Column | Example | Meaning |
|---|---|---|
| `Section_Title` | `Noach the Tzaddik` | A thematic label spanning several pesukim (long sections continue as `"…, cont."` on later rows) |
| `Section_Citation` | `ו: ט-יב` | The perek:pasuk range that section covers |
| `Perek` | `ו` | Hebrew-letter perek, repeated on every row |
| `Pasuk` | `ט` | Hebrew-letter pasuk number, populated only on the first row of a new pasuk |
| `Hebrew` | `בְּדֹרֹתָיו` | The word or short phrase as it appears in the pasuk |
| `Prefix` | `ב` | Prefix letter(s) split out, comma-separated when a row's Hebrew spans multiple words and several carry prefixes (e.g. `ו, ת, ה` for `וַתִּשָּׁחֵת הָאָרֶץ` — the `ו`/`ת` sit on the verb, the `ה` on `הָאָרֶץ`) |
| `Shoresh` | `שחת` | The three/four-letter root, when the row's word has one worth isolating |
| `Suffix` | `ָיו` | Suffix letters split out, same comma-separated convention |
| `English` | `in his generations.` | Gloss for that row's Hebrew |

**Confirmed full coverage, not a sample of sections.** Checked start and end
citations against each sheet: Noach runs `ו: ט-יב` → `יא: כז-לב`
(Bereishis 6:9 through 11:32, the parsha's actual last pasuk); Lech Lecha
runs through `יז: כג-כז` (17:27, its last pasuk); Vayeira runs through
`כב: כ-כד` (22:24, its last pasuk). All three parshiyos are covered
beginning to end, not selected highlights.

**Row granularity is a mix, not strictly one-word-per-row.** Counting rows
whose `Hebrew` value contains more than one word: Noach 353/1173 (30%),
Lech Lecha 381/1022 (37%), Vayeira 573/1115 (51%) — roughly **40% of the
~3,310 data rows are short multi-word phrases**, the rest single words. That
matters for the format decision below: this is closer to the existing
library's phrase granularity (`vayelech.json`'s `{hebrew, english}` pairs
already mix single words and short phrases the same way) than a strict
word-by-word parsing table.

---

## How this differs from the library format that exists today

`docs/Library_Review_Wizard_Spec.md` defines the only format the app's
library actually targets right now (and even that isn't wired up yet —
`library/index.json` and `chumash/devarim/vayelech.json` are **data-only and
orphaned**, per CLAUDE.md's file table and Phase 6a's status: nothing in
`app.html` reads `library/` at all, #187). That format's `phrases[]` already
mixes single words and short clauses per pasuk, gloss alongside Hebrew.

What this sample adds on top, genuinely new to the existing format:
- **Grammar-tagged** — prefix, shoresh, and suffix pulled apart as their own
  fields, not just an English gloss next to Hebrew. This is a dikduk
  (grammar) layer, not a different granularity.
- **Thematically sectioned across pesukim** — `Section_Title` groups several
  pesukim under one heading (e.g. "The תֵּבָה" spans ו:יג-יז), a grouping
  concept the current format has no field for at all.

---

## If this becomes library content — two shapes to choose between (not decided)

**Option A — enrich the existing phrase object (the natural fit, given the
granularity overlap above).** Add optional `prefix`/`shoresh`/`suffix`
fields to the `{hebrew, english}` phrase pairs already in the spec:
```json
{ "hebrew": "בְּדֹרֹתָיו", "english": "in his generations.",
  "prefix": ["ב"], "suffix": ["ָיו"] }
```
Additive and backward-compatible — existing rendering (Teach tab, Quiz,
Matching) would simply ignore the new fields until a UI wants to show them.
`Section_Title`/`Section_Citation` would need one more additive field —
an optional `section` label on each pasuk, or a small parallel
`sections: [{title, from, to}]` array — which is a small addition, not a
reason to reach for a second content shape.

**Option B — a distinct content kind.** A new `kind` (e.g. `"pasuk-dikduk"`)
alongside today's `"pasuk"`/`"mishna"`, with its own reader and a dedicated
parsing-drill view (distinct from the Teach tab's phrase-line rendering).
Worth it only if the eventual UI goal is a standalone grammar-drill mode
rather than prefix/suffix showing up as an optional layer on ordinary
Pesukim study — that's a product decision, not just a data-shape one.

**Recommendation, non-binding:** Option A first. It's additive to a format
Phase 6a will need to read regardless, costs nothing for rebbeim who never
touch it, and doesn't foreclose a dedicated grammar-drill view later if that
turns out to be wanted — that view could still be built reading the same
enriched phrase objects.

---

## Open questions for Ben

1. **Content shape** — Option A (recommended above), Option B, or something
   else? Also decides whether prefix/suffix becomes an enrichment of the
   *existing* Pesukim feature or a genuinely new study mode with its own
   screen.
2. **Torah Umesorah's material** — this spreadsheet is one rebbi's own
   transcription/breakdown *styled after* Torah Umesorah's linear-translation
   PDFs, not a reproduction of their printed pages. That's a materially
   different situation from Tera's scanner barcodes (CLAUDE.md rule 7, where
   written permission was needed before reproducing their exact printed
   graphics) — but it's worth a deliberate "yes, this is fine to build on"
   before any of this ships as library content, rather than assuming it by
   default.
3. **Attribution** — the file's own metadata carries the rebbi's name. Worth
   asking him directly whether he wants credit if this becomes shared
   library content, rather than assuming either way.
4. **Divine Name convention** — this file writes `אֱלֹקִים` and `ה'`
   (the common substitute-spelling convention for non-sacred working
   documents) where `vayelech.json` writes the Name in full,
   `יְהֹוָה`/`אֱלֹהֶיךָ` (e.g. `וַיֹּאמֶר ה'` here vs. `וַיהֹוָה אָמַר אֵלַי`
   there). If this content ships into the library as-is, the app would be
   displaying and printing a different Name convention depending on which
   text a rebbi loaded — a kavod question for Ben or someone who knows the
   material to weigh in on, not a formatting detail to normalize silently
   either direction.
5. **Other editorial conventions a conversion would inherit as-is unless
   told otherwise** — bracketed implied words (`Noach [was]`), parentheticals
   (`(with) robbery.`), and quotation marks that open on one row and close
   several rows later. None of these break anything mechanically; flagging
   so a reviewer isn't surprised by them mid-import.
6. **Review gate** — same three-state `draft`/`partial`/`reviewed`
   vocabulary the library already uses would apply; this content would start
   at `draft`. Per CLAUDE.md, the agent may draft/convert it but must never
   set a text's status to `reviewed` itself — only someone who knows the
   material can promote it, same as Vayelech today.
7. **Sequencing** — this depends on Phase 6a (the library loader) landing
   first; there's no reader for *any* library format yet, prefix/suffix or
   otherwise. Does this become part of 6a's scope, or a follow-on once 6a and
   the Review Wizard (6b) exist?

---

## What this pass did and didn't do

- ✅ Saved a byte-identical copy of the source file at
  `docs/library-sources/Noach_through_Vayeira_Prefixes_and_Suffixes.xlsx`.
- ✅ Documented the format, verified full-parsha coverage, and measured the
  actual word/phrase mix above.
- ✅ Raised the open questions a real implementation would need answered,
  including one (Divine Name convention) found while checking the data, not
  anticipated going in.
- ❌ No `library/` files added or changed.
- ❌ No `app.html` changes — no reader, no UI, no data-model changes.
- ❌ No format decided, no content marked `reviewed`, no rebbi's name
  published without his say-so.
