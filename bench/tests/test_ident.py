import pytest

from bench_ops import ident
from bench_ops.oui_data import OUI


@pytest.mark.parametrize("mac,group", [
    ("00:19:C5:12:34:56", "sony"),       # Sony Interactive Entertainment
    ("00-04-1f-aa-bb-cc", "sony"),
    ("00:09:BF:00:11:22", "nintendo"),
    ("00:50:F2:00:11:22", "microsoft"),
    ("00:1D:D8:00:11:22", "microsoft"),
    ("3C:22:FB:00:11:22", None),          # Apple: not a console maker
])
def test_vendor_for_mac(mac, group):
    assert ident.vendor_for_mac(mac)[0] == group


def test_randomized_macs_are_never_a_console():
    assert ident.is_randomized("DA:A1:19:00:00:01")
    assert ident.vendor_for_mac("DA:A1:19:00:00:01") == (None, None)


def test_oui_table_only_has_console_makers():
    assert {g for g, _ in OUI.values()} == {"sony", "nintendo", "microsoft"}
    assert not any("Mobile" in org or org == "Sony Corporation" for _, org in OUI.values())


@pytest.mark.parametrize("ua,family,fw", [
    ("Mozilla/5.0 (PLAYSTATION 3 4.88) AppleWebKit/531.22.8 (KHTML, like Gecko)", "ps3", "4.88"),
    ("Mozilla/5.0 (PLAYSTATION 3; 3.55)", "ps3", "3.55"),
    ("Mozilla/5.0 (PlayStation 4 5.05) AppleWebKit/601.2 (KHTML, like Gecko)", "ps4", "5.05"),
    ("Mozilla/5.0 (PlayStation; PlayStation 4/11.00) AppleWebKit/605.1.15 (KHTML, like Gecko)", "ps4", "11.00"),
    ("Mozilla/4.0 (PSP (PlayStation Portable); 2.00)", "psp", "2.00"),
    ("Opera/9.30 (Nintendo Wii; U; ; 3642; en)", "wii", None),
    ("Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0; Xbox)", "x360", None),
    # outside the fleet: must not be mistaken for a fleet console
    ("Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox One) AppleWebKit/537.36", None, None),
    ("Mozilla/5.0 (PlayStation; PlayStation 5/2.26) AppleWebKit/605.1.15", None, None),
    ("Mozilla/5.0 (PlayStation Vita 3.60) AppleWebKit/537.73", None, None),
    ("Mozilla/5.0 (Nintendo WiiU) AppleWebKit/536.30 (KHTML, like Gecko) NX/3.0.4.2.12", None, None),
    ("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15", None, None),
    ("", None, None),
])
def test_parse_user_agent(ua, family, fw):
    assert ident.parse_user_agent(ua) == {"family": family, "firmware": fw}


def test_hints_prefer_the_console_itself():
    assert ident.family_hint("sony", "PS3-ABC", "ps4") == "ps4"
    assert ident.family_hint("sony", "PS3-ABC") == "ps3"
    assert ident.family_hint("nintendo", "PS3-ABC") is None  # hostname contradicts the maker
    assert ident.family_hint("sony") is None                 # OUI alone: maker, not model
    assert ident.family_hint("sony", learned="psp") == "psp"
    assert ident.candidates_for_vendor("microsoft") == ["x360", "xbox"]
