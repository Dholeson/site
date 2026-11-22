"""Money is integer cents. This module is the only place a typed price
becomes a number, and it never goes through float."""

import re

MAX_CENTS = 10_000_00  # $10,000 -- a typo guard, not a business rule

_PRICE = re.compile(r"^(\d{1,7})(?:\.(\d{1,2}))?$")


class PriceError(ValueError):
    pass


def parse_price(text):
    """'145' / '145.00' / '$145.5' -> 14500 / 14500 / 14550. Pure string
    arithmetic: '0.1' + '0.2' problems cannot happen here."""
    s = (text or "").strip().replace("$", "").replace(",", "").strip()
    m = _PRICE.match(s)
    if not m:
        raise PriceError(f"Not a price: {text!r}. Use dollars like 145 or 145.00.")
    dollars, frac = m.group(1), (m.group(2) or "")
    cents = int(dollars) * 100 + int(frac.ljust(2, "0") or "0")
    if cents <= 0:
        raise PriceError("Price must be more than $0.")
    if cents > MAX_CENTS:
        raise PriceError(f"Price over ${MAX_CENTS // 100:,} -- typo?")
    return cents


def require_cents(value):
    """Assert a value is integer cents (bool is an int subclass; reject it)."""
    if type(value) is not int or value <= 0:
        raise PriceError(f"priceCents must be a positive integer, got {value!r}")
    return value


def format_cents(cents):
    return f"${cents // 100:,}.{cents % 100:02d}"
