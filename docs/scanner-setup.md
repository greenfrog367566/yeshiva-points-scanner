# Scanner Setup

## Which scanner to buy

You need a **2D scanner** — 1D scanners can only read old-style striped barcodes, not the QR codes this app generates. We've personally used and can recommend the **[Tera Wireless Barcode Scanner 1300 series](https://a.co/d/00s5Fr7u)** — a 2D barcode scanner that connects over USB Wired, 2.4G Wireless, or Bluetooth, and works with QR, PDF417, and Data Matrix codes in addition to 1D barcodes. Used over USB, it's plug-and-play with no drivers or setup in its default mode. It's not the only one that works — any USB "keyboard-emulation" 2D scanner should behave the same way — it's just the one we've tested ourselves.

## Most people need to do nothing

Cheap USB barcode/QR scanners act like a keyboard — plug one in, click into the **Scan** tab, and start scanning. No pairing, no drivers, no settings.

## Scanner modes worth knowing about (Tera 1300 series and similar)

These scanners have a handful of built-in modes, switched by scanning a specific setup barcode printed in the scanner's own manual. Most teachers never need to touch any of these — they only matter if something seems off, or you specifically want the behavior described.

### Real-Time Mode vs. Storage Mode

- **Real-Time Mode** (the factory default) sends each scan to the computer immediately, the instant you scan it. This is what the app needs — leave the scanner in this mode.
- **Storage Mode** holds scans in the scanner's own internal memory (up to roughly 10,000 codes) instead of sending them anywhere, until you later scan a specific "output stored data" barcode to dump everything at once. If scans stop appearing in the app but the scanner still beeps normally on each read, the scanner has likely been switched into Storage Mode by accident — scan the manual's "Real-Time Mode" (sometimes labeled "Instant Upload Mode") barcode to switch back.

### Vibration

The scanner vibrates once on a successful read, in addition to the beep — handy in a loud classroom, or if you've muted the beeper for a quieter environment. Scan the "Vibration Off" barcode in the manual to disable it, or "Vibration On" to re-enable.

### Time Stamp Prefix/Suffix

This model can prepend or append the scan's timestamp to the code it sends — this is what the "Time Stamp" feature in the product name refers to. **Leave this off for use with this app.** The app doesn't parse a timestamp out of the scanned text, so if this is turned on, the extra characters will be read as part of the student/activity code and the scan won't match anyone. If scans stop working after handling the scanner's settings, scanning the manual's "Time Prefix/Suffix Off" barcode is a good first thing to try.

### Trigger Mode vs. Continuous Mode

Key Trigger Mode (scan once per button press) is the default and what most classrooms want. Continuous Mode scans repeatedly as long as a code is in view, without pressing anything — not usually useful here, and can cause accidental duplicate scans if a code sits in front of the scanner.

## Serial (COM port) scanners

Some industrial, handheld, or Bluetooth-SPP scanners connect as an actual **serial/COM port** device instead of acting like a keyboard — including the Tera 1300 series, if you specifically switch it into USB-COM mode. Use the **Settings** tab only if that's what you want:

1. Go to **Settings**.
2. Choose the baud rate your scanner uses (supported: 9600, 19200, 38400, 57600, 115200 — 9600 is the common default).
3. Click **Connect scanner…** and select the port when your browser prompts you.
4. Once connected, scans from that device are read everywhere in the app — not just on one tab.
5. Click **Disconnect** when you're done, or just close the tab.

### Switching a Tera scanner into USB-COM mode

1. With the scanner connected via its USB cable (not Bluetooth or 2.4G), scan the **"USB-COM"** or **"Virtual Serial Port"** setup barcode from the scanner's printed manual. There are usually several similar-looking mode barcodes near it (Bluetooth HID, 2.4G Mode, factory reset) — double-check you're scanning the right one.
2. **Unplug and replug the USB cable.** Several of these scanners only apply the new mode after the connection re-establishes — the scan alone isn't always enough.
3. Confirm Windows actually sees it: open **Device Manager** (`Win + X` → Device Manager) and look under **"Ports (COM & LPT)."** If nothing shows up there, the mode switch hasn't taken effect yet — Chrome's connection picker will never show a port that Windows itself doesn't see. Also check under **"Other devices"** for anything with a warning icon, which would mean Windows saw the hardware but couldn't install a driver for it.
4. To switch back to normal keyboard-emulation scanning, scan the manual's **"2.4G Mode"** or equivalent barcode (this exits USB-COM mode), then unplug/replug again.

### Requirements

- **Chrome or Edge on a computer**, over HTTPS. Direct serial connection is not supported in other browsers or on most mobile devices — regular keyboard-style scanning still works everywhere, including on those.
- If you see a message that direct serial connection isn't supported, you're on an unsupported browser/device — either switch to Chrome/Edge on a computer, or use a keyboard-emulation (USB) scanner instead, which needs no special setup at all.

### Auto-reconnect

The app remembers the last serial connection and will try to reconnect automatically the next time you open it, as long as you're on the same browser/computer and didn't manually disconnect.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Scans don't appear anywhere | Scanner isn't in keyboard-emulation mode and hasn't been connected via Settings |
| Scanner beeps normally but nothing shows up, even in Notepad | Scanner may be in Storage Mode — scan the manual's Real-Time/Instant Upload Mode barcode to switch back |
| Scanned codes come through with extra characters attached, or don't match any student | Time Stamp prefix/suffix is likely turned on — scan the manual's "Time Prefix/Suffix Off" barcode |
| "Not supported" message in Settings | Wrong browser/device for serial — use Chrome/Edge on a computer, or switch to a USB keyboard-emulation scanner |
| COM-port scanner doesn't show up in the browser's connect picker | Check Windows Device Manager under "Ports (COM & LPT)" first — if nothing's there, the scanner hasn't actually switched into USB-COM mode yet. Re-scan the setup barcode, then unplug/replug the USB cable |
| Serial scanner won't reconnect after restart | Reconnect manually once via Settings; auto-reconnect should pick it up next time |
| Scans appear duplicated or garbled | Wrong baud rate selected — check your scanner's manual for its default |
