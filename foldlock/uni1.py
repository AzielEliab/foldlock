"""UNI1 adaptive champion shell: classify → allowlist → bakeoff → passthrough.

Author: Aziel Eliab, 2026. Apache-2.0.
"""

from __future__ import annotations

import hashlib
import struct
import subprocess

from foldlock.classify import (
    ID_KIND,
    KIND_COMPRESSED,
    KIND_ID,
    allowlist_for,
    classify,
)
from foldlock.engine import (
    ENGINE_VERSION,
    LIMITATION,
    MAGIC,
    ONDISK,
    PAPER_ID,
    SPEC_STRING,
    expand,
    pack_fld3,
    suppress,
)

MAGIC_UNI1 = b"UNI1"
UNI1_VERSION = 1
# <4sBBBBQ32sQ  magic, ver, strategy, flags, klass, orig_size, sha256, payload_len
UNI1_HEADER = "<4sBBBBQ32sQ"

STRAT_PASS = 0
STRAT_TETH = 1
STRAT_SIR = 2
STRAT_BODYX = 3
STRAT_TETH_PEER = 4

STRAT_NAME = {
    STRAT_PASS: "passthrough",
    STRAT_TETH: "teth",
    STRAT_SIR: "sir",
    STRAT_BODYX: "bodyx",
    STRAT_TETH_PEER: "teth_peer",
}
NAME_STRAT = {v: k for k, v in STRAT_NAME.items()}

FLAG_LATIN = 0x01
FLAG_PEER = 0x02
FLAG_SIR = 0x04

METHOD_FOR = {
    "passthrough": "passthrough",
    "teth": "tether-suppression",
    "sir": "sir",
    "bodyx": "bodyx",
    "teth_peer": "tether-peer",
}


class FoldRefuse(ValueError):
    """Refused input (already compressed, or non-text)."""


def pack_uni1(
    raw: bytes,
    payload: bytes,
    *,
    strategy: int,
    klass: int,
    flags: int = 0,
) -> bytes:
    digest = hashlib.sha256(raw).digest()
    header = struct.pack(
        UNI1_HEADER,
        MAGIC_UNI1,
        UNI1_VERSION,
        strategy,
        flags,
        klass,
        len(raw),
        digest,
        len(payload),
    )
    return header + payload


def read_uni1(blob: bytes) -> tuple[dict, bytes]:
    n = struct.calcsize(UNI1_HEADER)
    if len(blob) < n:
        raise ValueError("file too short for FoldLock UNI1 header")
    magic, ver, strat, flags, klass, orig_size, digest, payload_len = struct.unpack(
        UNI1_HEADER, blob[:n]
    )
    if magic != MAGIC_UNI1:
        raise ValueError("not a FoldLock UNI1 file")
    if ver != UNI1_VERSION:
        raise ValueError(f"unsupported UNI1 version {ver}")
    payload = blob[n:]
    if len(payload) != payload_len:
        raise ValueError(f"payload length mismatch: header {payload_len} file {len(payload)}")
    return {
        "magic": "UNI1",
        "uni1_version": ver,
        "strategy": STRAT_NAME.get(strat, str(strat)),
        "strategy_id": strat,
        "flags": flags,
        "class": ID_KIND.get(klass, "mixed"),
        "class_id": klass,
        "orig_size": orig_size,
        "body_size": payload_len,
        "orig_sha256": digest.hex(),
        "digest_raw": digest,
        "method": METHOD_FOR.get(STRAT_NAME.get(strat, ""), "adaptive"),
        "zip": False,
        "version": ENGINE_VERSION,
        "spec": SPEC_STRING,
        "paper": PAPER_ID,
        "latin_pack": bool(flags & FLAG_LATIN),
    }, payload


def unfold_uni1_payload(meta: dict, payload: bytes) -> str:
    from foldlock.sir import decode_bodyx, decode_sir

    strat = meta["strategy_id"]
    latin = bool(meta.get("flags", 0) & FLAG_LATIN)
    if strat == STRAT_SIR:
        return decode_sir(payload, latin=latin)
    if strat == STRAT_TETH_PEER:
        return decode_sir(payload, latin=latin)
    if strat == STRAT_BODYX:
        return decode_bodyx(payload)
    if strat == STRAT_TETH:
        return expand(payload)
    if strat == STRAT_PASS:
        return payload.decode("utf-8")
    raise ValueError(f"unsupported UNI1 strategy {strat}")


def maybe_zstd_size(raw: bytes) -> int | None:
    """zstd-19 size when the library or CLI is present. None if unavailable."""
    try:
        import zstandard  # type: ignore

        cctx = zstandard.ZstdCompressor(level=19)
        return len(cctx.compress(raw))
    except Exception:
        pass
    zstd = None
    for cand in ("zstd", "zstd.exe"):
        from shutil import which

        zstd = which(cand)
        if zstd:
            break
    if not zstd:
        return None
    try:
        proc = subprocess.run(
            [zstd, "-19", "-c"],
            input=raw,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if proc.returncode == 0 and proc.stdout:
            return len(proc.stdout)
    except Exception:
        return None
    return None


def _receipt_base(raw: bytes, blob: bytes, stats: dict, cls, strategy: str) -> dict:
    digest = hashlib.sha256(raw).hexdigest()
    zstd_size = maybe_zstd_size(raw)
    folded = len(blob)
    beats = None if zstd_size is None else folded < zstd_size
    return {
        "method": METHOD_FOR.get(strategy, strategy),
        "strategy": strategy,
        "champion": strategy,
        "class": cls.kind,
        "class_reason": cls.reason,
        "passthrough": strategy == "passthrough",
        "grew": folded > len(raw),
        "lexicon": stats.get("lexicon", "TETH-1"),
        "tether_words": stats.get("tether_words"),
        "tether_hits": stats.get("tether_hits", 0),
        "tether_bytes_saved": stats.get("tether_bytes_saved", 0),
        "peer_hits": stats.get("peer_hits", 0),
        "abbrev_hits": stats.get("abbrev_hits", 0),
        "latin_hits": stats.get("latin_hits", 0),
        "local_hits": stats.get("local_hits", 0),
        "number_hits": stats.get("number_hits", 0),
        "latin_pack": bool(stats.get("latin_pack")),
        "orig_size": len(raw),
        "folded_size": folded,
        "body_size": stats.get("body_size", max(0, folded - 54)),
        "orig_sha256": digest,
        "ratio": (folded / len(raw)) if raw else 0.0,
        "zip": False,
        "beats_zstd": beats,
        "zstd_size": zstd_size,
        "zstd_level": 19 if zstd_size is not None else None,
        "zstd_available": zstd_size is not None,
        "version": ENGINE_VERSION,
        "spec": SPEC_STRING,
        "paper": PAPER_ID,
        "limitation": LIMITATION,
        "magic": "FLD3" if blob[:4] == MAGIC else ("UNI1" if blob[:4] == MAGIC_UNI1 else "PASS"),
    }


def _try_unfold_candidate(raw: bytes, blob: bytes) -> bool:
    from foldlock.engine import unfold_bytes

    try:
        restored, meta = unfold_bytes(blob)
    except Exception:
        return False
    return restored == raw and meta.get("verified") is True


def fold_adaptive(
    raw: bytes,
    *,
    name: str = "",
    latin_pack: bool = False,
) -> tuple[bytes, dict]:
    """Classify, compete allowed strategies, passthrough if nothing shrinks."""
    from foldlock.sir import encode_bodyx, encode_sir

    cls = classify(raw, name)
    if cls.kind == KIND_COMPRESSED:
        raise FoldRefuse(
            "FoldLock refuses already-compressed input "
            f"({cls.media or cls.reason}). "
            "This is not a zip wrapper. Use passthrough outside FoldLock "
            "or do not fold png/jpg/pdf/zip/zst."
        )
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as e:
        raise FoldRefuse(
            "FoldLock v0.8 folds UTF-8 text by adaptive tether/SIR suppression. "
            "Binary input is refused. This is not a zip wrapper."
        ) from e

    allowed = allowlist_for(cls.kind)
    bakeoff: list[dict] = []
    best: tuple[int, str, bytes, dict] | None = None

    def consider(strategy: str, blob: bytes, stats: dict) -> None:
        nonlocal best
        ok = _try_unfold_candidate(raw, blob)
        entry = {
            "strategy": strategy,
            "size": len(blob),
            "roundtrip": ok,
            "shrinks": ok and len(blob) < len(raw),
        }
        bakeoff.append(entry)
        if not ok or len(blob) >= len(raw):
            return
        if best is None or len(blob) < best[0]:
            best = (len(blob), strategy, blob, stats)

    if "teth" in allowed:
        body, stats = suppress(text)
        blob = pack_fld3(raw, body, stats)
        stats = dict(stats)
        stats["body_size"] = len(body)
        consider("teth", blob, stats)

    if "teth_peer" in allowed:
        payload, stats = encode_sir(
            text,
            use_peer=True,
            use_abbrev=True,
            use_local=False,
            use_numbers=True,
            use_latin=latin_pack,
        )
        flags = FLAG_PEER | FLAG_SIR
        if latin_pack:
            flags |= FLAG_LATIN
        blob = pack_uni1(
            raw,
            payload,
            strategy=STRAT_TETH_PEER,
            klass=KIND_ID.get(cls.kind, 3),
            flags=flags,
        )
        stats = dict(stats)
        stats["body_size"] = len(payload)
        consider("teth_peer", blob, stats)

    if "sir" in allowed:
        payload, stats = encode_sir(
            text,
            use_peer=True,
            use_abbrev=True,
            use_local=True,
            use_numbers=True,
            use_latin=latin_pack,
        )
        flags = FLAG_PEER | FLAG_SIR
        if latin_pack:
            flags |= FLAG_LATIN
        blob = pack_uni1(
            raw,
            payload,
            strategy=STRAT_SIR,
            klass=KIND_ID.get(cls.kind, 3),
            flags=flags,
        )
        stats = dict(stats)
        stats["body_size"] = len(payload)
        consider("sir", blob, stats)

    if "bodyx" in allowed:
        payload, stats = encode_bodyx(text)
        blob = pack_uni1(
            raw,
            payload,
            strategy=STRAT_BODYX,
            klass=KIND_ID.get(cls.kind, 3),
            flags=0,
        )
        stats = dict(stats)
        stats["body_size"] = len(payload)
        consider("bodyx", blob, stats)

    if best is None:
        stats = {
            "lexicon": "none",
            "tether_words": 0,
            "tether_hits": 0,
            "tether_bytes_saved": 0,
            "body_size": len(raw),
            "latin_pack": False,
        }
        receipt = _receipt_base(raw, raw, stats, cls, "passthrough")
        receipt["bakeoff"] = bakeoff
        receipt["grew"] = False
        receipt["magic"] = "PASS"
        return raw, receipt

    _size, strategy, blob, stats = best
    receipt = _receipt_base(raw, blob, stats, cls, strategy)
    receipt["bakeoff"] = bakeoff
    return blob, receipt


def info_uni1(blob: bytes) -> dict:
    from foldlock.sir import TAG_ABBREV, TAG_LATIN, TAG_LOCAL, TAG_NUM, TAG_PEER

    meta, payload = read_uni1(blob)
    meta.pop("digest_raw", None)
    # cheap opcode census on SIR-like payloads
    hits = 0
    if meta["strategy_id"] in {STRAT_SIR, STRAT_TETH_PEER, STRAT_TETH}:
        i = 0
        # skip SIR dict prefix
        if meta["strategy_id"] != STRAT_TETH:
            if payload:
                pos = 1
                wc = payload[0]
                for _ in range(wc):
                    if pos >= len(payload):
                        break
                    pos += 1 + payload[pos]
                if pos < len(payload):
                    nc = payload[pos]
                    pos += 1
                    for _ in range(nc):
                        if pos >= len(payload):
                            break
                        pos += 1 + payload[pos]
                i = pos
        body = payload if meta["strategy_id"] == STRAT_TETH else payload[i:]
        j = 0
        while j < len(body):
            if body[j] != 0xFF:
                j += 1
                continue
            if j + 1 >= len(body):
                break
            nxt = body[j + 1]
            if nxt == 0xFF:
                j += 2
                continue
            hits += 1
            if nxt in {TAG_PEER, TAG_ABBREV, TAG_LOCAL, TAG_LATIN}:
                j += 4
            elif nxt == TAG_NUM:
                j += 3
            else:
                j += 3
    meta["tether_hits"] = hits
    meta["limitation"] = LIMITATION
    return meta
