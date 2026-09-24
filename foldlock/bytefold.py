"""Byte-tether lane for any file.

Runs and repeated windows become short opcodes. Literals stay as bytes.
This is FoldLock's own byte lane. It is not DEFLATE, zlib, gzip, or zstd.

Exact restore of the original bytes. The bakeoff drops a result that
does not shrink.
"""

from __future__ import annotations

ESC = 0xFF
TAG_RUN = 0x01
TAG_REF = 0x02
MIN_RUN = 5
MIN_REF = 6
MAX_LEN = 255
WINDOW = 32767
CHAIN = 32


def encode_byte(raw: bytes) -> tuple[bytes, dict]:
    """Encode raw bytes. The payload may be larger; the bakeoff decides."""
    n = len(raw)
    out = bytearray()
    runs = 0
    refs = 0
    heads: dict[int, int] = {}
    prev = [-1] * n

    def key_at(i: int) -> int:
        return raw[i] | (raw[i + 1] << 8) | (raw[i + 2] << 16)

    def index_only(i: int) -> None:
        if i + 2 >= n:
            return
        key = key_at(i)
        prev[i] = heads.get(key, -1)
        heads[key] = i

    def find_ref(i: int) -> tuple[int, int]:
        if i + 2 >= n:
            return 0, 0
        key = key_at(i)
        best_len = 0
        best_dist = 0
        j = heads.get(key, -1)
        steps = 0
        max_l = min(MAX_LEN, n - i)
        while j >= 0 and steps < CHAIN:
            dist = i - j
            if dist <= 0 or dist > WINDOW:
                break
            length = 0
            while length < max_l and raw[i + length] == raw[i - dist + length]:
                length += 1
            if length > best_len:
                best_len = length
                best_dist = dist
                if length >= max_l:
                    break
            j = prev[j]
            steps += 1
        prev[i] = heads.get(key, -1)
        heads[key] = i
        return best_len, best_dist

    def run_len(i: int) -> int:
        byte = raw[i]
        limit = min(n, i + MIN_RUN + 255)
        j = i + 1
        while j < limit and raw[j] == byte:
            j += 1
        return j - i

    i = 0
    while i < n:
        run = run_len(i)
        ref_len, dist = find_ref(i)
        run_save = (run - 4) if run >= MIN_RUN else -1
        ref_save = (ref_len - 5) if ref_len >= MIN_REF else -1
        if run_save >= ref_save and run_save > 0:
            count = min(run, MIN_RUN + 255)
            out.append(ESC)
            out.append(TAG_RUN)
            out.append(count - MIN_RUN)
            out.append(raw[i])
            for pos in range(i + 1, i + count):
                index_only(pos)
            i += count
            runs += 1
            continue
        if ref_save > 0:
            out.append(ESC)
            out.append(TAG_REF)
            out.append(dist & 0xFF)
            out.append((dist >> 8) & 0xFF)
            out.append(ref_len)
            for pos in range(i + 1, i + ref_len):
                index_only(pos)
            i += ref_len
            refs += 1
            continue
        byte = raw[i]
        out.append(byte)
        if byte == ESC:
            out.append(ESC)
        i += 1

    stats = {
        "lexicon": "BYTE-1",
        "tether_words": 0,
        "tether_hits": runs + refs,
        "tether_bytes_saved": max(0, n - len(out)),
        "byte_runs": runs,
        "byte_refs": refs,
        "body_size": len(out),
        "latin_pack": False,
    }
    return bytes(out), stats


def decode_byte(payload: bytes) -> bytes:
    """Restore the original bytes. Raises ValueError if the payload is truncated."""
    out = bytearray()
    i = 0
    n = len(payload)
    while i < n:
        byte = payload[i]
        i += 1
        if byte != ESC:
            out.append(byte)
            continue
        if i >= n:
            raise ValueError("truncated byte-tether escape")
        tag = payload[i]
        i += 1
        if tag == ESC:
            out.append(ESC)
            continue
        if tag == TAG_RUN:
            if i + 1 >= n:
                raise ValueError("truncated byte-tether run")
            count = payload[i] + MIN_RUN
            lit = payload[i + 1]
            i += 2
            out.extend((lit,) * count)
            continue
        if tag == TAG_REF:
            if i + 2 >= n:
                raise ValueError("truncated byte-tether reference")
            dist = payload[i] | (payload[i + 1] << 8)
            length = payload[i + 2]
            i += 3
            if dist <= 0 or dist > len(out) or length <= 0:
                raise ValueError("bad byte-tether reference")
            for _ in range(length):
                out.append(out[-dist])
            continue
        raise ValueError(f"bad byte-tether tag {tag}")
    return bytes(out)


def count_ops(payload: bytes) -> tuple[int, int]:
    """Count run and reference opcodes. Used by info."""
    runs = 0
    refs = 0
    i = 0
    n = len(payload)
    while i < n:
        byte = payload[i]
        i += 1
        if byte != ESC:
            continue
        if i >= n:
            break
        tag = payload[i]
        i += 1
        if tag == ESC:
            continue
        if tag == TAG_RUN:
            i += 2
            runs += 1
            continue
        if tag == TAG_REF:
            i += 3
            refs += 1
            continue
        break
    return runs, refs
