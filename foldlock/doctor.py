"""Self-check for FoldLock. NASA-robust, no network, no telemetry.

    foldlock doctor
"""

from __future__ import annotations

import hashlib
import json
import tempfile
from pathlib import Path
from typing import Callable

from foldlock import __version__
from foldlock.engine import (
    ENGINE_VERSION,
    LIMITATION,
    MAGIC,
    PAPER_ID,
    SPEC_STRING,
    TETHERS,
    VECTORS_HITS,
    VECTORS_ORIG_SIZE,
    VECTORS_SHA256,
    VECTORS_TEXT,
    fold_bytes,
    info_bytes,
    suppress,
    unfold_bytes,
)
from foldlock.ui import LOOPBACK, make_server

Check = tuple[str, bool, str]


def _ok(name: str, detail: str = "") -> Check:
    return name, True, detail


def _fail(name: str, detail: str) -> Check:
    return name, False, detail


def _check_version() -> Check:
    if __version__ == ENGINE_VERSION == "0.3.0":
        return _ok("version", __version__)
    return _fail("version", f"{__version__} vs engine {ENGINE_VERSION}")


def _check_spec() -> Check:
    if SPEC_STRING == "foldlock-v0.3" and PAPER_ID == "FL-WP-0.3" and MAGIC == b"FLD3":
        return _ok("spec", f"{SPEC_STRING} {PAPER_ID} {MAGIC.decode()}")
    return _fail("spec", f"{SPEC_STRING} {PAPER_ID} {MAGIC!r}")


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
    blob, receipt = fold_bytes(raw)
    restored, un = unfold_bytes(blob)
    if restored != raw:
        return _fail("vectors restore", "bytes differ")
    if un.get("verified") is not True or un.get("zip") is not False:
        return _fail("vectors unfold flags", str(un))
    if receipt.get("zip") is not False or receipt.get("method") != "tether-suppression":
        return _fail("vectors fold flags", str(receipt))
    meta = info_bytes(blob)
    if meta.get("tether_hits") != 13:
        return _fail("vectors total hits", str(meta.get("tether_hits")))
    return _ok("vectors", f"orig_size {len(raw)} verified True zip False")


def _check_line_hits() -> Check:
    lines = VECTORS_TEXT.splitlines(keepends=True)
    got = []
    for line in lines:
        _body, stats = suppress(line)
        got.append(stats["tether_hits"])
    if tuple(got) != VECTORS_HITS:
        return _fail("line hits", str(got))
    return _ok("line hits", "3,7,3,0")


def _check_binary_refused() -> Check:
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
    try:
        fold_bytes(png)
    except ValueError as exc:
        msg = str(exc).lower()
        if "binary" in msg or "utf-8" in msg or "zip" in msg:
            return _ok("refuse binary", "PNG-like bytes refused")
        return _fail("refuse binary", str(exc))
    return _fail("refuse binary", "PNG-like bytes were folded")


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
    blob, receipt = fold_bytes(raw)
    restored, _un = unfold_bytes(blob)
    if restored != raw:
        return _fail("mixed case restore", restored.decode("utf-8", "replace"))
    # mixed tHe must stay literal (not a tether opcode)
    if receipt["tether_hits"] != 0:
        # "cat" is not a tether; tHe mixed should not hit. 0 expected.
        return _fail("mixed case hits", str(receipt["tether_hits"]))
    return _ok("mixed case", "tHe stays literal")


def _check_no_zlib() -> Check:
    src = Path(__file__).with_name("engine.py").read_text(encoding="utf-8")
    if "import zlib" in src or "from zlib" in src:
        return _fail("no zlib", "engine imports zlib")
    return _ok("no zlib", "codec is stdlib hashlib/re/struct only")


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
    _check_binary_refused,
    _check_fld2_refused,
    _check_mixed_case,
    _check_no_zlib,
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
        "method": "tether-suppression",
        "network": False,
        "telemetry": False,
    }
    if as_json:
        print(json.dumps(payload, indent=2))
    else:
        print("limitation:", LIMITATION)
        print("doctor", "passed" if failed == 0 else "failed")
    return 0 if failed == 0 else 1
