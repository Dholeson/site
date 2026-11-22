import io

import pytest

from bench_ops import media
from bench_ops.media import UploadRejected

from .conftest import JPEG, PNG


def store(data, want=None, tmp_path=None):
    return media.store_upload(io.BytesIO(data), "f", tmp_path, want=want)


@pytest.mark.parametrize("data,kind,mtype", [
    (JPEG, "photo", "image/jpeg"),
    (PNG, "photo", "image/png"),
    (b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 50, "photo", "image/webp"),
    (b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 50, "clip", "video/mp4"),
    (b"\x00\x00\x00\x14ftypqt  " + b"\x00" * 50, "clip", "video/quicktime"),
    (b"\x1a\x45\xdf\xa3" + b"\x00" * 50, "clip", "video/webm"),
    (b"SMART overall-health self-assessment test result: PASSED\n", "artifact", "text/plain"),
])
def test_allowed_types(tmp_path, data, kind, mtype):
    meta = store(data, tmp_path=tmp_path)
    assert (meta["kind"], meta["media_type"]) == (kind, mtype)
    assert (tmp_path / meta["stored_name"]).read_bytes() == data


@pytest.mark.parametrize("data", [
    b"\x7fELF\x02\x01\x01" + b"\x00" * 100,                 # executable
    b"PK\x03\x04" + b"\x00" * 100,                           # zip / apk / jar
    b"\x7fPKG\x80\x00\x00\x01" + b"\x00" * 100,              # PS3/PS4 package
    b"\x00\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\x00" + b"\x00" * 100,  # raw CD sector sync
    b"\x00" * 32768 + b"\x01CD001",                          # ISO 9660 image
    b"<!doctype html><html><script>alert(1)</script>",       # a page dressed as a log
    b"MZ\x90\x00" + b"\x00" * 100,                           # Windows exe
    b"\x00\x00\x00\x18ftypheic" + b"\x00" * 50,              # HEIC: not displayable on the store
])
def test_everything_else_is_refused(tmp_path, data):
    with pytest.raises(UploadRejected):
        store(data, tmp_path=tmp_path)
    assert list(tmp_path.iterdir()) == []


def test_photo_slots_only_take_photos(tmp_path):
    with pytest.raises(UploadRejected, match="takes a photo"):
        store(b"plain text", want="photo", tmp_path=tmp_path)


def test_size_limit(tmp_path, monkeypatch):
    monkeypatch.setitem(media.LIMITS, "photo", 100)
    with pytest.raises(UploadRejected, match="over"):
        store(JPEG, tmp_path=tmp_path)
    assert list(tmp_path.iterdir()) == []
