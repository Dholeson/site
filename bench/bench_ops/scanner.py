"""Optional: a USB HID barcode scanner plugged into the appliance itself.

A scanner on the tech's tablet/phone needs none of this -- it types into the
focused barcode field like a keyboard. This reader is for a scanner wired to
the Pi: it grabs the device (so scans don't leak to the Pi's console), turns
key events into text, and hands each Enter-terminated code to on_scan.

Linux evdev, stdlib only. Point BENCH_SCANNER_DEVICE at the stable path,
e.g. /dev/input/by-id/usb-<vendor>_<model>-event-kbd. The service user needs
read access (add it to the `input` group).
"""

import fcntl
import logging
import os
import select
import struct
import threading

log = logging.getLogger("bench.scanner")

EVENT = struct.Struct("llHHi")  # struct input_event, native sizes
EV_KEY = 1
EVIOCGRAB = 0x40044590

KEY_ENTER, KEY_KPENTER = 28, 96
SHIFTS = {42, 54}

_PLAIN = {
    2: "1", 3: "2", 4: "3", 5: "4", 6: "5", 7: "6", 8: "7", 9: "8", 10: "9", 11: "0", 12: "-", 13: "=",
    16: "q", 17: "w", 18: "e", 19: "r", 20: "t", 21: "y", 22: "u", 23: "i", 24: "o", 25: "p", 26: "[", 27: "]",
    30: "a", 31: "s", 32: "d", 33: "f", 34: "g", 35: "h", 36: "j", 37: "k", 38: "l", 39: ";", 40: "'", 41: "`",
    43: "\\", 44: "z", 45: "x", 46: "c", 47: "v", 48: "b", 49: "n", 50: "m", 51: ",", 52: ".", 53: "/", 57: " ",
    71: "7", 72: "8", 73: "9", 74: "-", 75: "4", 76: "5", 77: "6", 78: "+", 79: "1", 80: "2", 81: "3", 82: "0",
    83: ".", 98: "/", 55: "*",
}
_SHIFTED = {
    2: "!", 3: "@", 4: "#", 5: "$", 6: "%", 7: "^", 8: "&", 9: "*", 10: "(", 11: ")", 12: "_", 13: "+",
    26: "{", 27: "}", 39: ":", 40: '"', 41: "~", 43: "|", 51: "<", 52: ">", 53: "?",
}


class KeyDecoder:
    """Feed (code, value) key events; returns a finished barcode on Enter."""

    def __init__(self):
        self.buf = []
        self.shift = False

    def feed(self, code, value):
        if code in SHIFTS:
            self.shift = value != 0
            return None
        if value != 1:  # only key-down
            return None
        if code in (KEY_ENTER, KEY_KPENTER):
            text, self.buf = "".join(self.buf).strip(), []
            return text or None
        ch = (_SHIFTED.get(code) if self.shift else None) or _PLAIN.get(code)
        if ch:
            self.buf.append(ch.upper() if self.shift and ch.isalpha() else ch)
        if len(self.buf) > 128:  # stuck key / not a scanner
            self.buf = []
        return None


class ScannerReader(threading.Thread):
    def __init__(self, device_path, on_scan):
        super().__init__(name="barcode-scanner", daemon=True)
        self.device_path = device_path
        self.on_scan = on_scan
        self.stop_event = threading.Event()
        self.running = False
        self.error = None

    def run(self):
        try:
            fd = os.open(self.device_path, os.O_RDONLY | os.O_NONBLOCK)
        except OSError as e:
            self.error = str(e)
            log.warning("Barcode scanner off (%s)", e)
            return
        try:
            try:
                fcntl.ioctl(fd, EVIOCGRAB, 1)
            except OSError as e:
                log.warning("Could not grab %s (%s); scans may also reach the Pi console", self.device_path, e)
            self.running = True
            decoder = KeyDecoder()
            log.info("Barcode scanner reading %s", self.device_path)
            while not self.stop_event.is_set():
                ready, _, _ = select.select([fd], [], [], 1.0)
                if not ready:
                    continue
                try:
                    data = os.read(fd, EVENT.size * 64)
                except BlockingIOError:
                    continue
                for off in range(0, len(data) - EVENT.size + 1, EVENT.size):
                    _, _, etype, code, value = EVENT.unpack_from(data, off)
                    if etype != EV_KEY:
                        continue
                    text = decoder.feed(code, value)
                    if text:
                        try:
                            self.on_scan(text)
                        except Exception:
                            log.exception("Handling scan %r failed", text)
        finally:
            os.close(fd)
            self.running = False

    def stop(self):
        self.stop_event.set()
