# Menchmark Promo — "Seder in the Classroom"
## A Pixar-style narrative video, produced in Google Flow (Veo 3.1)

**What this is:** the full production document for a ~90-second stylized 3D-animated
promo: an overwhelmed rebbi tries system after system to control a wild classroom,
they all fail, then Menchmark brings calm — no stress, happy kids. Written to be
executed shot-by-shot inside Google Flow on a Gemini AI Pro plan.

**Relationship to past attempts:** `docs/Onboarding_Video_Scripts.md` rejected AI
video *for tutorial content* because it can't reproduce the real UI — that decision
stands. This video is the carve-out that doc allowed: brand/packaging storytelling.
So one hard rule inherited from it: **never show a mocked-up "real" Menchmark UI.**
The app appears only as stylized abstractions — a glowing printed sheet, a friendly
scanner, a soft leaderboard glow. Copy rules come from `docs/Positioning.md`: the
audience is **rebbeim**, the end card uses the canonical self-description, and
nothing frames the app as a "classroom economy."

---

## 1. Why this workflow (read once before opening Flow)

Flow gives four continuity mechanisms. Most people use only Extend and get
melting faces by clip 5. This doc chains all four deliberately:

| Mechanism | What it locks | How we use it |
|---|---|---|
| **Ingredients to Video** | *Who/what* — character identity | The same 3 reference images of each character attached to **every** clip |
| **Frames to Video** | *Framing* — camera, light, set | Last frame of clip N saved → **start frame** of clip N+1 when the scene continues |
| **Extend** | More seconds of the *same* shot | At most once per shot; quality degrades after repeated chains |
| **Scenebuilder** | Assembly | Order, trim, preview, download |

Three disciplines that make or break it:

1. **Identity always comes from the original ingredient images**, never from a
   previous clip. If clip 7 inherits its face from clip 6, drift compounds.
2. **Restate the invariants in every prompt** (style block below). Anything not
   restated is free to drift.
3. **One action per clip.** 8 seconds holds one beat. Two beats = identity drift.

**Plan reality (AI Pro):** generations are credit-limited and route to Veo 3.1
Fast. Budget roughly 2–3 takes per shot × 13 shots — do the ingredient kit and
Act III first (the shots that must be right), Act I chaos is forgiving of flaws.
Upscale to 1080p only on final selects, not on takes.

---

## 2. Global style block — paste at the top of EVERY prompt

> Stylized 3D animated film in the style of a premium family animation studio:
> soft rounded character shapes, oversized expressive eyes, gentle subsurface-scattered
> skin, warm painterly global illumination, shallow depth of field, subtle film
> grain. Cinematic 16:9. No captions, no subtitles, no on-screen text, no watermark.

(The "no subtitles" line matters — Veo tends to burn captions into the frame
whenever a prompt contains quoted dialogue.)

Do **not** write the word "Pixar" in prompts — trademark terms are prompt-filter
bait and the style description above gets the same look reliably.

---

## 3. Character & set bible (the ingredient kit)

Build this **before generating any video.** Generate each image inside Flow
(Imagen) or with Gemini image generation, then save all of them as project
assets. Each character gets **three images — front, 3/4, profile — same
wardrobe, same neutral warm lighting.** Veo accepts up to 3 reference images
per subject; use all three every time.

### Rebbi Katz (protagonist)
> A warm 40-something rebbi: short dark beard flecked with grey, kind tired brown
> eyes behind round wire-rim glasses, black velvet kippah, white dress shirt with
> sleeves rolled to the forearm, charcoal vest, dark trousers. Slightly stocky,
> rounded friendly silhouette. Stylized 3D animation character, soft shapes,
> expressive oversized eyes, warm neutral studio lighting, full body, plain
> light-grey background.

Generate front / three-quarter / profile. **His whole arc lives in his shoulders
and eyebrows** — every prompt below directs those two things explicitly.

### The three kids (recurring, named so prompts can direct them)
Same 3-angle treatment each, boys' day-school uniform: white shirt, dark pants,
kippah, tzitzis strings visible at the waist.

- **"Sruli"** — small, springy, gap-toothed grin, freckles, kippah always
  slightly crooked. The class's chaos engine, later its most enthusiastic scanner
  customer.
- **"Dovid"** — tall for his age, glasses, neat, arms-crossed skeptic. His smile
  in Act III is the emotional proof the system works.
- **"Meir"** — round-faced, shy, sits in front, flinches at the noise in Act I.
  He gets the chesed beat (shot 9) — the heart of the video.

### The set (one location plate)
> A sunlit yeshiva day-school classroom, stylized 3D animation: warm wooden desks
> in rows, a large whiteboard, a bookshelf of oversized seforim with Hebrew
> lettering suggested but unreadable, aleph-beis chart on the wall, big windows
> with warm morning light, soft dust motes. Empty of people. Painterly warm
> palette: honey wood, cream walls, forest-green accents.

Generate one wide plate + one reverse angle (facing the windows/back of room).
Attach the matching plate as an ingredient whenever a shot introduces a **new**
camera setup in the room; when a shot continues a setup, the start frame carries
the set instead.

### The two hero props (each: one clean 3/4 product-style image)
- **The printed sheet:** a single warm-white printed page, grid of soft-cornered
  QR-code squares with a friendly rounded look, small seating chart, gentle green
  header bar. *Stylized suggestion of the real class sheet — not a legible
  reproduction, no readable names.*
- **The scanner:** a rounded, friendly white-and-green handheld scanner, soft
  pill shape, one gentle green light. Slightly toy-like proportions so it reads
  as approachable, not industrial.

---

## 4. The film — 13 shots, ~95 seconds

Notation per shot: **MECHANISM** → what to attach; then the prompt (always
prefixed by the global style block); then composition/continuity notes.

**Continuity legend:** `⛓ CHAIN` = save the last frame of the previous shot
("Save frame" on hover) and set it as this shot's **start frame**. `🆕 NEW SETUP`
= no start frame; attach the set plate + character ingredients fresh.

---

### ACT I — THE CHAOS (shots 1–3, ~24s)
*Visual grammar: handheld energy, tilted angles, cool harsh late-morning light,
cluttered frames. The camera is as overwhelmed as he is.*

**SHOT 1 — Bedlam.** 🆕 NEW SETUP — ingredients: set plate (wide), Rebbi Katz,
Sruli, Dovid, Meir.

> Wide establishing shot, slightly high angle, 24mm, subtle handheld shake. A
> yeshiva classroom in joyful anarchy: paper airplanes crossing the frame, Sruli
> standing on his chair conducting the noise like an orchestra, Dovid flicking a
> paper football, crumpled papers everywhere. At the whiteboard, Rebbi Katz —
> shoulders up around his ears, eyebrows lifted in overwhelmed disbelief — taps
> a dry-erase marker for attention that never comes. Cool, slightly harsh
> late-morning light. Audio: dense happy classroom roar, chair scrapes, one
> paper airplane whoosh past the lens.

*Composition: Rebbi small in frame, lower-left third, dwarfed by the room —
the framing itself says "outnumbered." Leave headroom cluttered with a passing
airplane.*

**SHOT 2 — His face.** ⛓ CHAIN from shot 1 + Rebbi ingredients.

> Cut into a medium close-up, 50mm, eye level, shallow focus melting the chaos
> into soft moving bokeh behind him. Rebbi Katz exhales slowly, removes his
> glasses, and pinches the bridge of his nose — a long, weary, comic-timing
> beat. One paper airplane bounces gently off his shoulder; his eyes open and
> track it to the floor without moving his head. Audio: the roar now muffled
> and distant, one soft comedic *boop* as the airplane lands.

*Composition: dead-center symmetry on his face — stillness against motion.
This is the character poster shot; retake until the face matches the
ingredient exactly.*

**SHOT 3 — Meir flinches, title beat.** 🆕 NEW SETUP — set plate (reverse
angle), Meir, Sruli.

> Low angle from Meir's front-row desk, 35mm. Shy round-faced Meir hunches
> over an open sefer, hands over his ears, as Sruli slides past behind him on a
> rolling chair, arms spread like wings. Slow push-in on Meir's wince. Audio:
> the roar peaks, then everything dips low and quiet on the push-in — leaving
> one small sad piano note.

*This is the stakes shot: the chaos has a cost, and it's the quiet kid. The
audio dip earns the cut to Act II.*

---

### ACT II — THE SYSTEMS THAT FAIL (shots 4–7, ~32s)
*Visual grammar: montage rhythm. Each attempt: hopeful setup → deadpan failure
inside one 8-second clip. Light warms slightly each time — he keeps trying.*

**SHOT 4 — The sticker chart.** 🆕 NEW SETUP — set plate, Rebbi Katz.

> Medium shot, 35mm, static locked-off tripod frame for deadpan comedy. Rebbi
> Katz, tongue slightly out in concentration, proudly presses a huge rainbow
> sticker chart onto the wall and smooths it flat with both hands. He steps
> back, hands on hips, one satisfied nod — and the chart peels off the wall
> behind him with a slow papery ripple and slumps to the floor. His shoulders
> drop. Audio: hopeful little melody that ends in a sad slide-whistle; the
> gentle flutter of falling paper.

*Composition: keep him and the chart in the same static frame the whole time —
the comedy is that the camera refuses to help him.*

**SHOT 5 — The candy bribe.** 🆕 NEW SETUP — set plate, Rebbi Katz, Sruli,
Dovid.

> Medium-wide, 28mm, slight low angle. Rebbi Katz holds up a glass jar of
> wrapped candies with a hopeful salesman smile — and is instantly engulfed by
> a wave of leaping kids, Sruli cresting the top of the pile. The jar wobbles
> above the scrum in his outstretched hand like a lighthouse in a storm. Whip
> of handheld shake on impact. Audio: one second of silence, then an eruption
> of delighted shrieking; the musical sting stumbles over itself.

*One action: hold jar → engulfed. Do not ask for the jar to fall too — that's
a second beat and Veo will smear it.*

**SHOT 6 — The name on the board.** 🆕 NEW SETUP — set plate, Rebbi Katz,
Dovid.

> Over-the-shoulder from behind Rebbi Katz, 40mm, focus racking from the
> whiteboard to the class beyond. He writes an emphatic warning line on the
> board — the marker squeaks dry halfway through the underline. He shakes it,
> tries again: nothing. Beyond the dead marker, soft-focus Dovid watches with
> polite unimpressed pity, chin on fist. Rebbi Katz's underline trails off.
> Audio: squeak, squeak, the hollow shake-rattle of a dead marker, one kid's
> stifled giggle.

*Any board writing must be an unreadable scribble — prompt it as "an emphatic
warning line," never as specific words; Veo's text rendering will betray you.*

**SHOT 7 — Rock bottom (the hinge).** 🆕 NEW SETUP — Rebbi Katz only, no set
plate.

> Slow push-in, 50mm, from medium to close. End of day: Rebbi Katz alone at
> his desk in the empty classroom, golden-hour light through the windows, the
> fallen sticker chart draped over a chair behind him. He sits amid the
> wreckage, chin in both hands — then his eyes drift to his laptop, and
> narrow with one last ember of resolve. Audio: distant hallway sounds fading,
> a single warm piano chord beginning underneath.

*The lighting turn happens HERE — cool film to warm film. His eyebrow is the
whole shot: defeat → resolve in one move. Retake until that read is clean.*

---

### ACT III — MENCHMARK (shots 8–12, ~40s)
*Visual grammar: everything Act I wasn't. Locked or gliding camera, warm honey
light, clean uncluttered frames, gentle symmetry. Calm is shot as calm.*

**SHOT 8 — The sheet.** 🆕 NEW SETUP — Rebbi Katz, printed-sheet prop,
scanner prop.

> Next morning. Top-down overhead shot, 50mm, gliding slowly across his desk in
> warm window light: hands lift a single freshly printed page — a friendly grid
> of soft QR codes with a gentle green header — and set a small rounded white-
> and-green handheld scanner beside it. The scanner's light blinks on, soft
> green. Camera tilts up to Rebbi Katz's face: calm, curious, one eyebrow up.
> Audio: paper's crisp whisper, one soft optimistic chime, the warm piano
> theme finding its melody.

*Hero-prop shot: this framing is the thumbnail. The page must read as ONE
page — the whole system in his hand is the promise. No legible text on it.*

**SHOT 9 — The first scan (the heart).** 🆕 NEW SETUP — set plate, Rebbi
Katz, Meir, scanner prop.

> Medium two-shot, 40mm, waist height, slow 20-degree arc around the moment.
> Shy Meir kneels to gather another boy's dropped seforim and stacks them
> gently on the desk. Rebbi Katz, mid-lesson, glances over, smiles, and — 
> without breaking stride — points the little scanner: one soft green pulse of
> light and one cheerful two-note chime. Meir looks up, startled, and breaks
> into a huge slow smile. Audio: calm classroom murmur, the chime, the piano
> swelling one step.

*The Video B trust beat, animated: he never stops teaching. The scan is a
glance, not an event. Meir's smile is the single most important frame of the
film — spend takes here.*

**SHOT 10 — Sruli converted.** ⛓ CHAIN from shot 9's last frame + Sruli,
Rebbi Katz, scanner ingredients.

> Continuing in the same warm light and camera height, the arc drifts to
> Sruli's desk: the former chaos-conductor sits bolt upright, hand raised so
> eagerly his whole body stretches, kippah still crooked, grin enormous. Rebbi
> Katz nods to him; another gentle green pulse and chime. Sruli pumps a quiet
> fist. Audio: the murmur stays CALM — the chime lands inside the quiet, and
> two kids softly chuckle.

*The redemption gag: same kid, same energy, new direction. Keep the sound
small — the joke of Act III is that excitement no longer means noise.*

**SHOT 11 — The glow.** 🆕 NEW SETUP — set plate (reverse), Rebbi Katz, Sruli,
Dovid, Meir.

> Wide from the back of the room, 24mm, slow rising crane. The class faces a
> soft-glowing wall screen showing an abstract, cheerful leaderboard — warm
> bars of green and gold gently rising, no readable names or numbers. Kids
> lean toward it; skeptical Dovid finally uncrosses his arms and smiles.
> Rebbi Katz stands at the side, arms folded softly, shoulders fully down
> for the first time. Audio: a warm collective "ooooh," the theme opening up.

*Mirror of shot 1: same wide room, opposite grammar — rising crane instead of
handheld shake, order instead of clutter. Dovid uncrossing his arms is the
skeptic's verdict. The leaderboard is pure light and color — the moment it
looks like software, cut it.*

**SHOT 12 — Peace.** ⛓ CHAIN from shot 11 + Rebbi Katz ingredients. Extend
once if the settle needs more air.

> The crane completes its rise and settles into a perfectly symmetrical wide:
> rows of kids learning in golden light, quiet and content, dust motes
> drifting. Rebbi Katz walks the center aisle unhurried, hands clasped behind
> his back, and pauses — a small private smile, the smile of a man whose
> classroom finally matches the picture he always had of it. Audio: the room
> at a gentle hum, the theme resolving to warmth.

*Hold the symmetry. Nobody looks at camera. Let it breathe — this is the
"no stress" of the brief, shot as stillness.*

**SHOT 13 — End card. NOT generated in Flow.**
Veo renders text unreliably — build this card in an editor over shot 12's
final frame (or the brand mark from `branding/`):

> **Menchmark**
> A classroom assistant for Yeshiva and Jewish Day School rebbeim.
> **menchmark.app** — free
>
> Audio: final soft two-note scanner chime as the logo lands.

Copy is verbatim from `docs/Positioning.md` (canonical self-description; the
plain word "free" is fine — "free forever" licensing language is not).

---

## 5. Execution order in Flow

1. **Build the ingredient kit** (section 3) — all images into project assets
   first. Character sheets before any video; regenerate until Rebbi Katz's
   3 angles are unmistakably the same person.
2. **Generate Act III first** (shots 8–12): the emotional payoff must be right,
   and it's cheapest while your credit balance is full. Then Act II, then Act I
   (chaos hides flaws; save it for last).
3. **Per shot:** paste style block → attach listed ingredients → set start
   frame if ⛓ CHAIN → prompt → generate. Judge a take on: (a) face matches
   ingredients, (b) the ONE action landed, (c) composition note satisfied.
   Two failures on the same prompt → simplify the action, don't add words.
4. **Chaining:** pause the selected take on its final frame → hover → **Save
   frame** → use as the next shot's start frame. Always alongside the original
   ingredients — the frame carries set and light, the ingredients carry
   identity.
5. **Extend** only where marked (shot 12), only once.
6. **Scenebuilder:** order 1→12, trim each clip's dead air at head and tail
   (Veo front-loads a beat of nothing), preview the Act II montage rhythm —
   shots 4–6 should feel metronomic.
7. **Upscale final selects to 1080p/4K**, download, add shot 13's end card and
   any music sweetening in an editor.

## 6. Guardrails

- **No real UI, no real names, no legible Hebrew text** anywhere in generated
  frames — stylized suggestion only. (Inherited from
  `docs/Onboarding_Video_Scripts.md` and CLAUDE.md rule 6.)
- **"Rebbi/rebbeim," never "teacher,"** in any on-screen or accompanying copy
  (`docs/Positioning.md`).
- The video sells **calm and mentchlichkeit**, not prizes — the failed-candy
  beat exists precisely to distinguish Menchmark from bribery. Don't add a
  prize/reward shot.
- Before publishing anywhere, this is Ben's call — the doc's PR ships the
  plan, not the video.
