"""Passive DHCP watcher.

Listens on a raw socket and reads the DHCP traffic consoles broadcast when
they join the LAN. Passive: it never sends a packet, never answers DHCP, and
works whether the Pi or a separate router is the DHCP server (client
DISCOVER/REQUEST are broadcast, so any host on the segment sees them).

Needs CAP_NET_RAW (the systemd unit grants it). Without it the watcher logs
one warning and stays off; nothing else depends on it.
"""

import ipaddress
import logging
import select
import socket
import struct
import threading

log = logging.getLogger("bench.dhcp")

ETH_P_IP = 0x0800
MAGIC = b"\x63\x82\x53\x63"
DHCP_TYPES = {1: "DISCOVER", 2: "OFFER", 3: "REQUEST", 4: "DECLINE", 5: "ACK", 6: "NAK", 7: "RELEASE", 8: "INFORM"}


def parse_options(data):
    opts, i = {}, 0
    while i < len(data):
        code = data[i]
        if code == 0:  # pad
            i += 1
            continue
        if code == 255:  # end
            break
        if i + 1 >= len(data):
            break
        length = data[i + 1]
        opts[code] = data[i + 2:i + 2 + length]
        i += 2 + length
    return opts


def parse_bootp(payload):
    """BOOTP/DHCP payload (UDP body) -> dict, or None if not DHCP."""
    if len(payload) < 240 or payload[236:240] != MAGIC:
        return None
    op, htype, hlen = payload[0], payload[1], payload[2]
    if htype != 1 or hlen != 6:
        return None
    opts = parse_options(payload[240:])
    msg_type = opts.get(53, b"\x00")[0] if 53 in opts else None
    chaddr = payload[28:34]
    yiaddr = str(ipaddress.IPv4Address(payload[16:20]))
    ciaddr = str(ipaddress.IPv4Address(payload[12:16]))
    requested = str(ipaddress.IPv4Address(opts[50])) if len(opts.get(50, b"")) == 4 else None

    def text(code):
        v = opts.get(code)
        return v.decode("ascii", "replace").strip("\x00 ")[:120] if v else None

    ip = None
    if op == 2 and msg_type == 5:          # server ACK: the address the client got
        ip = yiaddr if yiaddr != "0.0.0.0" else None
    elif op == 1:                          # client message
        ip = ciaddr if ciaddr != "0.0.0.0" else requested
    return {
        "op": op,
        "type": DHCP_TYPES.get(msg_type),
        "mac": ":".join(f"{b:02X}" for b in chaddr),
        "ip": ip,
        # Only trust client-supplied identity fields from client messages.
        "hostname": text(12) if op == 1 else None,
        "vendor_class": text(60) if op == 1 else None,
        "fingerprint": ",".join(str(b) for b in opts[55]) if op == 1 and 55 in opts else None,
    }


def parse_frame(frame):
    """Ethernet frame -> parse_bootp(...) or None. Handles one VLAN tag."""
    if len(frame) < 14:
        return None
    ethertype = struct.unpack("!H", frame[12:14])[0]
    off = 14
    if ethertype == 0x8100 and len(frame) >= 18:
        ethertype = struct.unpack("!H", frame[16:18])[0]
        off = 18
    if ethertype != ETH_P_IP or len(frame) < off + 20:
        return None
    ihl = (frame[off] & 0x0F) * 4
    if frame[off + 9] != 17:  # UDP
        return None
    udp = off + ihl
    if len(frame) < udp + 8:
        return None
    sport, dport = struct.unpack("!HH", frame[udp:udp + 4])
    if sport not in (67, 68) or dport not in (67, 68):
        return None
    return parse_bootp(frame[udp + 8:])


class DhcpWatcher(threading.Thread):
    def __init__(self, iface, on_packet):
        super().__init__(name="dhcp-watcher", daemon=True)
        self.iface = iface
        self.on_packet = on_packet
        self.stop_event = threading.Event()
        self.running = False
        self.error = None

    def run(self):
        try:
            sock = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(ETH_P_IP))
            sock.bind((self.iface, 0))
        except (OSError, AttributeError) as e:
            self.error = f"{type(e).__name__}: {e}"
            log.warning("DHCP watcher off (%s). Needs CAP_NET_RAW and a real interface.", self.error)
            return
        self.running = True
        log.info("DHCP watcher listening on %s", self.iface)
        with sock:
            while not self.stop_event.is_set():
                ready, _, _ = select.select([sock], [], [], 1.0)
                if not ready:
                    continue
                frame = sock.recv(65535)
                try:
                    pkt = parse_frame(frame)
                    if pkt and pkt["mac"]:
                        self.on_packet(pkt)
                except Exception:  # a bad packet must never kill the watcher
                    log.exception("DHCP packet handling failed")
        self.running = False

    def stop(self):
        self.stop_event.set()
