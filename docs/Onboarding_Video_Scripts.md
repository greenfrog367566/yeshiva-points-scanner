# Onboarding Video Scripts

Two short videos for beta rebbeim, requested in `docs/NOW.md` ("Onboarding video A
(setup from scratch), then C (using it in a class)"). Grounded in the app's real
UI (`setup.html`, `quick-start.html`, live `app.html`), not generic description.

Audience: a rebbi who is **not tech-savvy** and has never seen the app. Both
scripts are written to answer that person's real anxieties, not just to
demonstrate buttons — see the FAQ at the bottom.

---

## Video A — Setup From Scratch

**Goal:** get a rebbi from "never opened this" to "printed sheet in hand,
scanner connected" in one sitting. Wizard-first — `setup.html` is the real
onboarding path and is more accurate and more findable than a manual Run-tab
walkthrough.

| # | Screen / action | What to say | Notes |
|---|---|---|---|
| 1 | Cold open: printed class sheet already in the rebbi's hand, scanner on the desk | "This is where we're headed by the end of this video." | Payoff shown first, builds trust that it's achievable |
| 2 | `setup.html` entry screen | "Every new class starts here — one wizard, about five minutes." | |
| 3 | Step 1 — Class Basics | Name the class, grade | |
| 4 | Step 2 — Feature toggles | "Turn on only what you'll actually use — you can change this later in Settings." | Ties into Lean mode messaging once that ships (#121) |
| 5 | Step 3 — Add Students | Type or paste a roster | Show typing 3–4 names, not a full roster — keep it short |
| 6 | Step 4 — Learning Setup *(conditional)* | Only if Pesukim/Mishnayos was toggled on | Skip in the recording if not applicable |
| 7 | Step 5 — Hardware/Scanner | "You can do this later — the app works fine with just a keyboard scanner." | Lower the stakes; scanner is optional at this stage |
| 8 | Done screen | "That's it — you're in." | |
| 9 | Run → Activities | Add one activity, set its point value | Real terminology: this is where activities are defined |
| 10 | Run → Print class sheet | "One sheet — every kid's code, the seating chart, and your activity codes, all on one page." | Stronger demo beat than printing labels separately — combines seating + codes + activity codes |
| 11 | Close-up: the physical printed sheet | | Cut from screen to paper — this is the "real world" proof |
| 12 | Run → Settings → Connect scanner | Plug in scanner, click "Connect scanner," one-time permission grant | Only if using Serial/COM mode; keyboard mode needs nothing shown |
| 13 | Record tab: first scan | Land one scan, watch it appear in the strip | |
| 14 | Trust beat (VO over B-roll) | "Nothing you do here can lose a kid's history — Undo works everywhere, and there's a one-click backup in Run → Backup & Sheets." | See FAQ below — this is the single most requested reassurance |

**Runtime target:** 3–4 minutes.

---

## Video B — A Real Teaching Day

**Goal:** prove this fits inside real teaching, not that it replaces or
interrupts it. Structured as a cold open on an authentic classroom moment,
not a tab tour.

| # | Beat | What's shown | Why |
|---|---|---|---|
| 1 | Cold open | Rebbi teaching normally, laptop open but untouched, 15–20 sec | Establishes: this doesn't take over the room |
| 2 | Arm an activity | Scan bar's arm chip, set from the clipboard's activity code — no laptop touch | Shows the physical-code workflow, not just software |
| 3 | The scan | Kid does something good, rebbi glances down mid-sentence, scans, keeps teaching | The one shot that has to feel real — don't over-produce it |
| 4 | Mistake + Undo | Deliberate wrong scan, rebbi hits Undo without breaking stride | Directly answers "what if I mess up in front of the class" |
| 5 | Switch activities | Scan a different activity code off the clipboard mid-lesson | Reinforces: everything after setup can happen without opening the laptop |
| 6 | Bathroom pass | Kid signals, rebbi scans Bathroom Pass, kid heads out | Shows a second real use beyond points |
| 7 | Leaderboard payoff | Recognize → Leader Board up on the screen/projector, kids reacting | Emotional payoff, candid reactions |
| 8 | Raffle | Reward tab, wheel spin, kids watching | Closing beat — highest energy moment to end on |
| 9 | Trust beat (VO over B-roll) | "It's still working if the wifi drops — everything syncs when you're back online." | Second half of the trust pair from Video A |

**Runtime target:** 3–4 minutes.

---

## Shot List (for filming with a real bunk)

Short, individually-filmable clips (5–15 sec each), grouped by setup so you
don't have to keep re-arranging the room. ~18 clips, roughly 20–25 minutes of
raw footage for both videos combined.

**Consent note:** if any clip leaves your own device — posted publicly, sent
to other rebbeim — check it against your camp's photo/media policy before
sharing, especially clips where campers' faces or real names are visible on
screen.

### Physical setup (no laptop)
1. Wide establishing shot of the bunk, kids in seats
2. Close-up: printed class sheet — seating chart + QR codes + activity codes
3. Close-up: a QR code taped to a desk or index card
4. Handheld: clipboard/sheet in hand, walking between desks
5. Close-up: the scanner — dongle in the laptop, scanner in hand

### Screen recordings (laptop only)
6. `setup.html` wizard, start to finish (or the highlights: Class Basics → Done)
7. Run → Activities: adding one activity, typing a point value
8. Run → Print class sheet
9. Run → Settings → Connect scanner, showing "Connected"
10. Record tab: one clean scan landing in the strip

### Real teaching moment (camera + laptop both running)
11. Wide: normal teaching, laptop visible but untouched, 15–20 sec
12. Medium: a kid does something good, glance down, scan, keep talking — let it run long, don't cut away
13. Close-up on the screen the instant the scan lands (second take, cut in during editing)
14. Deliberate wrong scan + Undo, mid-sentence — the best trust-building shot, don't skip it
15. Switching activities by scanning an activity code off the clipboard — no laptop touch
16. Bathroom pass: kid signals, scan, kid heads out
17. Leaderboard on the board/projector, kids reacting — let it run, best b-roll
18. Raffle wheel spin, kids watching

---

## Not-Tech-Savvy Rebbi FAQ

Questions this rebbi would actually have, used to shape both scripts above —
answer these on screen, don't just demo features:

- What happens if I lose wifi mid-class? *(Video B trust beat)*
- What if I scan the wrong kid in front of everyone? *(Video B, Undo beat)*
- What if the Chromebook gets wiped or the browser data gets cleared? *(the
  Google Sheet backup is the real answer — not covered in either script yet,
  candidate for a third short video or an FAQ card)*
- Where do the codes actually live in the room — taped to desks? on a
  lanyard? *(Video A, physical print beat; full write-up still owed per
  `docs/NOW.md` — "Physical workflow write-up")*
- Does a public leaderboard embarrass the kid who's behind? *(not addressed
  in either script — a judgment call for the rebbi, worth one line of
  guidance somewhere in the docs, not the video)*

---

## Production notes

- **No AI-generated video (Gemini/Veo) for core content.** Considered and
  rejected — it can't accurately reproduce the app's real UI or an authentic
  classroom moment, and a fabricated "teacher" or fabricated UI undermines
  the trust-building purpose of both videos. Acceptable narrow use: packaging
  elements only — title card, thumbnail, background music.
- Screen-recording clips should use a clean class (no real student data) or
  be framed so names aren't legible, consistent with CLAUDE.md's "never
  commit real data" rule extended to anything published outside the repo.
