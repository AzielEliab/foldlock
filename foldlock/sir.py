"""SIR / FLD5: tether + peer/abbrev/number/local-dict densification.

Exact restore. No zip. Abbreviations are never expanded.

Author: Aziel Eliab, 2026. Apache-2.0.
"""

from __future__ import annotations

import re
import struct
from collections import Counter

from foldlock.engine import (
    CASE_LOWER,
    CASE_MIXED,
    CASE_TITLE,
    CASE_UPPER,
    ESC,
    SHAPE_BARE,
    SHAPE_BOTH,
    SHAPE_LEAD,
    SHAPE_TRAIL,
    TETHER_INDEX,
    TETHERS,
    _apply_case,
    _case_code,
)
from foldlock.packs import ABBREV_PACK, LATIN_PACK, PEER_PACK, bind_pack

# Second-byte tags. Tether markers occupy 0..11, so these do not collide.
TAG_LATIN = 0xFB
TAG_ABBREV = 0xFC
TAG_LOCAL = 0xFD
TAG_PEER = 0xFE
TAG_NUM = 0xFA

SIR_TOKEN_RE = re.compile(
    r"[A-Za-z]+(?:'[A-Za-z]+)*|"
    r"[A-Za-z](?:\.[A-Za-z])+\.?"
    r"|\d{1,3}(?:,\d{3})+(?:\.\d+)?"
    r"|\d+\.\d+"
    r"|\d+"
    r"|[^A-Za-z0-9]+"
)

NUM_INT_RE = re.compile(r"^[1-9]\d*$|^0$")


def _word_key(tok: str) -> str | None:
    if tok.isalpha():
        return tok.lower()
    return None


def _is_number(tok: str) -> bool:
    if not tok or not tok[0].isdigit():
        return False
    return bool(re.fullmatch(r"[\d,.]+", tok))


def _bound_packs(*, latin: bool) -> tuple[tuple[str, ...], tuple[str, ...], tuple[str, ...]]:
    exclude = set(TETHERS)
    peer = bind_pack(PEER_PACK, exclude)
    abbrev = bind_pack(ABBREV_PACK, exclude | set(peer))
    latin_p = bind_pack(LATIN_PACK, exclude | set(peer) | set(abbrev)) if latin else ()
    return peer, abbrev, latin_p


def _shape_for(tokens: list[str], i: int, prev_took_trail: bool) -> tuple[int, bool, bool]:
    lead = (not prev_took_trail) and i > 0 and tokens[i - 1] == " "
    trail = i + 1 < len(tokens) and tokens[i + 1] == " "
    if lead and trail:
        return SHAPE_BOTH, True, True
    if lead:
        return SHAPE_LEAD, True, False
    if trail:
        return SHAPE_TRAIL, False, True
    return SHAPE_BARE, False, False


def _adjust_lead(out: bytearray, shape: int, take_lead: bool, take_trail: bool) -> tuple[int, bool]:
    if take_lead and out.endswith(b" "):
        del out[-1]
        return shape, True
    if take_lead and out:
        return (SHAPE_TRAIL if take_trail else SHAPE_BARE), False
    return shape, take_lead


def _emit_lit(out: bytearray, raw: bytes) -> None:
    for b in raw:
        out.append(b)
        if b == ESC:
            out.append(ESC)


def _compact_int(tok: str) -> bytes | None:
    if not NUM_INT_RE.fullmatch(tok):
        return None
    n = int(tok)
    ascii_len = len(tok)
    if 0 <= n <= 255 and ascii_len > 4:
        return bytes((ESC, TAG_NUM, 0, n))
    if 0 <= n <= 0xFFFFFFFF and ascii_len > 7:
        return bytes((ESC, TAG_NUM, 1)) + struct.pack("<I", n)
    if 0 <= n <= 0xFFFFFFFFFFFFFFFF and ascii_len > 11:
        return bytes((ESC, TAG_NUM, 2)) + struct.pack("<Q", n)
    return None


def encode_sir(
    text: str,
    *,
    use_peer: bool = True,
    use_abbrev: bool = True,
    use_local: bool = True,
    use_numbers: bool = True,
    use_latin: bool = False,
) -> tuple[bytes, dict]:
    """Encode SIR stream (local dict prefix + body). Exact restore."""
    peer, abbrev, latin_p = _bound_packs(latin=use_latin)
    peer_index = {w: i for i, w in enumerate(peer)} if use_peer else {}
    abbrev_index = {w: i for i, w in enumerate(abbrev)} if use_abbrev else {}
    latin_index = {w: i for i, w in enumerate(latin_p)} if use_latin else {}

    tokens = SIR_TOKEN_RE.findall(text)
    word_keys: list[str] = []
    num_keys: list[str] = []
    for tok in tokens:
        wk = _word_key(tok)
        if wk and wk not in TETHER_INDEX and wk not in peer_index and wk not in abbrev_index and wk not in latin_index:
            word_keys.append(wk)
        elif use_numbers and _is_number(tok):
            num_keys.append(tok)

    local_words: list[str] = []
    local_nums: list[str] = []
    if use_local:
        wc = Counter(word_keys)
        # Prefer replacements that save the most (longest × extra hits).
        ranked = sorted(
            ((w, n) for w, n in wc.items() if n >= 2 and len(w) > 3),
            key=lambda wn: (len(wn[0]) * (wn[1] - 1), len(wn[0]), wn[0]),
            reverse=True,
        )
        local_words = [w for w, _n in ranked[:200] if len(w.encode("utf-8")) <= 255]
        if use_numbers:
            nc = Counter(num_keys)
            n_ranked = sorted(
                ((t, n) for t, n in nc.items() if n >= 2 and len(t) > 3),
                key=lambda tn: (len(tn[0]) * (tn[1] - 1), len(tn[0]), tn[0]),
                reverse=True,
            )
            remain = max(0, 255 - len(local_words))
            local_nums = [t for t, _n in n_ranked[:remain] if len(t.encode("utf-8")) <= 255]

    word_index = {w: i for i, w in enumerate(local_words)}
    num_index = {t: i for i, t in enumerate(local_nums)}

    prefix = bytearray()
    prefix.append(len(local_words))
    for w in local_words:
        raw = w.encode("utf-8")
        prefix.append(len(raw))
        prefix.extend(raw)
    prefix.append(len(local_nums))
    for t in local_nums:
        raw = t.encode("utf-8")
        prefix.append(len(raw))
        prefix.extend(raw)

    out = bytearray()
    tether_hits = 0
    peer_hits = 0
    abbrev_hits = 0
    latin_hits = 0
    local_hits = 0
    number_hits = 0
    prev_took_trail = False
    i = 0
    n = len(tokens)
    while i < n:
        tok = tokens[i]
        key = _word_key(tok)
        case = _case_code(tok) if key else None
        used = False
        if key and case is not None and case != CASE_MIXED:
            shape, take_lead, take_trail = _shape_for(tokens, i, prev_took_trail)
            tag_id: int | None = None
            tag = 0
            if key in TETHER_INDEX:
                tag = None  # type: ignore[assignment]
                tag_id = TETHER_INDEX[key]
            elif key in peer_index:
                tag, tag_id = TAG_PEER, peer_index[key]
            elif key in abbrev_index:
                tag, tag_id = TAG_ABBREV, abbrev_index[key]
            elif key in latin_index:
                tag, tag_id = TAG_LATIN, latin_index[key]
            elif key in word_index:
                tag, tag_id = TAG_LOCAL, word_index[key]
            if tag_id is not None:
                shape, take_lead = _adjust_lead(out, shape, take_lead, take_trail)
                marker = (case << 2) | shape
                out.append(ESC)
                if key in TETHER_INDEX:
                    out.append(marker)
                    out.append(tag_id)
                    tether_hits += 1
                else:
                    out.append(tag)
                    out.append(marker)
                    out.append(tag_id)
                    if tag == TAG_PEER:
                        peer_hits += 1
                    elif tag == TAG_ABBREV:
                        abbrev_hits += 1
                    elif tag == TAG_LATIN:
                        latin_hits += 1
                    else:
                        local_hits += 1
                i += 1
                if take_trail:
                    i += 1
                prev_took_trail = take_trail
                used = True
        if used:
            continue
        if use_numbers and _is_number(tok):
            shape, take_lead, take_trail = _shape_for(tokens, i, prev_took_trail)
            if tok in num_index:
                shape, take_lead = _adjust_lead(out, shape, take_lead, take_trail)
                out.append(ESC)
                out.append(TAG_LOCAL)
                out.append((CASE_LOWER << 2) | shape)
                out.append(len(local_words) + num_index[tok])
                local_hits += 1
                i += 1
                if take_trail:
                    i += 1
                prev_took_trail = take_trail
                continue
            compact = _compact_int(tok)
            if compact is not None:
                out.extend(compact)
                number_hits += 1
                prev_took_trail = False
                i += 1
                continue
        _emit_lit(out, tok.encode("utf-8"))
        prev_took_trail = False
        i += 1

    body = bytes(prefix) + bytes(out)
    stats = {
        "tether_hits": tether_hits,
        "peer_hits": peer_hits,
        "abbrev_hits": abbrev_hits,
        "latin_hits": latin_hits,
        "local_hits": local_hits,
        "number_hits": number_hits,
        "local_words": len(local_words),
        "local_nums": len(local_nums),
        "lexicon": "TETH-1+SIR",
        "tether_words": len(TETHERS),
        "peer_words": len(peer) if use_peer else 0,
        "latin_pack": bool(use_latin),
    }
    return body, stats


def _read_counted_table(body: bytes, pos: int) -> tuple[list[str], int]:
    if pos >= len(body):
        raise ValueError("truncated SIR dictionary")
    count = body[pos]
    pos += 1
    items: list[str] = []
    for _ in range(count):
        if pos >= len(body):
            raise ValueError("truncated SIR dictionary")
        ln = body[pos]
        pos += 1
        chunk = body[pos : pos + ln]
        if len(chunk) != ln:
            raise ValueError("truncated SIR dictionary entry")
        items.append(chunk.decode("utf-8"))
        pos += ln
    return items, pos


def decode_sir(payload: bytes, *, latin: bool = False) -> str:
    peer, abbrev, latin_p = _bound_packs(latin=latin)
    local_words, pos = _read_counted_table(payload, 0)
    local_nums, pos = _read_counted_table(payload, pos)
    local_all = local_words + local_nums
    n_words = len(local_words)

    raw_out = bytearray()
    i = pos
    n = len(payload)
    while i < n:
        b = payload[i]
        i += 1
        if b != ESC:
            raw_out.append(b)
            continue
        if i >= n:
            raise ValueError("truncated escape")
        nxt = payload[i]
        i += 1
        if nxt == ESC:
            raw_out.append(ESC)
            continue
        if nxt in {TAG_PEER, TAG_ABBREV, TAG_LOCAL, TAG_LATIN}:
            if i + 1 >= n:
                raise ValueError("truncated SIR opcode")
            marker = payload[i]
            wid = payload[i + 1]
            i += 2
            case = (marker >> 2) & 0x03
            shape = marker & 0x03
            if nxt == TAG_PEER:
                if wid >= len(peer):
                    raise ValueError(f"peer id {wid} out of range")
                base = peer[wid]
                word = _apply_case(base, case)
            elif nxt == TAG_ABBREV:
                if wid >= len(abbrev):
                    raise ValueError(f"abbrev id {wid} out of range")
                word = _apply_case(abbrev[wid], case)
            elif nxt == TAG_LATIN:
                if wid >= len(latin_p):
                    raise ValueError(f"latin id {wid} out of range")
                word = _apply_case(latin_p[wid], case)
            else:
                if wid >= len(local_all):
                    raise ValueError(f"local id {wid} out of range")
                base = local_all[wid]
                word = _apply_case(base, case) if wid < n_words else base
            if shape == SHAPE_LEAD:
                word = " " + word
            elif shape == SHAPE_TRAIL:
                word = word + " "
            elif shape == SHAPE_BOTH:
                word = " " + word + " "
            raw_out.extend(word.encode("utf-8"))
            continue
        if nxt == TAG_NUM:
            if i >= n:
                raise ValueError("truncated number opcode")
            kind = payload[i]
            i += 1
            if kind == 0:
                if i >= n:
                    raise ValueError("truncated u8 number")
                raw_out.extend(str(payload[i]).encode("utf-8"))
                i += 1
            elif kind == 1:
                if i + 4 > n:
                    raise ValueError("truncated u32 number")
                (val,) = struct.unpack_from("<I", payload, i)
                raw_out.extend(str(val).encode("utf-8"))
                i += 4
            elif kind == 2:
                if i + 8 > n:
                    raise ValueError("truncated u64 number")
                (val,) = struct.unpack_from("<Q", payload, i)
                raw_out.extend(str(val).encode("utf-8"))
                i += 8
            else:
                raise ValueError(f"bad number kind {kind}")
            continue
        # tether: nxt is marker
        if i >= n:
            raise ValueError("truncated tether id")
        wid = payload[i]
        i += 1
        if wid >= len(TETHERS):
            raise ValueError(f"tether id {wid} not in TETH-1")
        case = (nxt >> 2) & 0x03
        shape = nxt & 0x03
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


def encode_bodyx(text: str) -> tuple[bytes, dict]:
    """Body×X×Body: fold paragraph chunks independently. Kept only if bakeoff wins."""
    from foldlock.engine import suppress, expand

    parts = re.split(r"(\n{2,})", text)
    out = bytearray()
    out.extend(struct.pack("<H", len(parts)))
    teth_parts = 0
    lit_parts = 0
    for part in parts:
        if not part:
            out.extend(struct.pack("<BI", 0, 0))
            lit_parts += 1
            continue
        body, _stats = suppress(part)
        restored = expand(body)
        if restored == part and len(body) < len(part.encode("utf-8")):
            raw = body
            kind = 1
            teth_parts += 1
        else:
            raw = part.encode("utf-8")
            kind = 0
            lit_parts += 1
        out.extend(struct.pack("<BI", kind, len(raw)))
        out.extend(raw)
    stats = {
        "tether_hits": teth_parts,
        "bodyx_parts": len(parts),
        "bodyx_teth": teth_parts,
        "bodyx_lit": lit_parts,
        "lexicon": "TETH-1",
        "tether_words": len(TETHERS),
        "peer_hits": 0,
        "abbrev_hits": 0,
        "latin_hits": 0,
        "local_hits": 0,
        "number_hits": 0,
    }
    return bytes(out), stats


def decode_bodyx(payload: bytes) -> str:
    from foldlock.engine import expand

    if len(payload) < 2:
        raise ValueError("truncated bodyx header")
    (count,) = struct.unpack_from("<H", payload, 0)
    pos = 2
    chunks: list[str] = []
    for _ in range(count):
        if pos + 5 > len(payload):
            raise ValueError("truncated bodyx part")
        kind, ln = struct.unpack_from("<BI", payload, pos)
        pos += 5
        chunk = payload[pos : pos + ln]
        if len(chunk) != ln:
            raise ValueError("truncated bodyx body")
        pos += ln
        if kind == 1:
            chunks.append(expand(chunk))
        elif kind == 0:
            chunks.append(chunk.decode("utf-8"))
        else:
            raise ValueError(f"bad bodyx kind {kind}")
    if pos != len(payload):
        raise ValueError("bodyx trailing bytes")
    return "".join(chunks)
