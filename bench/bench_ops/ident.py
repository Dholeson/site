"""Identification: what the network and the console's browser reveal.

All of this is ADVISORY. It pre-fills fields; the tech confirms. Nothing here
ever blocks a workflow, and nothing here talks back to the console beyond the
plain intake page.

User-Agent patterns are from consoles' public browser UA strings. They are
deliberately loose (whitespace/separator tolerant) because firmware revisions
have changed the format over the years. Verify against a real unit before
trusting a new pattern; the tech confirms firmware either way.
"""

import re

from . import families
from .oui_data import OUI


def normalize_mac(mac):
    if not mac:
        return None
    hexdigits = re.sub(r"[^0-9A-Fa-f]", "", mac)
    if len(hexdigits) != 12:
        return None
    return ":".join(hexdigits[i:i + 2] for i in range(0, 12, 2)).upper()


def is_randomized(mac):
    """Locally administered bit set: phones/tablets with MAC randomisation.
    Consoles use their burned-in address."""
    mac = normalize_mac(mac)
    return bool(mac) and bool(int(mac[:2], 16) & 0x02)


def vendor_for_mac(mac):
    """-> (vendor_group, ieee_org) or (None, None)."""
    mac = normalize_mac(mac)
    if not mac or is_randomized(mac):
        return None, None
    return OUI.get(mac.replace(":", "")[:6], (None, None))


# --- User-Agent ------------------------------------------------------------

FW = r"(\d{1,2}\.\d{2})"

UA_PATTERNS = [
    # (family, regex, firmware group index or None)
    ("ps4", re.compile(r"PlayStation\s*4[\s/]+" + FW, re.I), 1),
    ("ps4", re.compile(r"PlayStation;\s*PlayStation\s*4/" + FW, re.I), 1),
    ("ps4", re.compile(r"PlayStation\s*4", re.I), None),
    ("ps3", re.compile(r"PLAYSTATION\s*3[;\s]+" + FW, re.I), 1),
    ("ps3", re.compile(r"PLAYSTATION\s*3", re.I), None),
    ("psp", re.compile(r"PSP\s*\(PlayStation Portable\);\s*" + FW, re.I), 1),
    ("psp", re.compile(r"PlayStation Portable", re.I), None),
    # The Wii's UA carries the Internet Channel/Opera build, NOT the system
    # menu version, so no firmware from it.
    ("wii", re.compile(r"Nintendo Wii(?!\s*U)(?!U)", re.I), None),
    # Xbox 360's browser UA says "Xbox" but not the dashboard version.
    ("x360", re.compile(r"\bXbox\b(?!\s*One)", re.I), None),
]


# Consoles outside the fleet whose UAs would otherwise trip a pattern above.
NOT_IN_FLEET = re.compile(r"Xbox\s*One|Xbox\s*Series|PlayStation\s*5|PlayStation\s*Vita|Nintendo\s*Wii\s*U", re.I)


def parse_user_agent(ua):
    """-> {"family": key|None, "firmware": "x.yy"|None}"""
    ua = ua or ""
    if NOT_IN_FLEET.search(ua):
        return {"family": None, "firmware": None}
    for family, pattern, fw_group in UA_PATTERNS:
        m = pattern.search(ua)
        if m:
            return {"family": family, "firmware": m.group(fw_group) if fw_group else None}
    return {"family": None, "firmware": None}


# --- Hostname --------------------------------------------------------------

HOSTNAME_HINTS = [
    ("ps4", re.compile(r"ps-?4|playstation-?4", re.I)),
    ("ps3", re.compile(r"ps-?3|playstation-?3", re.I)),
    ("psp", re.compile(r"\bpsp\b", re.I)),
    ("x360", re.compile(r"xbox-?360|x360", re.I)),
    ("wii", re.compile(r"\bwii\b(?!-?u)", re.I)),
]


def family_from_hostname(hostname):
    for family, pattern in HOSTNAME_HINTS:
        if hostname and pattern.search(hostname):
            return family
    return None


def candidates_for_vendor(vendor_group):
    """Families a maker's OUI could mean, most likely on a network first.
    An OUI names the maker, never the model."""
    order = {
        "sony": ["ps4", "ps3", "psp", "ps2"],
        "microsoft": ["x360", "xbox"],
        "nintendo": ["wii", "gc"],
    }
    return order.get(vendor_group, [])


def family_hint(vendor_group=None, hostname=None, ua_family=None, learned=None):
    """Best single guess, strongest signal first: the console's own UA, a
    fingerprint a tech already confirmed, the hostname, then the OUI if it only
    allows one family (it never does today, so OUI alone gives candidates)."""
    if ua_family:
        return ua_family
    if learned:
        return learned
    by_host = family_from_hostname(hostname)
    if by_host and (not vendor_group or families.get(by_host).maker == vendor_group):
        return by_host
    cands = candidates_for_vendor(vendor_group)
    return cands[0] if len(cands) == 1 else None
