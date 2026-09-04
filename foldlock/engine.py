#!/usr/bin/env python3
"""FoldLock v0.8 UNI1 — adaptive tether/SIR fold. Not a zip wrapper.

Python 3 stdlib only in this module (hashlib, re, struct). No zlib for the fold.

Author: Aziel Eliab, 2026. Apache-2.0.
"""

from __future__ import annotations

import hashlib
import re
import struct
from pathlib import Path

ENGINE_VERSION = "0.8.0"
SPEC_STRING = "foldlock-v0.8-UNI1"
PAPER_ID = "FL-WP-0.8"
REPRO_PAPER_ID = "FL-WP-0.8-R"
METHOD_PAPER_ID = "FL-WP-0.3"

LIMITATION = (
    "THIS IS: adaptive reversible fold on UTF-8 text (UNI1 champion shell); "
    "tether-word suppression (TETH/FLD4) and structural SIR/FLD5 with optional "
    "dictionary, abbreviation, number, and peer packs; exact restore of the "
    "original bytes; short strings left alone; already-compressed input refused. "
    "THIS IS NOT: zip/zlib/gzip/DEFLATE/zstd/lzma; a claim every file shrinks "
    "or that FoldLock beats zstd on all files; a universal compressor; "
    "translation of all inputs to Latin; encryption; UL; EmployeeLock; "
    "TemporalLock; GodLock; a published industry bake-off. "
    "Prose/text is the win lane. Code and markup often passthrough. "
    "Ratios are receipts not trophies. beats_zstd is per-file when zstd is "
    "available, never a global championship."
)

MAGIC = b"FLD3"
MAGIC_UNI1 = b"UNI1"
MAGIC_RETIRED = b"FLD2"
LEXICON_ID = 1
HEADER = "<4sBBQ32s"  # magic, lexicon_id, reserved, orig_size, orig_sha256
# on disk: header || body_len_u64 || body
ONDISK = "<4sBBQ32sQ"

# Stable IDs. Do not reorder. Append only. Unfold uses the same table.
# Core tethers named by the operator, then the surrounding function-word net
# that makes suppression a real fold instead of a slogan.
# TETH-1 IDs 0..111. Source of truth: Appendix A of FL-WP-0.3.
TETHERS: tuple[str, ...] = (
    "as",
    "is",
    "has",
    "to",
    "and",
    "or",
    "etc",
    "the",
    "a",
    "an",
    "of",
    "in",
    "on",
    "for",
    "with",
    "at",
    "by",
    "from",
    "into",
    "onto",
    "upon",
    "it",
    "its",
    "be",
    "am",
    "are",
    "was",
    "were",
    "been",
    "being",
    "have",
    "had",
    "having",
    "do",
    "does",
    "did",
    "doing",
    "will",
    "would",
    "shall",
    "should",
    "can",
    "could",
    "may",
    "might",
    "must",
    "not",
    "no",
    "nor",
    "but",
    "if",
    "then",
    "than",
    "so",
    "too",
    "that",
    "this",
    "these",
    "those",
    "which",
    "who",
    "whom",
    "whose",
    "what",
    "when",
    "where",
    "why",
    "how",
    "i",
    "me",
    "my",
    "we",
    "us",
    "our",
    "you",
    "your",
    "he",
    "him",
    "his",
    "she",
    "her",
    "they",
    "them",
    "their",
    "all",
    "any",
    "each",
    "every",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "also",
    "just",
    "only",
    "even",
    "up",
    "out",
    "off",
    "over",
    "under",
    "here",
    "there",
    "both",
    "same",
    "own",
    "per",
    "via",
    "vs",
    "etcetera",
)

assert len(TETHERS) <= 255
assert len(TETHERS) == 112
TETHER_INDEX = {w: i for i, w in enumerate(TETHERS)}

# shape in low 2 bits of marker
SHAPE_BARE = 0
SHAPE_LEAD = 1  # " word"
SHAPE_TRAIL = 2  # "word "
SHAPE_BOTH = 3  # " word "
# case in next 2 bits
CASE_LOWER = 0
CASE_TITLE = 1
CASE_UPPER = 2
CASE_MIXED = 3  # treat as literal instead

ESC = 0xFF  # 0xFF 0xFF = literal 0xFF; 0xFF marker id = tether

TOKEN_RE = re.compile(r"[A-Za-z]+|[^A-Za-z]+")

VECTORS_TEXT = "the cat and the dog\nAs is has to and or etc.\nand and and\nhello\n"
VECTORS_SHA256 = "1db33c4dc38d08b3d29f77f75e15b598e3805a7dde18a7a122b9f257369f4ba1"
VECTORS_ORIG_SIZE = 63
VECTORS_HITS = (3, 7, 3, 0)


def _case_code(word: str) -> int | None:
    if word.islower():
        return CASE_LOWER
    if word.isupper():
        return CASE_UPPER
    if word[:1].isupper() and word[1:].islower():
        return CASE_TITLE
    return None


def _apply_case(base: str, case: int) -> str:
    if case == CASE_LOWER:
        return base
    if case == CASE_UPPER:
        return base.upper()
    if case == CASE_TITLE:
        return base[:1].upper() + base[1:]
    raise ValueError("mixed case is not a tether opcode")


def suppress(text: str) -> tuple[bytes, dict]:
    """Reversible tether suppression. Exact restore. No zip."""
    tokens = TOKEN_RE.findall(text)
    out = bytearray()
    tether_hits = 0
    tether_bytes_saved = 0

    def emit_lit_bytes(raw: bytes) -> None:
        for b in raw:
            out.append(b)
            if b == ESC:
                out.append(ESC)

    i = 0
    n = len(tokens)
    prev_took_trail_space = False
    while i < n:
        tok = tokens[i]
        key = tok.lower()
        if tok.isalpha() and key in TETHER_INDEX:
            case = _case_code(tok)
            if case is None:
                emit_lit_bytes(tok.encode("utf-8"))
                prev_took_trail_space = False
                i += 1
                continue
            lead = (not prev_took_trail_space) and i > 0 and tokens[i - 1] == " "
            trail = i + 1 < n and tokens[i + 1] == " "
            # only eat spaces that are exactly one ASCII space
            shape = SHAPE_BARE
            take_lead = False
            take_trail = False
            if lead and trail:
                shape = SHAPE_BOTH
                take_lead = True
                take_trail = True
            elif lead:
                shape = SHAPE_LEAD
                take_lead = True
            elif trail:
                shape = SHAPE_TRAIL
                take_trail = True
            if take_lead and out.endswith(b" "):
                del out[-1]
            elif take_lead and out:
                # last emitted byte is not a pending space we can steal
                shape = SHAPE_TRAIL if take_trail else SHAPE_BARE
                take_lead = False
            out.append(ESC)
            out.append((case << 2) | shape)
            out.append(TETHER_INDEX[key])
            tether_hits += 1
            original = (" " if take_lead else "") + tok + (" " if take_trail else "")
            tether_bytes_saved += len(original.encode("utf-8")) - 3
            i += 1
            if take_trail:
                i += 1
            prev_took_trail_space = take_trail
            continue
        emit_lit_bytes(tok.encode("utf-8"))
        prev_took_trail_space = False
        i += 1
    stats = {
        "tether_hits": tether_hits,
        "tether_bytes_saved": tether_bytes_saved,
        "lexicon": f"TETH-{LEXICON_ID}",
        "tether_words": len(TETHERS),
    }
    return bytes(out), stats


def expand(body: bytes) -> str:
    raw_out = bytearray()
    i = 0
    n = len(body)
    while i < n:
        b = body[i]
        i += 1
        if b != ESC:
            raw_out.append(b)
            continue
        if i >= n:
            raise ValueError("truncated escape")
        nxt = body[i]
        i += 1
        if nxt == ESC:
            raw_out.append(ESC)
            continue
        if i >= n:
            raise ValueError("truncated tether id")
        wid = body[i]
        i += 1
        marker = nxt
        if wid >= len(TETHERS):
            raise ValueError(f"tether id {wid} not in TETH-{LEXICON_ID}")
        case = (marker >> 2) & 0x03
        shape = marker & 0x03
        if case == CASE_MIXED:
            raise ValueError("mixed-case tether opcode is illegal")
        word = _apply_case(TETHERS[wid], case)
        if shape == SHAPE_LEAD:
            word = " " + word
        elif shape == SHAPE_TRAIL:
            word = word + " "
        elif shape == SHAPE_BOTH:
            word = " " + word + " "
        raw_out.extend(word.encode("utf-8"))
    return raw_out.decode("utf-8")


def _receipt_from_raw(raw: bytes, body: bytes, stats: dict) -> dict:
    header_len = struct.calcsize(ONDISK)
    folded_size = header_len + len(body)
    digest = hashlib.sha256(raw).hexdigest()
    return {
        "method": "tether-suppression",
        "lexicon": stats["lexicon"],
        "tether_words": stats["tether_words"],
        "tether_hits": stats["tether_hits"],
        "tether_bytes_saved": stats["tether_bytes_saved"],
        "orig_size": len(raw),
        "folded_size": folded_size,
        "body_size": len(body),
        "orig_sha256": digest,
        "ratio": (folded_size / len(raw)) if raw else 0.0,
        "zip": False,
        "version": ENGINE_VERSION,
        "spec": SPEC_STRING,
        "paper": PAPER_ID,
        "limitation": LIMITATION,
        "magic": "FLD3",
        "strategy": "teth",
        "method": "tether-suppression",
    }


def pack_fld3(raw: bytes, body: bytes, stats: dict) -> bytes:
    """Wrap a TETH stream in an FLD3 container."""
    digest = hashlib.sha256(raw).digest()
    header = struct.pack(ONDISK, MAGIC, LEXICON_ID, 0, len(raw), digest, len(body))
    return header + body


def fold_fld3_bytes(raw: bytes) -> tuple[bytes, dict]:
    """Always emit FLD3 (may grow). Used for bakeoff and FLD3 vectors."""
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as e:
        raise ValueError(
            "FoldLock v0.8 folds UTF-8 text by tether suppression. "
            "Binary input is refused. This is not a zip wrapper."
        ) from e
    body, stats = suppress(text)
    blob = pack_fld3(raw, body, stats)
    receipt = _receipt_from_raw(raw, body, stats)
    return blob, receipt


def fold_bytes(raw: bytes, *, name: str = "", latin_pack: bool = False) -> tuple[bytes, dict]:
    """Adaptive fold. Refuse compressed. Passthrough if the fold would grow."""
    from foldlock.uni1 import fold_adaptive

    return fold_adaptive(raw, name=name, latin_pack=latin_pack)


def fold(src: Path, dst: Path, *, latin_pack: bool = False) -> dict:
    raw = src.read_bytes()
    blob, receipt = fold_bytes(raw, name=src.name, latin_pack=latin_pack)
    dst.write_bytes(blob)
    receipt["in"] = str(src)
    receipt["out"] = str(dst)
    return receipt


def read_container(blob: bytes) -> tuple[dict, bytes]:
    n = struct.calcsize(ONDISK)
    if len(blob) >= 4 and blob[:4] == MAGIC_RETIRED:
        raise ValueError("FLD2 (zlib wrapper) is retired. Refold with FoldLock v0.8.")
    if len(blob) < n:
        raise ValueError("file too short for FoldLock FLD3 header")
    magic, lex, _res, orig_size, digest, body_len = struct.unpack(ONDISK, blob[:n])
    if magic != MAGIC:
        raise ValueError("not a FoldLock FLD3 file")
    if lex != LEXICON_ID:
        raise ValueError(f"unsupported lexicon {lex}")
    body = blob[n:]
    if len(body) != body_len:
        raise ValueError(f"body length mismatch: header {body_len} file {len(body)}")
    return {
        "lexicon": f"TETH-{lex}",
        "orig_size": orig_size,
        "body_size": body_len,
        "orig_sha256": digest.hex(),
        "digest_raw": digest,
        "method": "tether-suppression",
        "zip": False,
        "version": ENGINE_VERSION,
        "spec": SPEC_STRING,
        "paper": PAPER_ID,
    }, body


def _verified_restore(raw: bytes, method: str, extra: dict | None = None) -> dict:
    got = hashlib.sha256(raw).hexdigest()
    meta = {
        "orig_size": len(raw),
        "orig_sha256": got,
        "verified": True,
        "method": method,
        "zip": False,
        "version": ENGINE_VERSION,
        "spec": SPEC_STRING,
        "paper": PAPER_ID,
        "limitation": LIMITATION,
    }
    if extra:
        meta.update(extra)
    return meta


def unfold_bytes(blob: bytes) -> tuple[bytes, dict]:
    if len(blob) >= 4 and blob[:4] == MAGIC_RETIRED:
        raise ValueError("FLD2 (zlib wrapper) is retired. Refold with FoldLock v0.8.")
    if len(blob) >= 4 and blob[:4] == MAGIC:
        meta, body = read_container(blob)
        text = expand(body)
        raw = text.encode("utf-8")
        if len(raw) != meta["orig_size"]:
            raise ValueError("orig_size mismatch after unfold — suppression restore failed")
        got = hashlib.sha256(raw).digest()
        if got != meta["digest_raw"]:
            raise ValueError("orig_sha256 mismatch — unfold refused")
        return raw, _verified_restore(
            raw,
            "tether-suppression",
            {"strategy": "teth", "magic": "FLD3"},
        )
    if len(blob) >= 4 and blob[:4] == MAGIC_UNI1:
        from foldlock.uni1 import read_uni1, unfold_uni1_payload

        meta, payload = read_uni1(blob)
        text = unfold_uni1_payload(meta, payload)
        raw = text.encode("utf-8")
        if len(raw) != meta["orig_size"]:
            raise ValueError("orig_size mismatch after unfold — suppression restore failed")
        got = hashlib.sha256(raw).digest()
        if got != meta["digest_raw"]:
            raise ValueError("orig_sha256 mismatch — unfold refused")
        return raw, _verified_restore(
            raw,
            meta.get("method", "adaptive"),
            {
                "strategy": meta.get("strategy"),
                "magic": "UNI1",
                "class": meta.get("class"),
                "latin_pack": meta.get("latin_pack", False),
            },
        )
    # Identity: declined fold / already-unfolded bytes. Does not grow.
    return blob, _verified_restore(
        blob,
        "passthrough",
        {"strategy": "passthrough", "magic": "PASS", "passthrough": True},
    )


def unfold(src: Path, dst: Path) -> dict:
    raw, meta = unfold_bytes(src.read_bytes())
    dst.write_bytes(raw)
    meta["in"] = str(src)
    meta["out"] = str(dst)
    return meta


def count_hits(body: bytes) -> int:
    i = 0
    hits = 0
    while i < len(body):
        b = body[i]
        i += 1
        if b != ESC:
            continue
        if i >= len(body):
            break
        nxt = body[i]
        i += 1
        if nxt == ESC:
            continue
        hits += 1
        i += 1
    return hits


def info_bytes(blob: bytes) -> dict:
    if len(blob) >= 4 and blob[:4] == MAGIC_RETIRED:
        raise ValueError("FLD2 (zlib wrapper) is retired. Refold with FoldLock v0.8.")
    if len(blob) >= 4 and blob[:4] == MAGIC:
        meta, body = read_container(blob)
        meta.pop("digest_raw", None)
        meta["magic"] = "FLD3"
        meta["tether_hits"] = count_hits(body)
        meta["limitation"] = LIMITATION
        return meta
    if len(blob) >= 4 and blob[:4] == MAGIC_UNI1:
        from foldlock.uni1 import info_uni1

        return info_uni1(blob)
    digest = hashlib.sha256(blob).hexdigest()
    return {
        "magic": "PASS",
        "method": "passthrough",
        "strategy": "passthrough",
        "passthrough": True,
        "orig_size": len(blob),
        "orig_sha256": digest,
        "tether_hits": 0,
        "zip": False,
        "version": ENGINE_VERSION,
        "spec": SPEC_STRING,
        "paper": PAPER_ID,
        "limitation": LIMITATION,
    }


def info(src: Path) -> dict:
    meta = info_bytes(src.read_bytes())
    meta["file"] = str(src)
    return meta


def verify_bytes(original: bytes, restored: bytes) -> dict:
    orig_digest = hashlib.sha256(original).hexdigest()
    rest_digest = hashlib.sha256(restored).hexdigest()
    ok = original == restored
    return {
        "ok": ok,
        "orig_size": len(original),
        "restored_size": len(restored),
        "orig_sha256": orig_digest,
        "restored_sha256": rest_digest,
        "verified": ok,
        "zip": False,
        "method": "tether-suppression",
        "limitation": LIMITATION,
    }
