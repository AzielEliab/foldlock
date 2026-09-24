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
    assert main(["fold", "--json", str(src), "--out", str(fld)]) == 0
    fold_out = json.loads(capsys.readouterr().out)
    assert fold_out["zip"] is False
    assert fold_out["orig_sha256"] == VECTORS_SHA256
    assert main(["unfold", "--json", str(fld), "--out", str(out)]) == 0
    un = json.loads(capsys.readouterr().out)
    assert un["verified"] is True
    assert un["zip"] is False
    assert out.read_bytes() == src.read_bytes()
    assert main(["info", "--json", str(fld)]) == 0
    info = json.loads(capsys.readouterr().out)
    assert info["magic"] in {"FLD3", "UNI1", "PASS"}
    assert info["zip"] is False
    assert fold_out["folded_size"] <= fold_out["orig_size"]


def test_cli_version(capsys) -> None:
    assert main(["version"]) == 0
    assert "0.8.0" in capsys.readouterr().out


def test_cli_refuse_binary(tmp_path: Path) -> None:
    blob = tmp_path / "x.bin"
    blob.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\xff" * 8)
    assert main(["fold", str(blob), "--out", str(tmp_path / "x.fld")]) == 1


def test_cli_refuse_zip(tmp_path: Path) -> None:
    blob = tmp_path / "x.zip"
    blob.write_bytes(b"PK\x03\x04" + b"hello")
    assert main(["fold", str(blob), "--out", str(tmp_path / "x.fld")]) == 1


def test_cli_prose_roundtrip(tmp_path: Path, capsys) -> None:
    src = Path(__file__).resolve().parents[1] / "examples" / "PROSE.txt"
    fld = tmp_path / "p.fld"
    out = tmp_path / "p.out"
    assert main(["fold", "--json", str(src), "--out", str(fld)]) == 0
    fold_out = json.loads(capsys.readouterr().out)
    assert fold_out["zip"] is False
    assert fold_out["folded_size"] < fold_out["orig_size"]
    assert main(["unfold", "--json", str(fld), "--out", str(out)]) == 0
    un = json.loads(capsys.readouterr().out)
    assert un["verified"] is True
    assert out.read_bytes() == src.read_bytes()


def test_cli_welcome_help_and_errors(tmp_path: Path, capsys) -> None:
    assert main([]) == 0
    welcome = capsys.readouterr().out
    assert "foldlock ui" in welcome
    assert "required" not in welcome.lower()

    assert main(["--help"]) == 0
    help_out = capsys.readouterr().out
    assert "Examples:" in help_out
    assert "foldlock fold notes.txt" in help_out
    assert "THIS IS NOT" not in help_out

    assert main(["fold", "--help"]) == 0
    assert "notes.txt" in capsys.readouterr().out

    assert main(["bogus"]) == 2
    err = capsys.readouterr().err
    assert 'Unknown command "bogus"' in err
    assert "foldlock --help" in err
    assert "Traceback" not in err

    missing = tmp_path / "nope.txt"
    assert main(["fold", str(missing)]) == 1
    missing_err = capsys.readouterr().err
    assert "No file" in missing_err
    assert "Try:" in missing_err
    assert "Traceback" not in missing_err

    blob = tmp_path / "x.png"
    blob.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\xff" * 8)
    assert main(["fold", str(blob)]) == 1
    png_err = capsys.readouterr().err
    assert "compressed" in png_err.lower()
    assert "Try" in png_err
    assert "Traceback" not in png_err


def test_cli_human_fold_is_not_json(tmp_path: Path, capsys) -> None:
    src = tmp_path / "note.txt"
    src.write_text("the cat and the dog and the cat\n" * 8, encoding="utf-8")
    fld = tmp_path / "note.fld"
    assert main(["fold", str(src), "--out", str(fld)]) == 0
    out = capsys.readouterr().out
    assert not out.lstrip().startswith("{")
    assert "bytes" in out
    assert "Next:" in out
    assert fld.is_file()
