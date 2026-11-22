"""IP -> MAC from the kernel's neighbour table, for the intake page.

When a console's browser loads /c, it has just talked to us, so the kernel
has its MAC in /proc/net/arp (as long as it's on the same L2 segment --
which an isolated bench LAN is).
"""

from pathlib import Path


def mac_for_ip(ip, arp_path="/proc/net/arp"):
    try:
        lines = Path(arp_path).read_text().splitlines()[1:]
    except OSError:
        return None
    for line in lines:
        parts = line.split()
        # IP address  HW type  Flags  HW address  Mask  Device
        if len(parts) >= 4 and parts[0] == ip:
            flags, mac = parts[2], parts[3]
            if int(flags, 16) & 0x2 and mac != "00:00:00:00:00:00":
                return mac.upper()
    return None
