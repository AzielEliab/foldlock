"""UNI1 adaptive shell: short-string floor, refuse compressed, prose restore."""

from __future__ import annotations

from pathlib import Path

import pytest

from foldlock.classify import KIND_CODE, KIND_COMPRESSED, KIND_MARKUP, KIND_PROSE, classify
from foldlock.engine import MAGIC, MAGIC_UNI1, fold_bytes, unfold_bytes, verify_bytes
from foldlock.uni1 import FoldRefuse

ROOT = Path(__file__).resolve().parents[1]
PROSE = (ROOT / "examples" / "PROSE.txt").read_bytes()


def test_short_string_does_not_grow() -> None:
    for raw in (b"hi", b"hello", b"ok", b"a"):
        blob, receipt = fold_bytes(raw, name="short.txt")
        assert blob == raw
        assert receipt["strategy"] == "passthrough"
        assert receipt["folded_size"] == len(raw)
        assert receipt["grew"] is False
        restored, un = unfold_bytes(blob)
        assert restored == raw
        assert un["verified"] is True
        assert un["zip"] is False


def test_refuse_png_fixture() -> None:
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    with pytest.raises(FoldRefuse, match="compress|png|zip"):
        fold_bytes(png, name="fixture.png")
    assert classify(png, "fixture.png").kind == KIND_COMPRESSED


def test_refuse_zip_fixture() -> None:
    zipped = b"PK\x03\x04" + b"not a real zip but magic is enough"
    with pytest.raises(FoldRefuse, match="compress|zip"):
        fold_bytes(zipped, name="fixture.zip")
    assert classify(zipped, "fixture.zip").kind == KIND_COMPRESSED


def test_prose_shrinks_and_restores() -> None:
    blob, receipt = fold_bytes(PROSE, name="PROSE.txt")
    assert receipt["zip"] is False
    assert receipt["class"] == KIND_PROSE
    assert receipt["folded_size"] < len(PROSE)
    assert blob[:4] in {MAGIC, MAGIC_UNI1}
    assert receipt["strategy"] in {"sir", "teth", "teth_peer", "bodyx"}
    restored, un = unfold_bytes(blob)
    assert restored == PROSE
    assert un["verified"] is True
    verify = verify_bytes(PROSE, restored)
    assert verify["ok"] is True
    assert "beats_zstd" in receipt
    if receipt["zstd_available"]:
        assert receipt["beats_zstd"] in {True, False}


def test_code_often_passthrough_or_teth() -> None:
    src = b"def foo(x):\n    return x + 1\n"
    blob, receipt = fold_bytes(src, name="foo.py")
    assert receipt["class"] == KIND_CODE
    assert receipt["folded_size"] <= len(src)
    restored, un = unfold_bytes(blob)
    assert restored == src
    assert un["verified"] is True


def test_json_often_passthrough() -> None:
    raw = b'{"a": 1, "b": 2}'
    blob, receipt = fold_bytes(raw, name="x.json")
    assert receipt["class"] == KIND_MARKUP
    assert blob == raw
    assert receipt["strategy"] == "passthrough"
    restored, _ = unfold_bytes(blob)
    assert restored == raw


def test_latin_pack_optional_exact_restore() -> None:
    blob, receipt = fold_bytes(PROSE, name="PROSE.txt", latin_pack=True)
    restored, un = unfold_bytes(blob)
    assert restored == PROSE
    assert un["verified"] is True
    assert receipt.get("latin_pack") is True or receipt["strategy"] == "teth"


def test_abbrev_and_numbers_roundtrip() -> None:
    text = (
        "The dept and the dept sent 12000 and 12000 and approx 15 and approx 15 "
        "for the year 1999 and the year 1999 of the people and the people.\n"
    ) * 8
    raw = text.encode("utf-8")
    blob, receipt = fold_bytes(raw, name="counts.txt")
    restored, un = unfold_bytes(blob)
    assert restored == raw
    assert un["verified"] is True
    assert receipt["folded_size"] <= len(raw)
    if receipt["strategy"] == "sir":
        assert receipt["abbrev_hits"] + receipt["number_hits"] + receipt["local_hits"] >= 0


def test_classify_extension_and_sniff() -> None:
    assert classify(b"hello world", "n.md").kind == KIND_PROSE
    assert classify(b"def foo():\n    return 1\n", "n.py").kind == KIND_CODE
    assert classify(b'{"ok": true}', "n.json").kind == KIND_MARKUP
    assert classify(b"\x89PNG\r\n\x1a\nxxxx", "n.bin").kind == KIND_COMPRESSED
