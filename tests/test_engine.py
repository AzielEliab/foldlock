"""FoldLock v0.8 UNI1 codec tests. Paper FL-WP-0.8; TETH-1 from FL-WP-0.3."""

from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from foldlock.engine import (
    TETHERS,
    VECTORS_ORIG_SIZE,
    VECTORS_SHA256,
    VECTORS_TEXT,
    fold_bytes,
    fold_fld3_bytes,
    info_bytes,
    suppress,
    unfold_bytes,
)
from foldlock.uni1 import FoldRefuse

VECTORS_PATH = Path(__file__).resolve().parents[1] / "examples" / "VECTORS.txt"
PROSE_PATH = Path(__file__).resolve().parents[1] / "examples" / "PROSE.txt"


def test_tethers_table() -> None:
    assert len(TETHERS) == 112
    assert list(TETHERS[:7]) == ["as", "is", "has", "to", "and", "or", "etc"]
    assert TETHERS[79] == "she"
    assert TETHERS[80] == "her"
    assert TETHERS[81] == "they"
    assert TETHERS[111] == "etcetera"


def test_vectors_file_exact() -> None:
    raw = VECTORS_PATH.read_bytes()
    assert raw == VECTORS_TEXT.encode("utf-8")
    assert raw.decode("utf-8").splitlines() == [
        "the cat and the dog",
        "As is has to and or etc.",
        "and and and",
        "hello",
    ]
    assert len(raw) == VECTORS_ORIG_SIZE == 63
    assert hashlib.sha256(raw).hexdigest() == VECTORS_SHA256
    assert VECTORS_SHA256 == "1db33c4dc38d08b3d29f77f75e15b598e3805a7dde18a7a122b9f257369f4ba1"


def test_vectors_roundtrip() -> None:
    raw = VECTORS_PATH.read_bytes()
    blob, receipt = fold_bytes(raw, name="VECTORS.txt")
    assert receipt["zip"] is False
    assert receipt["orig_size"] == 63
    assert receipt["orig_sha256"] == VECTORS_SHA256
    assert receipt["folded_size"] <= len(raw)
    assert receipt.get("grew") is False
    restored, un = unfold_bytes(blob)
    assert un["verified"] is True
    assert un["zip"] is False
    assert restored == raw
    assert hashlib.sha256(restored).hexdigest() == VECTORS_SHA256


def test_line_hits() -> None:
    expect = {
        "the cat and the dog": 3,
        "As is has to and or etc.": 7,
        "and and and": 3,
        "hello": 0,
    }
    for line, hits in expect.items():
        _body, stats = suppress(line + "\n")
        assert stats["tether_hits"] == hits, line


def test_refuse_binary() -> None:
    png = b"\x89PNG\r\n\x1a\n" + b"\x00\x01\x02\x03" * 8
    with pytest.raises((ValueError, FoldRefuse), match="Binary|UTF-8|zip|compress|png"):
        fold_bytes(png, name="x.png")


def test_refuse_zip_magic() -> None:
    zipped = b"PK\x03\x04" + b"hello text payload that is valid utf-8"
    with pytest.raises((ValueError, FoldRefuse), match="compress|zip"):
        fold_bytes(zipped, name="x.zip")


def test_refuse_fld2() -> None:
    fake = b"FLD2" + b"\x00" * 80
    with pytest.raises(ValueError, match="FLD2"):
        unfold_bytes(fake)


def test_mixed_case_literal() -> None:
    raw = b"tHe"
    blob, receipt = fold_bytes(raw, name="mix.txt")
    assert receipt["folded_size"] <= len(raw)
    restored, un = unfold_bytes(blob)
    assert restored == raw
    assert un["verified"] is True


def test_fld3_compat_vectors() -> None:
    raw = VECTORS_PATH.read_bytes()
    blob, _receipt = fold_fld3_bytes(raw)
    assert blob[:4] == b"FLD3"
    meta = info_bytes(blob)
    assert meta["magic"] == "FLD3"
    assert meta["zip"] is False
    assert meta["tether_hits"] == 13
    restored, un = unfold_bytes(blob)
    assert restored == raw
    assert un["verified"] is True


def test_no_zlib_in_engine() -> None:
    src = Path(__file__).resolve().parents[1] / "foldlock" / "engine.py"
    text = src.read_text(encoding="utf-8")
    assert "import zlib" not in text
    assert "from zlib" not in text


def test_identity_not_godlock_az() -> None:
    root = Path(__file__).resolve().parents[1]
    for path in [
        root / "README.md",
        root / "AGENTS.md",
        root / "foldlock" / "web" / "index.html",
        root / "SKILL.md",
    ]:
        if path.is_file():
            text = path.read_text(encoding="utf-8")
            assert "GodLock.AZ" not in text
            assert "Collin Horton" not in text
