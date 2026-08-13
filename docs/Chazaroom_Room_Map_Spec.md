# Chazaroom Room Map — spec (PROPOSAL, not built)

**Status:** proposal, nothing implemented. Written 2026-08-11.
**Decided so far:** the seating chart comes in by **export/paste**, not by reading
Menchmark's storage (see *Import*, below). Everything else in here is open.

The one-line idea: give Chazaroom the seating chart the rebbi already made in
Menchmark, plus four printed corner cards taped to the room, and the camera can
**aim at a named boy's seat** instead of sweeping the room hoping to catch him.

---

## 1. Why — what today's hunt structurally cannot do

Chazaroom already learns where boys are, with no setup at all: every time a card
decodes, it records the gimbal's pan plus the card's offset in frame, so the
lobby scan builds a bearing per boy for free (`seatMap`, `huntMissing()`). After
a sweep it drives to each missing boy's bearing and waits for his card.

That covers the common case well and should not be replaced. But four gaps are
structural, not tuning:

1. **Cold start.** A boy who has never been decoded has no bearing, so the hunt
   skips him — exactly the boy most worth finding. The hunt can only look for
   boys it has already found.
2. **Tilt is never learned.** `huntMissing()` sets `pan` and `zoom` only, and
   `sweepStart()` pins `tilt: 0`. A boy in the front row close to the camera may
   need a real downward tilt and nothing ever discovers it.
3. **Zoom is one fixed number.** `HUNT_ZOOM = 180` for everyone, whether the boy
   is four feet away or twenty.
4. **A guessed constant underpins all of it.** `HFOV_BASE = 67` is an unverified
   guess at the lens. Every bearing is computed through it.

A room map fixes 1–3 outright, and **makes 4 stop mattering**: corner anchors
*measure* the chart→gimbal mapping, so the FOV guess drops out of the maths
entirely. That is the strongest argument for building this.

---

## 2. It is calibration, not SLAM — say so plainly

The tempting mental model is a Roomba mapping a room. That model is wrong and
would send the build in a bad direction.

A Roomba maps because it **moves through** space and senses distance. The gimbal
is fixed in one place and can measure exactly one thing: **angles**. It has no
depth sensor. It cannot build a floor plan and should not try.

It does not need one. Four known points are enough to map the seating grid onto
angle space, which is the only thing aiming requires. That reduces a hard
robotics problem to a ~20-second calibration pass.

---

## 3. What Menchmark actually stores (verified)

`seatLayout()` — `app.html` ~line 10983 — returns:

```js
{ rows: 4, cols: 6, seats: [studentId | null, ...] }   // row-major, rows*cols long
```

The rebbi drags boys into seats to match the real room, so the grid is already a
rough floor plan. `lay.seats[r*cols + c]` is the student id at row `r`, col `c`,
or null for an empty seat. Names come from the roster by id.

That is all Chazaroom needs. **No change to `app.html`'s data model is proposed.**

---

## 4. Import — export/paste (decided)

Chazaroom is deliberately standalone: it touches none of Menchmark's data and
must keep working as a downloaded file. Reading `qrPointsData_v1` directly from
localStorage would work on `menchmark.app` and nowhere else, and would couple the
two apps so that a roster edit in one silently moves the other.

**So: an explicit export.** Menchmark grows a *Copy seating chart* button that
puts a small JSON blob on the clipboard; Chazaroom grows a paste box.

```json
{
  "kind": "menchmark.seating.v1",
  "rows": 4, "cols": 6,
  "seats": [ {"id":"3","name":"Levi"}, null, {"id":"7","name":"Shimon"}, ... ]
}
```

Names are **included in the blob** rather than looked up, so Chazaroom never
needs Menchmark's roster and the paste is self-contained. Ids are carried so a
re-paste updates positions without resetting scores.

Nothing is read implicitly, ever. The rebbi presses a button in one app and
pastes into the other.

---

## 5. Room codes

Four extra printed cards, from the existing card printer:

| Code | Goes | 
|---|---|
| `ROOM:TL` | corner of the seating block matching chart row 0, col 0 |
| `ROOM:TR` | chart row 0, last col |
| `ROOM:BL` | last row, col 0 |
| `ROOM:BR` | last row, last col |

`ROOM:` must be parsed alongside `HAD:` / `ANS:` / `CTRL:` in `handleCodes()`
and must never be counted as an answer.

Tape them at the **corners of where the boys sit** — the back wall corners and
the front two seat corners — at roughly card height, not floor or ceiling.

**Calibration pass ("Map the room").** A button in setup sweeps the full pan
range at a couple of tilt steps, and for every `ROOM:` code it decodes it records
the gimbal pan/tilt **plus the code's offset in frame**, converted to an absolute
bearing the same way `seatMap` already does. Result:

```js
roomMap = {
  TL:{pan:-52, tilt:6}, TR:{pan:48, tilt:5},
  BL:{pan:-78, tilt:-22}, BR:{pan:74, tilt:-24},
  at: 1786400000000        // when calibrated
}
```

Stored in Chazaroom's own localStorage, alongside the chart.

---

## 6. The maths — bilinear over the quad

For a seat at row `r`, col `c`:

```
u = cols > 1 ? c/(cols-1) : 0.5        // 0 = left edge, 1 = right edge
v = rows > 1 ? r/(rows-1) : 0.5        // 0 = back row,  1 = front row

top = TL + (TR - TL) * u
bot = BL + (BR - BL) * u
P   = top + (bot - top) * v            // applied to pan and tilt independently
```

Plain bilinear interpolation, run separately on pan and on tilt.

**Why this is good enough.** Perspective means the far row spans fewer degrees
of pan than the near row — and bilinear reproduces that for free, because the
`TL→TR` pan spread is genuinely smaller than `BL→BR` in the measured anchors. It
interpolates between the two spreads linearly with depth, which is an
approximation of perspective foreshortening but a close one across a classroom.

**Where it breaks, honestly:** tiered or L-shaped seating, rows not evenly spaced
in depth, or a camera very close to the front row. In those rooms the middle rows
drift. The fix is not better maths — it is §8, letting real decodes correct the
prediction.

**Zoom heuristic.** The per-seat angular width at depth `v` is
`(pan_right(v) - pan_left(v)) / (cols-1)`. A card subtends a smaller angle when
it is further away, so zoom should scale roughly inversely with that width,
clamped to the camera's range. This one needs measuring in a real room before it
is trusted — treat the formula as a starting point, not a result.

---

## 7. The mirroring trap

This will bite, so it is called out rather than discovered.

A seating chart can be drawn **from the rebbi's viewpoint** (his left is chart
left) or **from the boys' viewpoint** (mirrored). Nothing in the data says which.
Get it wrong and every prediction is flipped left-for-right — and it will look
like a subtle aiming bug rather than an obvious one, because the middle columns
are nearly right.

Two defences, cheap and worth having both:

- **Auto-detect from ground truth.** Once a handful of boys have been decoded,
  correlate their observed bearings against their predicted ones. A strong
  negative correlation means the chart is mirrored → flip `u` and say so.
- **Confirm out loud.** After calibration, point the camera at one seat and show
  *"pointing at where **Levi** should be sitting — is that him?"* One glance
  settles it.

---

## 8. Prediction is a prior, never the truth

The chart says where a boy **should** be. A decode says where he **is**. The
second always wins.

- Seed every boy's position from the chart at import/calibration.
- Every decode overwrites that boy's stored bearing with the observed one
  (what `seatMap` already does today).
- The hunt prefers observed positions and falls back to predicted ones.

So the map removes the cold start, and the room corrects the map. A boy who
swapped seats is fixed the moment he is first read, without anyone re-importing.

---

## 9. What invalidates a calibration

State it in the UI, because a stale map aims confidently at nothing:

- **The camera moved or was re-aimed by hand.** Everything is relative to where
  it sat during calibration. This is the big one.
- **The camera was unplugged and replugged** — worth re-checking, though absolute
  DirectShow angles should survive.
- **Seats were rearranged**, or the chart was re-imported with different
  dimensions.

Suggested guard: store `roomMap.at`, and if the calibration is older than the
current session or the chart dimensions changed, show *"Re-map the room"* rather
than silently trusting it.

---

## 10. Phasing

Build order, each step useful alone:

1. **Corner codes, calibration pass, and tilt.** Print `ROOM:` cards, add *Map
   the room*, and make `huntMissing()` aim with pan **and tilt** from the
   measured quad. No chart import needed — corners alone already fix the tilt gap
   and retire the `HFOV_BASE` guess.
2. **Chart import.** Paste box in Chazaroom, *Copy seating chart* button in
   Menchmark, seats seeded from the grid. Fixes the cold start.
3. **Zoom by distance**, once step 1 has been measured in a real room.
4. **Mirror auto-detect** and the re-map guard.

Step 1 is the one with the best ratio of value to risk, and it is testable in
ten minutes with four taped cards.

---

## 11. Explicitly not doing

- **No SLAM, no floor plan, no depth sensing.** §2.
- **No AI vision.** Considered and rejected earlier: it would mean sending
  classroom images of children to a cloud model, needs internet, and still
  could not say *who* or *what answer* without the QR decode. The geometry does
  the job locally.
- **No changes to `app.html`'s seat data model** — Chazaroom reads a copy.

---

## 11a. Build log — step 1, and the bug that is still open

Step 1 is **written but NOT working**, and the room map should not be trusted
until this is closed. Findings from a closed-loop simulation (a canvas that
renders the corner cards from the gimbal's own reported angles, with a 300 ms
video lag modelled, and a deliberately wrong lens: true 79° against the code's
assumed 67°):

**Working:**
- `ROOM:` codes parse, print, and never count as an answer.
- The calibration pass finds all four corners and completes.
- **Tilt is accurate to ~1.4°** — the gap that motivated step 1.
- **The lens measured 79.08° against a true 79°**, from a starting guess of 67.
  The feedback-loop idea works: the FOV constant really can be retired.

**Broken — corner PAN carries a systematic error of about one sweep step**
(~32°, uniform across all four corners, reproducible run to run).

Diagnosis so far: a decoded card is attributed to the gimbal angle read *at
decode time*, but the video frame is older than that — so a sighting is pinned
to where the camera is now, not where it was when the light hit the sensor.
Adding a settle gate (`PIPE_LAG`, ignore sightings within N ms of a move) halved
the error from ~67° (two steps) to ~32° (one step). Raising the gate from 450 ms
to 900 ms did **not** reduce it further, so a fixed settle time is not the whole
story.

Better fix to try next, in order:
1. **Require two consecutive agreeing readings** before accepting a sighting.
   Lag-independent, so it does not need a constant tuned per machine.
2. Timestamp frames at capture rather than at decode, and pair each frame with
   the gimbal angle in force at that timestamp (keep a short history).
3. Only measure corners while **stationary and confirmed**, never during the
   scan pass — use the scan purely to discover *which* corners exist.

Note the asymmetry that gives the game away: tilt is fine and pan is not,
because the scan pass moves in pan and barely in tilt. Any explanation must
account for that, and attribution lag does.

## 12. Open questions

1. Does the Menchmark chart, in practice, get arranged to match the physical room
   — or do rebbeim leave it in roster order? If the latter, the import is worth
   much less and step 1 (corners only) carries the feature.
2. Four corners assume one seating block. What does a room with an aisle, or
   two facing blocks, need? Possibly two quads.
3. Should the corner cards be permanent wall fixtures (calibrate once a zman) or
   put up per game? Permanent is better if the camera has a fixed mount.
4. Is a *seat* the right unit at all, or should the chart just be a coarse
   left/middle/right band? Bands would be far cheaper and might capture most of
   the benefit — worth testing before building the full grid mapping.
