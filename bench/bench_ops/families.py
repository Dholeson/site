"""The fleet: what each console family is, has, and gets checked for.

`platform` is the exact string the storefront uses in data/products.js (the
store builds its platform filter from it, so it must stay consistent across
listings: the existing GameCube products use "GameCube").

The QC checklists here are SEEDS. They are copied into the database on first
start and are editable from the UI after that; changing this file does not
touch an existing database.

Item tuple: (label, guidance, blocking). Model-dependent hardware is marked
"(models with ...)" and stays blocking -- the tech records N/A when the unit
doesn't have it, and a real fail still blocks.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Family:
    key: str
    name: str                 # display name
    platform: str             # products.js `platform`
    maker: str                # nintendo / sony / microsoft (matches the OUI groups)
    noun: str                 # "Console" or "Handheld" (listing name)
    shipping_class: str       # products.js `shippingClass`
    writable_storage: bool    # default for has_writable_storage; override per unit
    checks: dict = field(default_factory=dict)  # section -> [(label, guidance, blocking)]


POWER_GUIDANCE = "Watch the first boot from cold. Note any error code exactly as shown."


def _power(menu, faults):
    return [
        (f"Powers on and reaches {menu}", POWER_GUIDANCE, True),
        (f"No error codes or fault indicators ({faults})", "", True),
        ("Fan and PSU behave normally", "No grinding, burning smell, cut-outs or overheating. N/A for fanless units.", True),
    ]


VIDEO_SUITE = (
    "Video test suite (homebrew-enabled units only)",
    "If this unit runs homebrew, the tech may launch a video test suite such as the "
    "240p Test Suite ON THE CONSOLE and record what it showed. This appliance only "
    "records the result. N/A for stock units.",
    False,
)

DISC_GUIDANCE = "Use a known-good disc from the shop's test stack. Boot it and play through a video/FMV section."

_ports = lambda n, what="Controller port": [(f"{what} {i} reads input", "Every button and stick.", True) for i in range(1, n + 1)]


FAMILIES = {
    f.key: f for f in [
        Family(
            "ps1", "PlayStation", "PlayStation", "sony", "Console", "console", False,
            {
                "Power": _power("the BIOS menu", "none expected"),
                "A/V output": [
                    ("Composite video and stereo audio via AV Multi Out", "", True),
                    ("S-Video via AV Multi Out (if cable on hand)", "Removed on some later models; N/A if absent.", False),
                    VIDEO_SUITE,
                ],
                "Controller ports": _ports(2),
                "Storage / media": [
                    ("Disc drive reads a known-good disc", DISC_GUIDANCE, True),
                    ("Memory card slot 1 reads and writes", "Use the shop's test card.", True),
                    ("Memory card slot 2 reads and writes", "Use the shop's test card.", True),
                ],
            },
        ),
        Family(
            "ps2", "PlayStation 2", "PlayStation 2", "sony", "Console", "console", False,
            {
                "Power": _power("the browser/system menu", "none expected"),
                "A/V output": [
                    ("Composite video and stereo audio via AV Multi Out", "", True),
                    ("Component (YPbPr) via AV Multi Out (if cable on hand)", "", False),
                    VIDEO_SUITE,
                ],
                "Controller ports": _ports(2),
                "Storage / media": [
                    ("Reads a known-good DVD-format disc", DISC_GUIDANCE, True),
                    ("Reads a known-good CD-format disc", "Lasers often fail on one format first -- test both.", True),
                    ("Memory card slot 1 reads and writes", "Use the shop's test card.", True),
                    ("Memory card slot 2 reads and writes", "Use the shop's test card.", True),
                    ("HDD health (models with HDD fitted)", "SMART where exposed. N/A if no HDD.", True),
                ],
                "Network": [
                    ("Ethernet link comes up (slim built-in, or fat with network adapter)", "N/A for a fat unit without the adapter.", True),
                ],
            },
        ),
        Family(
            "ps3", "PlayStation 3", "PlayStation 3", "sony", "Console", "console", True,
            {
                "Power": _power("the XMB", "no YLOD, no fan stuck at full speed"),
                "A/V output": [
                    ("HDMI video and audio", "", True),
                    ("Composite/component via AV Multi Out (if cable on hand)", "", False),
                    VIDEO_SUITE,
                ],
                "Controller ports": [
                    ("Each front USB port connects a wired controller", "", True),
                    ("Bluetooth controller pairs and holds connection", "", True),
                ],
                "Storage / media": [
                    ("Blu-ray drive reads a known-good disc", DISC_GUIDANCE, True),
                    ("Internal HDD recognised, no storage errors", "SMART where exposed.", True),
                ],
                "Network": [
                    ("Ethernet link comes up", "", True),
                    ("Wi-Fi associates with the bench AP (models with Wi-Fi)", "", True),
                ],
            },
        ),
        Family(
            "ps4", "PlayStation 4", "PlayStation 4", "sony", "Console", "console", True,
            {
                "Power": _power("the home screen", "no blue light of death, no safe-mode loop"),
                "A/V output": [
                    ("HDMI video and audio", "Check the HDMI port itself for looseness or bent pins.", True),
                    VIDEO_SUITE,
                ],
                "Controller ports": [
                    ("Controller pairs over USB and then works wirelessly", "", True),
                    ("Each USB port connects/charges a controller", "", True),
                ],
                "Storage / media": [
                    ("Blu-ray drive accepts, reads and ejects a known-good disc", DISC_GUIDANCE, True),
                    ("Internal HDD health", "SMART where exposed; otherwise system storage reports OK.", True),
                ],
                "Network": [
                    ("Ethernet link comes up", "", True),
                    ("Wi-Fi associates with the bench AP", "", True),
                ],
            },
        ),
        Family(
            "xbox", "Xbox", "Xbox", "microsoft", "Console", "console", True,
            {
                "Power": _power("the dashboard", "no error code, no flashing red/green"),
                "A/V output": [
                    ("Composite video and stereo audio via AV port", "", True),
                    ("Component via HD AV pack (if on hand)", "", False),
                    VIDEO_SUITE,
                ],
                "Controller ports": _ports(4),
                "Storage / media": [
                    ("DVD drive reads a known-good disc", DISC_GUIDANCE, True),
                    ("HDD recognised, no errors", "SMART where exposed.", True),
                ],
                "Network": [
                    ("Ethernet link comes up", "", True),
                ],
            },
        ),
        Family(
            "x360", "Xbox 360", "Xbox 360", "microsoft", "Console", "console", True,
            {
                "Power": _power("the dashboard", "no red ring, no E-code"),
                "A/V output": [
                    ("HDMI video and audio (models with HDMI)", "Early units have no HDMI port: N/A.", True),
                    ("Composite/component via AV port (if cable on hand)", "", False),
                    VIDEO_SUITE,
                ],
                "Controller ports": [
                    ("Wireless controller syncs and holds connection", "", True),
                    ("Each USB port connects a wired controller", "", True),
                ],
                "Storage / media": [
                    ("DVD drive reads a known-good disc", DISC_GUIDANCE, True),
                    ("HDD or internal storage recognised in System Settings", "SMART where exposed.", True),
                ],
                "Network": [
                    ("Ethernet link comes up", "", True),
                    ("Wi-Fi associates with the bench AP (models with Wi-Fi)", "", True),
                ],
            },
        ),
        Family(
            "wii", "Wii", "Wii", "nintendo", "Console", "console", True,
            {
                "Power": _power("the Wii Menu", "no error or recovery screen"),
                "A/V output": [
                    ("Composite video and stereo audio via AV Multi Out", "", True),
                    ("Component (480p) via AV Multi Out (if cable on hand)", "", False),
                    VIDEO_SUITE,
                ],
                "Controller ports": [
                    ("Wii Remote syncs; sensor bar pointer tracks", "", True),
                ] + [
                    (f"GameCube controller port {i} reads input (models with GameCube ports)", "N/A on models without GameCube ports.", True)
                    for i in range(1, 5)
                ],
                "Storage / media": [
                    ("Disc drive reads a known-good Wii disc", DISC_GUIDANCE, True),
                    ("Reads a known-good GameCube disc (models with GameCube support)", "", True),
                    ("GameCube memory card slots read and write (models with them)", "", True),
                    ("SD card slot reads a card", "", True),
                ],
                "Network": [
                    ("Wi-Fi associates with the bench AP", "", True),
                ],
            },
        ),
        Family(
            "psp", "PSP", "PSP", "sony", "Handheld", "small", True,
            {
                "Power": _power("the XMB", "no startup error"),
                "A/V output": [
                    ("Screen: no dead pixels, even backlight", "", True),
                    ("Speakers and headphone jack", "", True),
                    ("TV out via video cable (models with TV out, if cable on hand)", "", False),
                    VIDEO_SUITE,
                ],
                "Controls": [
                    ("All face buttons, D-pad and shoulder buttons respond", "", True),
                    ("Analog nub centred, full range, no drift", "", True),
                ],
                "Storage / media": [
                    ("UMD drive reads a known-good UMD (models with UMD)", "N/A on models without a UMD drive.", True),
                    ("Memory Stick slot / internal storage reads and writes", "", True),
                ],
                "Network": [
                    ("Wi-Fi associates with the bench AP", "WLAN switch on, where the model has one.", True),
                ],
                "Battery / RTC": [
                    ("Battery charges and holds charge through the QC session", "", True),
                    ("Clock holds", "Set the clock, power fully off, power back on: time still correct.", True),
                ],
            },
        ),
        Family(
            "gc", "GameCube", "GameCube", "nintendo", "Console", "console", False,
            {
                "Power": _power("the main menu", "none expected"),
                "A/V output": [
                    ("Composite video and stereo audio via Analog AV Out", "", True),
                    ("Component via Digital AV Out (models with the digital port, if cable on hand)", "", False),
                    VIDEO_SUITE,
                ],
                "Controller ports": _ports(4),
                "Storage / media": [
                    ("Disc drive reads a known-good disc", DISC_GUIDANCE, True),
                    ("Memory card slot A reads and writes", "Use the shop's test card.", True),
                    ("Memory card slot B reads and writes", "Use the shop's test card.", True),
                ],
            },
        ),
    ]
}

PHOTO_SLOTS = ("front", "back", "ports", "serial")

COSMETIC_SECTION = "Cosmetic photo set"
COSMETIC_ITEMS = [
    (f"Photo: {slot}", "Attach the photo here; the item passes when a photo is attached.", False, slot)
    for slot in PHOTO_SLOTS
]


def get(key):
    return FAMILIES.get(key) if key else None


def choices():
    return [(f.key, f.name) for f in FAMILIES.values()]


def by_maker(maker):
    return [f.key for f in FAMILIES.values() if f.maker == maker]


# Refurb work kinds and how they read in listing copy.
REPAIR_KINDS = {
    "recap": "Recapped",
    "drive_service": "Disc drive serviced",
    "laser_replaced": "Laser replaced",
    "thermal": "Thermal paste replaced",
    "fan": "Fan cleaned or replaced",
    "psu": "Power supply serviced",
    "deep_clean": "Cleaned inside and out",
    "retrobright": "Shell retrobrighted",
    "shell": "Shell replaced",
    "battery": "Battery replaced",
    "port_repair": "Port repaired",
    "other": "Other (describe)",
}
