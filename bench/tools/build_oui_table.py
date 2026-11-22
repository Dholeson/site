#!/usr/bin/env python3
"""Regenerate bench_ops/oui_data.py from an IEEE MA-L registry file.

The table is deliberately small: only the three console makers. Everything
else on the bench LAN (the tech's tablet, the AP) shows up as "other".

Usage:
    python tools/build_oui_table.py path/to/oui.txt   # IEEE text format
    python tools/build_oui_table.py path/to/oui.csv   # IEEE CSV format

Where to get the file (needs internet once, on any machine):
    https://standards-oui.ieee.org/oui/oui.txt  (or oui.csv)
    or the copy bundled in the `netaddr` wheel: netaddr/eui/oui.txt

Organization names are matched exactly (case-insensitive), not by substring,
so "Microsoft Mobile Oy" (Nokia phones) and "Sony Corporation" (TVs, phones)
stay out.
"""

import csv
import re
import sys
from pathlib import Path

# IEEE organization name -> vendor group used by bench_ops.ident
ORGS = {
    "nintendo co., ltd.": "nintendo",
    "nintendo co.,ltd": "nintendo",
    "sony interactive entertainment inc.": "sony",
    "sony computer entertainment inc.": "sony",
    "sony computer entertainment america": "sony",
    "microsoft corporation": "microsoft",
    "microsoft corp.": "microsoft",
    "microsoft": "microsoft",
    "microsoft xcg": "microsoft",
}

OUT = Path(__file__).resolve().parent.parent / "bench_ops" / "oui_data.py"


def parse_txt(text):
    for m in re.finditer(r"^([0-9A-F]{2}-[0-9A-F]{2}-[0-9A-F]{2})\s+\(hex\)\s+(.+?)\s*$", text, re.M):
        yield m.group(1).replace("-", ""), m.group(2)


def parse_csv(text):
    for row in csv.DictReader(text.splitlines()):
        yield row["Assignment"].strip().upper(), row["Organization Name"].strip()


def main(path):
    text = Path(path).read_text(encoding="utf-8", errors="replace")
    rows = parse_csv(text) if path.endswith(".csv") else parse_txt(text)
    table = {}
    for prefix, org in rows:
        group = ORGS.get(org.strip().lower())
        if group:
            table[prefix] = (group, org.strip())
    if not table:
        sys.exit("No console-maker OUIs found -- wrong file format?")

    lines = [
        '"""MAC OUI prefixes for the console makers. GENERATED -- do not edit.',
        "",
        "Regenerate with: python tools/build_oui_table.py <IEEE oui.txt or oui.csv>",
        f"Source file: {Path(path).name}; {len(table)} prefixes.",
        '"""',
        "",
        "# prefix (6 hex digits, upper case) -> (vendor group, IEEE organization name)",
        "OUI = {",
    ]
    for prefix in sorted(table):
        group, org = table[prefix]
        lines.append(f"    {prefix!r}: ({group!r}, {org!r}),")
    lines.append("}")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    counts = {}
    for group, _ in table.values():
        counts[group] = counts.get(group, 0) + 1
    print(f"wrote {OUT} -- {counts}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
