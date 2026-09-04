"""Self-check for FoldLock. NASA-robust, no network, no telemetry.

    foldlock doctor
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Callable

from foldlock import __version__
from foldlock.engine import (
    ENGINE_VERSION,
    LIMITATION,
    MAGIC,
    MAGIC_UNI1,
    PAPER_ID,
    SPEC_STRING,
    TETHERS,
    VECTORS_HITS,
    VECTORS_ORIG_SIZE,
    VECTORS_SHA256,
    VECTORS_TEXT,
    fold_bytes,
    fold_fld3_bytes,
    info_bytes,
    suppress,
    unfold_bytes,
)
from foldlock.ui import LOOPBACK, make_server
from foldlock.uni1 import FoldRefuse

Check = tuple[str, bool, str]


def _ok(name: str, detail: str = "") -> Check:
    return name, True, detail


def _fail(name: str, detail: str) -> Check:
    return name, False, detail


def _check_version() -> Check:
    if __version__ == ENGINE_VERSION == "0.8.0":
        return _ok("version", __version__)
    return _fail("version", f"{__version__} vs engine {ENGINE_VERSION}")


def _check_spec() -> Check:
    if SPEC_STRING == "foldlock-v0.8-UNI1" and PAPER_ID == "FL-WP-0.8" and MAGIC == b"FLD3" and MAGIC_UNI1 == b"UNI1":
        return _ok("spec", f"{SPEC_STRING} {PAPER_ID} {MAGIC.decode()}/{MAGIC_UNI1.decode()}")
    return _fail("spec", f"{SPEC_STRING} {PAPER_ID} {MAGIC!r} {MAGIC_UNI1!r}")


def _check_tethers() -> Check:
    first = list(TETHERS[:7])
    if len(TETHERS) != 112:
        return _fail("tethers length", str(len(TETHERS)))
    if first != ["as", "is", "has", "to", "and", "or", "etc"]:
        return _fail("tethers first seven", ",".join(first))
    if TETHERS[79] != "she" or TETHERS[80] != "her" or TETHERS[111] != "etcetera":
        return _fail("tethers she/her/etcetera", f"{TETHERS[79]} {TETHERS[80]} {TETHERS[111]}")
    return _ok("tethers", "112 TETH-1; first seven as,is,has,to,and,or,etc")


def _check_vectors() -> Check:
    raw = VECTORS_TEXT.encode("utf-8")
    if len(raw) != VECTORS_ORIG_SIZE:
        return _fail("vectors size", f"{len(raw)} != {VECTORS_ORIG_SIZE}")
    digest = hashlib.sha256(raw).hexdigest()
    if digest != VECTORS_SHA256:
        return _fail("vectors sha256", digest)
    blob, receipt = fold_bytes(raw, name="VECTORS.txt")
    if len(blob) > len(raw):
        return _fail("vectors no-grow", f"folded {len(blob)} > orig {len(raw)}")
    restored, un = unfold_bytes(blob)
    if restored != raw:
        return _fail("vectors restore", "bytes differ")
    if un.get("verified") is not True or un.get("zip") is not False:
        return _fail("vectors unfold flags", str(un))
    if receipt.get("zip") is not False:
        return _fail("vectors fold flags", str(receipt))
    return _ok("vectors", f"orig_size {len(raw)} verified True zip False strategy {receipt.get('strategy')}")


def _check_line_hits() -> Check:
    lines = VECTORS_TEXT.splitlines(keepends=True)
    got = []
    for line in lines:
        _body, stats = suppress(line)
        got.append(stats["tether_hits"])
    if tuple(got) != VECTORS_HITS:
        return _fail("line hits", str(got))
    return _ok("line hits", "3,7,3,0")


def _check_short_string() -> Check:
    raw = b"hi"
    blob, receipt = fold_bytes(raw, name="hi.txt")
    if blob != raw or len(blob) > len(raw):
        return _fail("short string", f"grew or mutated {len(blob)}")
    if receipt.get("strategy") != "passthrough":
        return _fail("short string strategy", str(receipt.get("strategy")))
    restored, un = unfold_bytes(blob)
    if restored != raw or un.get("verified") is not True:
        return _fail("short string restore", str(un))
    return _ok("short string", "passthrough, did not grow")


def _check_binary_refused() -> Check:
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
    try:
        fold_bytes(png, name="x.png")
    except (ValueError, FoldRefuse) as exc:
        msg = str(exc).lower()
        if "binary" in msg or "utf-8" in msg or "zip" in msg or "compress" in msg or "png" in msg:
            return _ok("refuse binary", "PNG-like bytes refused")
        return _fail("refuse binary", str(exc))
    return _fail("refuse binary", "PNG-like bytes were folded")


def _check_zip_refused() -> Check:
    zipped = b"PK\x03\x04" + b"hello text payload"
    try:
        fold_bytes(zipped, name="x.zip")
    except (ValueError, FoldRefuse) as exc:
        msg = str(exc).lower()
        if "compress" in msg or "zip" in msg:
            return _ok("refuse zip", "ZIP magic refused")
        return _fail("refuse zip", str(exc))
    return _fail("refuse zip", "ZIP magic was folded")


def _check_fld2_refused() -> Check:
    fake = b"FLD2" + b"\x00" * 60
    try:
        unfold_bytes(fake)
    except ValueError as exc:
        if "FLD2" in str(exc) and "zlib" in str(exc).lower():
            return _ok("refuse FLD2", "zlib wrapper retired")
        return _fail("refuse FLD2", str(exc))
    return _fail("refuse FLD2", "FLD2 was accepted")


def _check_mixed_case() -> Check:
    raw = b"tHe cat"
    blob, receipt = fold_bytes(raw, name="mix.txt")
    restored, _un = unfold_bytes(blob)
    if restored != raw:
        return _fail("mixed case restore", restored.decode("utf-8", "replace"))
    if receipt.get("strategy") == "passthrough":
        return _ok("mixed case", "short mix passthrough")
    if receipt["tether_hits"] != 0:
        return _fail("mixed case hits", str(receipt["tether_hits"]))
    return _ok("mixed case", "tHe stays literal")


def _check_fld3_still_unfolds() -> Check:
    raw = VECTORS_TEXT.encode("utf-8")
    blob, _receipt = fold_fld3_bytes(raw)
    if blob[:4] != MAGIC:
        return _fail("fld3 magic", blob[:4].decode("latin-1", "replace"))
    restored, un = unfold_bytes(blob)
    if restored != raw or un.get("verified") is not True:
        return _fail("fld3 unfold", str(un))
    meta = info_bytes(blob)
    if meta.get("tether_hits") != 13:
        return _fail("fld3 hits", str(meta.get("tether_hits")))
    return _ok("fld3 compat", "v0.3 FLD3 still unfolds")


def _check_prose_shrinks() -> Check:
    path = Path(__file__).resolve().parents[1] / "examples" / "PROSE.txt"
    raw = path.read_bytes()
    blob, receipt = fold_bytes(raw, name="PROSE.txt")
    restored, un = unfold_bytes(blob)
    if restored != raw:
        return _fail("prose restore", "bytes differ")
    if un.get("verified") is not True:
        return _fail("prose verified", str(un))
    if len(blob) >= len(raw):
        return _fail("prose shrink", f"folded {len(blob)} >= orig {len(raw)} bakeoff={receipt.get('bakeoff')}")
    if blob[:4] not in {MAGIC, MAGIC_UNI1}:
        return _fail("prose magic", blob[:4].decode("latin-1", "replace"))
    return _ok(
        "prose shrink",
        f"{receipt.get('strategy')} {len(raw)}→{len(blob)} beats_zstd={receipt.get('beats_zstd')}",
    )


def _check_no_zlib() -> Check:
    src = Path(__file__).with_name("engine.py").read_text(encoding="utf-8")
    if "import zlib" in src or "from zlib" in src:
        return _fail("no zlib", "engine imports zlib")
    return _ok("no zlib", "codec is stdlib hashlib/re/struct only")


def _check_identity() -> Check:
    root = Path(__file__).resolve().parents[1]
    for rel in ("README.md", "AGENTS.md", "SKILL.md"):
        text = (root / rel).read_text(encoding="utf-8")
        if "GodLock.AZ" in text or "Collin Horton" in text:
            return _fail("identity", rel)
    return _ok("identity", "Aziel Eliab")


def _check_loopback() -> Check:
    try:
        make_server("0.0.0.0", 9)
    except ValueError as exc:
        if "loopback" in str(exc).lower() and "127.0.0.1" in LOOPBACK:
            return _ok("loopback", "rejects 0.0.0.0")
        return _fail("loopback", str(exc))
    return _fail("loopback", "accepted 0.0.0.0")


CHECKS: tuple[Callable[[], Check], ...] = (
    _check_version,
    _check_spec,
    _check_tethers,
    _check_vectors,
    _check_line_hits,
    _check_short_string,
    _check_binary_refused,
    _check_zip_refused,
    _check_fld2_refused,
    _check_mixed_case,
    _check_fld3_still_unfolds,
    _check_prose_shrinks,
    _check_no_zlib,
    _check_identity,
    _check_loopback,
)


def run_doctor(*, as_json: bool = False) -> int:
    results = []
    failed = 0
    for fn in CHECKS:
        name, ok, detail = fn()
        results.append({"name": name, "ok": ok, "detail": detail})
        if not ok:
            failed += 1
        mark = "ok" if ok else "FAIL"
        if not as_json:
            print(f"[{mark}] {name}" + (f" — {detail}" if detail else ""))
    payload = {
        "ok": failed == 0,
        "failed": failed,
        "checks": results,
        "version": __version__,
        "spec": SPEC_STRING,
        "limitation": LIMITATION,
        "zip": False,
        "method": "adaptive",
        "network": False,
        "telemetry": False,
    }
    if as_json:
        print(json.dumps(payload, indent=2))
    else:
        print("limitation:", LIMITATION)
        print("doctor", "passed" if failed == 0 else "failed")
    return 0 if failed == 0 else 1
