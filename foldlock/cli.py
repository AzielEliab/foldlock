"""Command-line interface for FoldLock.

    python3 foldlock.py fold INFILE [--out OUT.fld]
    python3 foldlock.py unfold IN.fld [--out OUTFILE]
    python3 foldlock.py info IN.fld
    foldlock ui
    foldlock doctor
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Sequence

from foldlock import __version__
from foldlock.engine import LIMITATION, fold, info, unfold
from foldlock.uni1 import FoldRefuse


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="foldlock",
        description="FoldLock v0.8 UNI1 — SOTA zip-class compression engine for UTF-8 text.",
        epilog=LIMITATION,
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    f = sub.add_parser("fold", help="Adaptive fold. Passthrough if it would grow. Refuses compressed.")
    f.add_argument("src")
    f.add_argument("--out")
    f.add_argument(
        "--latin-pack",
        action="store_true",
        help="Optional Latin peer pack (opcodes restore English; never translate-then-fold).",
    )

    u = sub.add_parser("unfold", help="Restore original bytes. Refuses unless size and SHA-256 match.")
    u.add_argument("src")
    u.add_argument("--out")

    i = sub.add_parser("info", help="Read header and count tether opcodes. Does not unfold.")
    i.add_argument("src")

    p_ui = sub.add_parser("ui", help="Serve the local UI on 127.0.0.1:8872 (loopback only).")
    p_ui.add_argument("--host", default="127.0.0.1", help="Loopback host (default 127.0.0.1).")
    p_ui.add_argument("--port", type=int, default=8872, help="Port (default 8872).")

    p_doc = sub.add_parser("doctor", help="Self-check: codec, vectors, loopback. No network.")
    p_doc.add_argument("--json", action="store_true", dest="as_json", help="Print doctor results as JSON.")

    sub.add_parser("version", help="Print package version.")
    return parser


def _print_obj(obj: object) -> None:
    sys.stdout.write(json.dumps(obj, indent=2, ensure_ascii=False, default=str) + "\n")


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)

    if args.cmd == "version":
        print(f"foldlock {__version__}")
        return 0

    if args.cmd == "doctor":
        from foldlock.doctor import run_doctor

        return run_doctor(as_json=args.as_json)

    if args.cmd == "ui":
        from foldlock.ui import serve

        serve(host=args.host, port=args.port)
        return 0

    try:
        if args.cmd == "fold":
            src = Path(args.src)
            dst = Path(args.out) if args.out else Path(str(src) + ".fld")
            _print_obj(fold(src, dst, latin_pack=bool(getattr(args, "latin_pack", False))))
            return 0
        if args.cmd == "unfold":
            src = Path(args.src)
            if args.out:
                dst = Path(args.out)
            elif src.name.endswith(".fld"):
                dst = src.with_name(src.name[:-4])
            else:
                dst = Path(str(src) + ".out")
            _print_obj(unfold(src, dst))
            return 0
        if args.cmd == "info":
            _print_obj(info(Path(args.src)))
            return 0
    except (ValueError, FoldRefuse) as e:
        print(f"foldlock: {e}", file=sys.stderr)
        return 1

    parser.error(f"unknown command {args.cmd}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
