# Insta360 Link PTZ control (Windows, no app needed)

`Insta360-PTZ.ps1` aims the **Insta360 Link 2 Pro** gimbal directly from Windows
using the camera's **standard DirectShow camera controls** (`IAMCameraControl`).

**No Link Controller app, no pairing QR, no token, no network, no drivers.** The
camera is a normal UVC device that exposes pan/tilt/zoom as ordinary,
absolute-position controls — so you just tell it an angle.

Measured ranges on this unit:

| axis | range |
|------|-------|
| Pan  | −145° … +145° |
| Tilt | −90° … +100° |
| Zoom | 100 … 400 |

## Use

Run in Windows PowerShell (not needed as admin):

```powershell
# show device, ranges, and current position
.\Insta360-PTZ.ps1 status

# aim to absolute angles (omit any axis to leave it as-is)
.\Insta360-PTZ.ps1 set -Pan 60 -Tilt -10 -Zoom 150

# recenter: pan 0, tilt 0, zoom 100 (wide)
.\Insta360-PTZ.ps1 center

# sweep the room: 5 pan stops across 160°, 1.5s at each, zoomed to 200
.\Insta360-PTZ.ps1 sweep -Stops 5 -Span 160 -Dwell 1500 -Zoom 200
```

If PowerShell blocks the script, unblock it once:
`Unblock-File .\Insta360-PTZ.ps1` (or run
`powershell -ExecutionPolicy Bypass -File .\Insta360-PTZ.ps1 status`).

## Why `sweep` matters (the classroom use case)

Because `set` is **absolute**, a sweep is exactly repeatable with no drift. Point
a QR scanner at the *same* camera feed (the browser multi-QR test page, or the
real app) and run `sweep`: as the gimbal steps across the room, the scanner reads
whatever codes are in view at each stop, and one full pass becomes a roll-call of
the whole room — covering far more seats than a single fixed frame, at the cost of
a few seconds per pass.

This is the piece that makes "scan a whole classroom with one camera" work, and
it's completely separate from the browser: the browser reads codes; this tool
aims the lens.

## Gotchas

- **AI tracking fights it.** If the camera won't move, turn *tracking* off in
  Link Controller (or close the app). Tracking constantly re-aims the gimbal and
  overrides manual positioning.
- The **Insta360 *Virtual* Camera** device is skipped automatically — this drives
  the real hardware device.
- Works whether or not Link Controller is running; it does not use the app at all.

## Why this, and not the app's WebSocket

The Link Controller app exposes a local WebSocket (its phone-remote feature) that
*can* control the gimbal, but only for a connection that holds active control
(`inControl=1`), which requires the live pairing token off an on-screen QR that
rotates constantly — fragile and, in practice, not reliably obtainable. The
DirectShow route below sidesteps all of that: it talks to the USB device the same
way Windows' own camera settings do.

Implementation: `IAMCameraControl.Set(prop, angle, Manual)` via a small inline C#
COM shim (`Add-Type`), so it needs nothing installed beyond the .NET Framework
that ships with Windows.
