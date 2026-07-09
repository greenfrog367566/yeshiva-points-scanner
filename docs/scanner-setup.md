# Scanner Setup

## Which scanner to buy

You need a **2D scanner** — 1D scanners can only read old-style striped barcodes, not the QR codes this app generates. We've personally used and can recommend the **[NETUM NT-1228BL](https://a.co/d/0eS4Qweq)** — a 2D barcode scanner that connects over 2.4G Wireless, Bluetooth, or USB Wired, and works with QR, PDF417, and Data Matrix codes in addition to 1D barcodes. Used over USB, it's plug-and-play with no drivers or setup. It's not the only one that works — any USB "keyboard-emulation" 2D scanner should behave the same way — it's just the one we've tested ourselves.

## Most people need to do nothing

Cheap USB barcode/QR scanners act like a keyboard — plug one in, click into the **Scan** tab, and start scanning. No pairing, no drivers, no settings.

## Serial (COM port) scanners

Some industrial, handheld, or Bluetooth-SPP scanners connect as an actual **serial/COM port** device instead of acting like a keyboard. Use the **Settings** tab only if that's you:

1. Go to **Settings**.
2. Choose the baud rate your scanner uses (supported: 9600, 19200, 38400, 57600, 115200 — 9600 is the common default).
3. Click **Connect scanner…** and select the port when your browser prompts you.
4. Once connected, scans from that device are read everywhere in the app — not just on one tab.
5. Click **Disconnect** when you're done, or just close the tab.

### Requirements

- **Chrome or Edge on a computer**, over HTTPS. Direct serial connection is not supported in other browsers or on most mobile devices — regular keyboard-style scanning still works everywhere, including on those.
- If you see a message that direct serial connection isn't supported, you're on an unsupported browser/device — either switch to Chrome/Edge on a computer, or use a keyboard-emulation (USB) scanner instead, which needs no special setup at all.

### Auto-reconnect

The app remembers the last serial connection and will try to reconnect automatically the next time you open it, as long as you're on the same browser/computer and didn't manually disconnect.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Scans don't appear anywhere | Scanner isn't in keyboard-emulation mode and hasn't been connected via Settings |
| "Not supported" message in Settings | Wrong browser/device for serial — use Chrome/Edge on a computer, or switch to a USB keyboard-emulation scanner |
| Serial scanner won't reconnect after restart | Reconnect manually once via Settings; auto-reconnect should pick it up next time |
| Scans appear duplicated or garbled | Wrong baud rate selected — check your scanner's manual for its default |
