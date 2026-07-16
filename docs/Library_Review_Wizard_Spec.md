# Menchmark — Shared Text Library & Review Wizard

*Implementation spec. Grounded in the app's real data structures (verified against app.html), not invented ones.*

---

## The problem this solves

The app can already import phrase-by-phrase text sets (Pesukim/Mishnayos) from CSV. The goal is a **shared library** the app pulls pre-built texts from, so rebbeim don't generate anything at runtime (no AI, no Sefaria, no proxy — the thing rebbeim don't want). But pre-built texts vary in trustworthiness: some are fully human-reviewed, some are auto-generated and unchecked. Shipping unchecked translations silently is the real risk — a wrong translation in front of kids is worse than no translation.

So the system has three honest jobs:
1. **Tell the rebbi the truth** about whether a text has been reviewed.
2. **Let the rebbi easily review and fix it** — a per-pasuk wizard, not a wall of rows.
3. **Let good versions flow back** so the library improves over time, without letting one person's edits silently become everyone's authority.

---

## How the app actually stores text (verified)

The app keeps text sets in `data.textSets` — an array of set objects. Each set:

```js
{
  id: "set...",              // unique id
  label: "Vayelech (31:1-30)",
  ref: "Devarim 31:1-30",
  kind: "pasuk",             // or "mishna"
  from: 1, to: 30,           // pasuk range
  phrases: {                 // keyed by pasuk number → array of [hebrew, english] pairs
    1: [["וַיֵּלֶךְ מֹשֶׁה","And Moshe went"], ["וַיְדַבֵּר","and he spoke"], ...],
    2: [...],
    ...
  },
  pointed: {                 // keyed by pasuk number → full pasuk text with nikud
    1: "וַיֵּלֶךְ מֹשֶׁה וַיְדַבֵּר...",
    ...
  },
  orig: {...},               // a deep copy of phrases as originally imported (ALREADY EXISTS)
  done: {}, best: {}         // per-student progress; not relevant to the wizard
}
```

Two things that matter for this spec:
- **`orig` already exists** — `addImportedSet()` already stores `orig: JSON.parse(JSON.stringify(parsed.phrases))`. This is the natural anchor for "what changed" — we can diff current `phrases` against `orig` to know which pesukim a rebbi has actually touched. No new plumbing needed.
- **`phrases` is keyed by pasuk number**, each value an ordered array of `[hebrew, english]` pairs. The wizard edits the `english` half of these pairs. Hebrew is never touched (it comes from the source and shouldn't change).

---

## Part 1 — Library data format & the `status` flag

### Library files (static, on GitHub Pages)

```
library/
├── index.json                       # the manifest / catalog
└── chumash/
    └── devarim/
        └── vayelech.json            # one file per text
```

**`index.json`** — the catalog the app reads first:
```json
{
  "version": 1,
  "updated": "2026-07-15",
  "chumash": [
    { "sefer": "Devarim", "parshiyos": [
      { "id": "chumash-devarim-vayelech", "parsha": "Vayelech",
        "ref": "Devarim 31:1-30", "label": "Vayelech (31:1-30)",
        "pesukim": 30, "phrases": 267,
        "path": "chumash/devarim/vayelech.json",
        "status": "partial" }
    ]}
  ],
  "mishnayos": []
}
```

**Status vocabulary (three honest states):**
- `draft` — auto-generated, not checked by anyone. Show a clear warning.
- `partial` — some human review, not complete (e.g. Vayelech: half taught by a rebbi, half auto-gen). Show a softer note.
- `reviewed` — fully checked by someone who knows the material. No warning.

**Each text file** (e.g. `vayelech.json`) carries its own status too, so it's self-describing even if fetched directly:
```json
{
  "id": "chumash-devarim-vayelech",
  "kind": "pasuk", "sefer": "Devarim", "parsha": "Vayelech",
  "ref": "Devarim 31:1-30", "label": "Vayelech (31:1-30)",
  "status": "partial",
  "reviewedBy": null,                    // set when it graduates to reviewed
  "pesukim": [
    { "num": 1,
      "full": "וַיֵּלֶךְ מֹשֶׁה...",
      "phrases": [
        { "hebrew": "וַיֵּלֶךְ מֹשֶׁה", "english": "And Moshe went" },
        ...
      ]
    },
    ...
  ]
}
```

**Format note (decision needed):** the library file above is JSON with `{hebrew, english}` objects. The app's internal `phrases` uses `[hebrew, english]` arrays. A tiny loader converts between them on import (trivial — map each `{hebrew,english}` to `[hebrew,english]`). Alternatively the library could store the app's raw CSV and skip conversion entirely. JSON is cleaner and self-describing (carries status/metadata); CSV is zero-conversion. **Recommend JSON** — the conversion is a two-line map and the metadata is worth it.

---

## Part 2 — The "not reviewed" flag in the app

When a rebbi loads a library text whose `status` is not `reviewed`, show a banner **before** they teach from it — honest, not alarming:

**For `draft`:**
```
⚠ This text hasn't been checked yet.
Some translations were generated automatically. Please
review it before teaching from it in class.
[ Review it now ]   [ Use as-is ]
```

**For `partial`:**
```
ⓘ This text is partly checked.
Some of it has been reviewed, some was generated
automatically. A quick review is recommended.
[ Review it now ]   [ Use as-is ]
```

- Appears in the Learn → Text/Teach view when a non-reviewed set is active.
- Also a small persistent badge next to the text's name in the set dropdown/list (e.g. a small "draft" / "partial" chip), so it's visible even after the banner is dismissed.
- **"Use as-is"** dismisses the banner for this session but the badge stays. Respects that a rebbi may want it now and eyeball it live.
- Once a rebbi completes review (Part 3), the local copy's status flips to `reviewed` (locally) and both banner and badge clear.

**Where status lives locally:** add a `status` field to the textSet object (defaults to whatever the library file said, or `reviewed` for a rebbi's own hand-typed imports since those are self-authored). Add a `reviewedPesukim: {}` map (pasuk num → true) to track per-pasuk confirmation.

---

## Part 3 — The Review Wizard (the core feature)

A focused, one-pasuk-at-a-time editor. Reuses the app's existing phrase-edit interaction (the Teach tab already has editable phrase lines — same component, wrapped in a wizard shell).

### Entry
- "Review it now" on the banner, **or** a "Review / edit this text" button on the Text/Teach view for any active set.
- Opens a focused mode (like Chavrusa Mode / Batch Import — a dedicated screen you enter and exit), not a modal buried in the tab.

### Layout

```
┌────────────────────────────────────────────────┐
│  Reviewing: Vayelech (31:1-30)          [✕ Exit] │
│  ▓▓▓▓▓░░░░░░░░░░░░░░░░  Pasuk 5 of 30 · 4 done   │
├────────────────────────────────────────────────┤
│  Full pasuk (for context):                       │
│  וּנְתָנָם יְהֹוָה לִפְנֵיכֶם וַעֲשִׂיתֶם לָהֶם...      │
├────────────────────────────────────────────────┤
│  Check each phrase — edit the English if needed: │
│                                                  │
│  וּנְתָנָם יְהֹוָה    [ And Hashem will give them  ] │
│  לִפְנֵיכֶם          [ before you                 ] │
│  וַעֲשִׂיתֶם לָהֶם     [ and you shall do to them    ] │
│  כְּכׇל־הַמִּצְוָה      [ like all the command        ] │
│  אֲשֶׁר             [ that                        ] │
│  צִוִּיתִי אֶתְכֶם     [ I commanded you             ] │
│                                                  │
├────────────────────────────────────────────────┤
│  [ ◄ Prev ]   [ ✓ Confirm pasuk & next ]  [ Skip ►] │
└────────────────────────────────────────────────┘
```

### Behavior
- **English fields are editable inline.** Hebrew is read-only (source text; never edited).
- **Edits save immediately** to the active set's `phrases[num]` (and mark that pasuk touched via the `orig` diff). No separate save step — the rebbi's working copy is always current.
- **"Confirm pasuk & next"** marks `reviewedPesukim[num] = true`, advances to the next pasuk. This is the explicit "I've looked at this and it's right" signal — distinct from merely editing.
- **"Skip"** advances without confirming — for a pasuk the rebbi wants to come back to. Progress bar counts only confirmed pesukim.
- **"Prev"** goes back; already-confirmed pesukim show a ✓ so the rebbi sees what's done.
- **Progress bar + "X of N · Y done"** always visible — the rebbi always knows how far they've come and how far's left.
- **Resumable** — `reviewedPesukim` persists, so a rebbi can review 10 pesukim today, close the app, and pick up at pasuk 11 tomorrow. On re-entry, wizard opens at the first unconfirmed pasuk.
- **Completion** — when every pasuk in `from..to` is confirmed:
  - Local set `status` → `reviewed`; banner and badge clear.
  - A gentle completion state: *"You've reviewed all 30 pesukim of Vayelech. Nice."* with two actions: **[ Done ]** and (if sharing is enabled, Part 5) **[ Share your reviewed version ]**.

### What it reuses
- The Teach tab's existing editable phrase-line rendering (`teachLines`, the `✎`-per-line edit affordance) — the wizard is that same editing capability, wrapped in a stepper shell with confirm/progress. Not a new editor.
- The `orig` deep-copy already stored on every set → used to show "edited" vs "unchanged" per phrase if we want a subtle indicator (optional polish, not required for v1).

---

## Part 4 — "Reviewed version available" callback helper

The payoff of the community loop: when a text a rebbi is using gets upgraded to `reviewed` in the library, offer them the better version.

- On app load (or a manual "check for updates" in Learn → Text), fetch `index.json` and compare:
  - For each of the rebbi's textSets that originated from the library (track origin via a stored `libraryId` field on the set), check if the library now lists that `id` with a **higher** status than the local copy (`draft`→`partial`→`reviewed`).
- If an upgrade exists, a gentle, dismissible prompt (never forced):
  ```
  ✓ A checked version of Vayelech is now available.
  You're using an earlier version. Load the checked one?
  (Your own edits will be replaced.)
  [ Load checked version ]   [ Keep mine ]
  ```
- **Never auto-replaces.** A rebbi who edited their copy might prefer their own wording. Their choice, always.
- Respects offline: if `index.json` can't be fetched, silently skip — no error, the local copy keeps working.

**Storage:** add `libraryId` (the library's `id` string) and `libraryStatus` (the status at time of import) to any textSet imported from the library. A rebbi's hand-typed imports have no `libraryId` and are never touched by this check.

---

## Part 5 — Sharing back (the honest, gated version)

**This is the part that needs a real decision from you, not just code.** The mechanics of *submitting* are easy; the commitment of *maintaining* a contribution pipeline is the real cost.

### The trust problem
If any shared version flows straight into the library everyone pulls from, you've reopened the exact "unreviewed content in front of kids" risk — now with one person's mistake able to propagate to everyone. So sharing must be **submit, not publish**: a rebbi's version becomes a *candidate*, and only you (or a trusted reviewer) promote a candidate to `reviewed` in the actual library.

### The serverless-friendly mechanism (recommended v1)
No backend needed — fits the app's architecture:
- **"Share your reviewed version"** exports the set as a library-format JSON file **and** opens a pre-filled GitHub issue (or a `mailto:` with the JSON attached/pasted) to your repo, titled e.g. *"Text submission: Vayelech (reviewed by [name])."*
- You receive it, review it yourself, and if it's good, commit it to the `library/` folder and bump its `status` to `reviewed` in `index.json`.
- Every other rebbi then gets it offered via the Part 4 callback. The loop closes — but the review gate stays intact, staffed by you.

### What this asks of you (be honest with yourself)
- You become the **editor/maintainer** of the shared library. Submissions arrive; you vet and commit them. For a small circle (you + Rabbi Goldwasser + a few) that's light. If it grows, it's a real ongoing job.
- **Alternative for now:** keep sharing *informal* — rebbeim who make good versions email them to you, you add them when you have time. No in-app "share" button yet. Less magical, zero commitment, and you can add the formal button later once you know you want the role.

### Recommended build order
1. **Parts 1–4 first** (library format + status flag + review wizard + reviewed-version callback). All client-side, no infrastructure, no maintainer commitment. This alone makes the library genuinely useful and honest.
2. **Part 5 (share-back) later**, once you've decided how much of a gatekeeper you want to be. Start with the pre-filled-issue/email mechanism if you do — never auto-publish.

---

## Data-model changes summary (what to add)

Per textSet object, add:
- `status` — `"draft"` / `"partial"` / `"reviewed"` (defaults from library file; `"reviewed"` for self-typed imports)
- `reviewedPesukim` — `{}` map of pasuk num → true (drives wizard progress + completion)
- `libraryId` — the library `id` string, only for sets imported from the library (drives the Part 4 upgrade check)
- `libraryStatus` — the status at import time (for upgrade comparison)

All four are additive, migration-safe (default them in the existing migrate step: `status` → `"reviewed"` for existing user sets so nobody's current text suddenly shows a warning; `reviewedPesukim` → `{}`; `libraryId`/`libraryStatus` → absent). The existing `orig` field is reused as-is.

No changes to how `phrases`/`pointed` are structured, so Teach, Chart(→Gradebook), Matching, and Quiz all keep working untouched.
