"""Uploads: photos, clips, and plain-text test artifacts. Nothing else.

The type is decided by the file's leading bytes, never by its name or the
browser's Content-Type. Anything that isn't on the allowlist is refused, which
is what keeps disc images, executables, archives and console packages off this
box (spec section 8), whatever they're renamed to.
"""

import hashlib
import secrets
from pathlib import Path

from .units import BenchError

PHOTO_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
CLIP_TYPES = {"video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm"}
TEXT_TYPE = ("text/plain", "txt")

LIMITS = {"photo": 25 * 2**20, "clip": 300 * 2**20, "artifact": 2 * 2**20}

_IMAGE_BRANDS = {b"heic", b"heix", b"hevc", b"hevx", b"mif1", b"msf1", b"avif", b"avis"}


class UploadRejected(BenchError):
    pass


def sniff(head):
    """-> (kind, media_type, ext) or None for anything not allowlisted."""
    if head.startswith(b"\xff\xd8\xff"):
        return "photo", "image/jpeg", "jpg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "photo", "image/png", "png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "photo", "image/webp", "webp"
    if head[4:8] == b"ftyp":
        brand = head[8:12]
        if brand in _IMAGE_BRANDS:
            return None  # HEIC/AVIF: not displayable on the store; refuse with advice
        if brand == b"qt  ":
            return "clip", "video/quicktime", "mov"
        return "clip", "video/mp4", "mp4"
    if head.startswith(b"\x1a\x45\xdf\xa3"):
        return "clip", "video/webm", "webm"
    return None


_MARKUP = (b"<script", b"<html", b"<!doctype", b"<svg", b"<iframe", b"<object", b"<embed", b"<?xml")


def _is_plain_text(data):
    """UTF-8, no NULs, and no markup. Test logs don't contain HTML; refusing it
    means a 'log' can't be a page. (Consoles can't fetch /media at all --
    see ConsoleGuard -- this is the second fence.)"""
    if b"\x00" in data:
        return False
    try:
        data.decode("utf-8")
    except UnicodeDecodeError:
        return False
    lowered = data.lower()
    return not any(tag in lowered for tag in _MARKUP)


def store_upload(fileobj, original_name, media_dir, want=None):
    """Copy an upload into media_dir. -> dict for the attachments row.

    want: restrict to a kind ('photo' for photo slots). Raises UploadRejected.
    """
    head = fileobj.read(64)
    if not head:
        raise UploadRejected("Empty file.")
    sniffed = sniff(head)
    if sniffed is None:
        rest = fileobj.read(LIMITS["artifact"] + 1 - len(head))
        data = head + rest
        if len(data) > LIMITS["artifact"] or not _is_plain_text(data):
            if head[4:8] == b"ftyp" and head[8:12] in _IMAGE_BRANDS:
                raise UploadRejected("HEIC/AVIF photos aren't accepted -- set the camera to JPEG "
                                     "('Most Compatible' on iPhone) and retake.")
            raise UploadRejected("Only JPEG/PNG/WebP photos, MP4/MOV/WebM clips, or plain-text "
                                 "test logs can be attached.")
        kind, media_type, ext = "artifact", TEXT_TYPE[0], TEXT_TYPE[1]
        chunks = [data]
    else:
        kind, media_type, ext = sniffed
        chunks = None

    if want and kind != want:
        raise UploadRejected(f"This slot takes a {want}, not a {kind}.")

    media_dir = Path(media_dir)
    media_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{secrets.token_hex(12)}.{ext}"
    dest = media_dir / stored_name
    h = hashlib.sha256()
    size = 0
    limit = LIMITS[kind]
    try:
        with open(dest, "xb") as out:
            for chunk in (chunks or _iter(fileobj, head)):
                size += len(chunk)
                if size > limit:
                    raise UploadRejected(f"{kind.capitalize()} over {limit // 2**20} MB.")
                h.update(chunk)
                out.write(chunk)
    except BaseException:
        dest.unlink(missing_ok=True)
        raise
    return {
        "kind": kind,
        "media_type": media_type,
        "stored_name": stored_name,
        "original_name": (original_name or "")[:200] or None,
        "size_bytes": size,
        "sha256": h.hexdigest(),
    }


def _iter(fileobj, head):
    yield head
    while True:
        chunk = fileobj.read(1024 * 1024)
        if not chunk:
            return
        yield chunk
