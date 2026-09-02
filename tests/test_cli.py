"""CLI fold/unfold/info/version."""

from __future__ import annotations

import json
from pathlib import Path

from foldlock.cli import main
from foldlock.engine import VECTORS_SHA256


def test_cli_fold_unfold_info(tmp_path: Path, capsys) -> None:
    src = tmp_path / "VECTORS.txt"
    src.write_bytes(
        b"the cat and the dog\nAs is has to and or etc.\nand and and\nhello\n"
    )
    fld = tmp_path / "v.fld"
    out = tmp_path / "v.out"
    assert main(["fold", str(src), "--out", str(fld)]) == 0
    fold_out = json.loads(capsys.readouterr().out)
    assert fold_out["zip"] is False
    assert fold_out["orig_sha256"] == VECTORS_SHA256
    assert main(["unfold", str(fld), "--out", str(out)]) == 0
    un = json.loads(capsys.readouterr().out)
    assert un["verified"] is True
    assert un["zip"] is False
    assert out.read_bytes() == src.read_bytes()
    assert main(["info", str(fld)]) == 0
    info = json.loads(capsys.readouterr().out)
    assert info["magic"] == "FLD3"
    assert info["zip"] is False
    assert info["tether_hits"] == 13


def test_cli_version(capsys) -> None:
    assert main(["version"]) == 0
    assert "0.3.0" in capsys.readouterr().out


def test_cli_refuse_binary(tmp_path: Path) -> None:
    blob = tmp_path / "x.bin"
    blob.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\xff" * 8)
    assert main(["fold", str(blob), "--out", str(tmp_path / "x.fld")]) == 1
