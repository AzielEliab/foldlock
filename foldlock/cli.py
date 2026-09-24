"""Command-line interface for FoldLock.

Human text is the default. Pass --json for the same receipt a script
already reads.

    foldlock
    foldlock fold INFILE [--out OUT.fld] [--json]
    foldlock unfold IN.fld [--out OUTFILE] [--json]
    foldlock info IN.fld [--json]
    foldlock ui
    foldlock doctor [--json]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Sequence

from foldlock import __version__
from foldlock.engine import fold, info, unfold
from foldlock.uni1 import FoldRefuse

TOP_HELP = f"""\
FoldLock makes a UTF-8 text file smaller when it can, then restores the same bytes.

Usage:
  foldlock
  foldlock <command> [options]

Common commands:
  fold <file>      Fold a text file. Leaves it unchanged when folding would not shrink it.
  unfold <file>    Restore the original bytes.
  info <file>      Show what a folded file contains.
  ui               Open the local app at http://127.0.0.1:8872/
  doctor           Check fold and restore on this machine.
  version          Print {__version__}.

Advanced:
  fold <file> --latin-pack
                   Also try the optional Latin peer pack.
  --json           Print the machine receipt (fold, unfold, info, doctor).
  ui --port <n>    Loopback only. Default port 8872.

Examples:
  foldlock ui
  foldlock fold notes.txt
  foldlock unfold notes.txt.fld
  foldlock fold notes.txt --json
  foldlock doctor

Author: Aziel Eliab
"""

WELCOME = """\
FoldLock makes a UTF-8 text file smaller when it can, then restores the same bytes.

Open the local app, or fold a text file you already have.

  foldlock ui
  foldlock fold notes.txt
  foldlock doctor
  foldlock --help
"""

_STRATEGY = {
    "passthrough": "left unchanged",
    "teth": "tether fold",
    "teth_peer": "tether fold with peer words",
    "sir": "structural fold",
    "bodyx": "mixed fold",
    "tether-suppression": "tether fold",
    "adaptive": "adaptive fold",
}


class HumanParser(argparse.ArgumentParser):
    def format_help(self) -> str:
        if getattr(self, "top_level", False):
            return TOP_HELP
        return super().format_help()

    def error(self, message: str) -> None:
        self.exit(2, _usage_error(self.prog, message) + "\n")


def _usage_error(prog: str, message: str) -> str:
    if "invalid choice" in message and "cmd" in message:
        parts = message.split("'")
        name = parts[1] if len(parts) >= 2 else "that"
        return f'Unknown command "{name}".\nTry:  foldlock ui    or    foldlock --help'
    if "required" in message and "src" in message:
        if prog.endswith(" unfold"):
            return "Unfold needs a folded file.\nTry:  foldlock unfold notes.txt.fld"
        if prog.endswith(" info"):
            return "Info needs a file.\nTry:  foldlock info notes.txt.fld"
        return "Fold needs a text file.\nTry:  foldlock fold notes.txt"
    if message.startswith("unrecognized arguments"):
        return f"{message}.\nTry:  foldlock --help"
    return f"{message}.\nTry:  foldlock --help"


def _json_parent() -> argparse.ArgumentParser:
    parent = argparse.ArgumentParser(add_help=False)
    parent.add_argument(
        "--json",
        action="store_true",
        dest="as_json",
        help="Print the machine receipt as JSON.",
    )
    return parent


def _build_parser() -> HumanParser:
    parser = HumanParser(prog="foldlock")
    parser.top_level = True
    parser.add_argument("--json", action="store_true", dest="as_json", help=argparse.SUPPRESS)
    sub = parser.add_subparsers(dest="cmd", required=False)

    fold_p = sub.add_parser(
        "fold",
        parents=[_json_parent()],
        help="Fold a text file.",
        description="Fold a UTF-8 text file. The file is left unchanged when folding would not shrink it.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example:\n  foldlock fold notes.txt\n  foldlock fold notes.txt --json",
    )
    fold_p.add_argument("src", help="UTF-8 text file to fold.")
    fold_p.add_argument("--out", help="Where to write the result. Default: INFILE.fld")
    fold_p.add_argument(
        "--latin-pack",
        action="store_true",
        help="Also try the optional Latin peer pack. Opcodes restore the original English words.",
    )

    unfold_p = sub.add_parser(
        "unfold",
        parents=[_json_parent()],
        help="Restore the original bytes.",
        description="Restore the original bytes when the size and SHA-256 match.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example:\n  foldlock unfold notes.txt.fld",
    )
    unfold_p.add_argument("src", help="Folded file, or a file that was left unchanged.")
    unfold_p.add_argument("--out", help="Where to write the restored bytes.")

    info_p = sub.add_parser(
        "info",
        parents=[_json_parent()],
        help="Show what a folded file contains.",
        description="Read the header. This does not restore the file.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example:\n  foldlock info notes.txt.fld",
    )
    info_p.add_argument("src", help="File to inspect.")

    ui_p = sub.add_parser(
        "ui",
        help="Open the local app.",
        description="Serve the local app on loopback only.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example:\n  foldlock ui\nThen open http://127.0.0.1:8872/",
    )
    ui_p.add_argument("--host", default="127.0.0.1", help="Loopback host (default 127.0.0.1).")
    ui_p.add_argument("--port", type=int, default=8872, help="Port (default 8872).")

    doc_p = sub.add_parser(
        "doctor",
        parents=[_json_parent()],
        help="Check fold and restore on this machine.",
        description="Run local checks. No network.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example:\n  foldlock doctor\n  foldlock doctor --json",
    )

    sub.add_parser("version", help=f"Print {__version__}.")
    return parser


def _print_obj(obj: object) -> None:
    sys.stdout.write(json.dumps(obj, indent=2, ensure_ascii=False, default=str) + "\n")


def _method_line(obj: dict) -> str:
    strategy = str(obj.get("strategy") or obj.get("method") or "")
    gloss = _STRATEGY.get(strategy, "")
    if not strategy:
        return ""
    if gloss and gloss != strategy:
        return f"  Method: {gloss} ({strategy})"
    return f"  Method: {strategy}"


def _print_fold(obj: dict) -> None:
    src = obj.get("in") or "input"
    dst = obj.get("out") or ""
    orig = obj.get("orig_size")
    folded = obj.get("folded_size")
    strategy = str(obj.get("strategy") or "")
    if obj.get("passthrough") or strategy == "passthrough":
        print(f"Left as-is: {src}")
        if orig is not None:
            print(f"  {orig} bytes. Folding would not make this smaller.")
    else:
        print(f"Folded {src}")
        if orig is not None and folded is not None:
            print(f"  {orig} bytes → {folded} bytes")
        line = _method_line(obj)
        if line:
            print(line)
    if dst:
        print(f"  Wrote {dst}")
        print(f"Next:  foldlock unfold {dst}")
    else:
        print("Next:  foldlock unfold FILE.fld")


def _print_unfold(obj: dict) -> None:
    src = obj.get("in") or "input"
    dst = obj.get("out") or ""
    print(f"Restored {src}")
    if dst:
        print(f"  Wrote {dst}")
    if obj.get("verified") is True:
        print("  Verified: size and SHA-256 match.")
    elif obj.get("verified") is False:
        print("  Verified: size or SHA-256 did not match.")
    line = _method_line(obj)
    if line:
        print(line)
    if dst:
        print(f"Next:  open {dst}")
    else:
        print("Next:  foldlock --help")


def _print_info(obj: dict) -> None:
    path = obj.get("file") or "file"
    magic = str(obj.get("magic") or "")
    kind = {
        "FLD3": "FLD3 container",
        "UNI1": "UNI1 container",
        "PASS": "original bytes, left unchanged",
    }.get(magic, magic or "unknown")
    print(path)
    print(f"  Kind: {kind}")
    line = _method_line(obj)
    if line:
        print(line)
    if obj.get("orig_size") is not None:
        print(f"  Original size: {obj['orig_size']} bytes")
    if obj.get("tether_hits") is not None:
        print(f"  Tether hits: {obj['tether_hits']}")
    if obj.get("orig_sha256"):
        print(f"  SHA-256: {obj['orig_sha256']}")
    print("Next:  foldlock unfold " + str(path))


def _plain_failure(cmd: str, exc: BaseException) -> str:
    if isinstance(exc, FileNotFoundError):
        target = exc.filename or "that path"
        return f'No file at "{target}".\nTry:  foldlock {cmd} notes.txt'
    if isinstance(exc, IsADirectoryError):
        target = getattr(exc, "filename", None) or "that path"
        return f'"{target}" is a directory.\nTry a text file:  foldlock fold notes.txt'
    if isinstance(exc, PermissionError):
        target = exc.filename or "that file"
        return f'Cannot read "{target}".\nCheck the file permission, then try again.'
    if isinstance(exc, OSError):
        return f"Could not read the file ({exc}).\nTry:  foldlock --help"
    reason = str(exc).strip() or "Something went wrong."
    low = reason.lower()
    if "already-compressed" in low or "compressed input" in low:
        return (
            "That file is already compressed, so FoldLock did not fold it.\n"
            "Try a UTF-8 text file:  foldlock fold notes.txt"
        )
    if "binary" in low or "utf-8" in low:
        return (
            "That file is not UTF-8 text, so FoldLock did not fold it.\n"
            "Try a UTF-8 text file:  foldlock fold notes.txt"
        )
    if "fld2" in low:
        return (
            "That file uses the retired FLD2 wrapper. Fold the original text again.\n"
            "Try:  foldlock fold notes.txt"
        )
    nxt = {
        "fold": "Try:  foldlock fold notes.txt    or    foldlock --help",
        "unfold": "Try:  foldlock unfold notes.txt.fld    or    foldlock --help",
        "info": "Try:  foldlock info notes.txt.fld    or    foldlock --help",
    }.get(cmd, "Try:  foldlock --help")
    return f"{reason}\n{nxt}"


def _run(argv: Sequence[str] | None) -> int:
    if argv is None:
        args_list = sys.argv[1:]
    else:
        args_list = list(argv)
    if not args_list:
        sys.stdout.write(WELCOME)
        return 0

    parser = _build_parser()
    args = parser.parse_args(args_list)

    if not args.cmd:
        if getattr(args, "as_json", False):
            _print_obj(
                {
                    "product": "foldlock",
                    "version": __version__,
                    "commands": ["fold", "unfold", "info", "ui", "doctor", "version"],
                }
            )
        else:
            sys.stdout.write(WELCOME)
        return 0

    if args.cmd == "version":
        print(f"foldlock {__version__}")
        return 0

    if args.cmd == "doctor":
        from foldlock.doctor import run_doctor

        return run_doctor(as_json=bool(args.as_json))

    if args.cmd == "ui":
        from foldlock.ui import serve

        try:
            serve(host=args.host, port=args.port)
        except ValueError as exc:
            print(f"{exc}\nTry:  foldlock ui", file=sys.stderr)
            return 1
        return 0

    as_json = bool(getattr(args, "as_json", False))
    try:
        if args.cmd == "fold":
            src = Path(args.src)
            dst = Path(args.out) if args.out else Path(str(src) + ".fld")
            receipt = fold(src, dst, latin_pack=bool(getattr(args, "latin_pack", False)))
            if as_json:
                _print_obj(receipt)
            else:
                _print_fold(receipt)
            return 0
        if args.cmd == "unfold":
            src = Path(args.src)
            if args.out:
                dst = Path(args.out)
            elif src.name.endswith(".fld"):
                dst = src.with_name(src.name[:-4])
            else:
                dst = Path(str(src) + ".out")
            receipt = unfold(src, dst)
            if as_json:
                _print_obj(receipt)
            else:
                _print_unfold(receipt)
            return 0
        if args.cmd == "info":
            receipt = info(Path(args.src))
            if as_json:
                _print_obj(receipt)
            else:
                _print_info(receipt)
            return 0
    except (OSError, ValueError, FoldRefuse) as exc:
        print(_plain_failure(args.cmd, exc), file=sys.stderr)
        return 1

    parser.error(f"unknown command {args.cmd}")
    return 2


def main(argv: Sequence[str] | None = None) -> int:
    try:
        return _run(argv)
    except SystemExit as exc:
        code = exc.code
        if code is None:
            return 0
        if isinstance(code, int):
            return code
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
