# FoldLock v0.8 UNI1

SOTA adaptive champion shell: a zip-class compression engine for UTF-8
text (classify → bakeoff → passthrough). Not the ZIP container format.
Author: **Aziel Eliab**. No new Zenodo DOI — the TETH-1 method paper
remains FL-WP-0.3.

## What UNI1 is

`classify → allowlist strategies → bakeoff → passthrough if no shrink.`

| Detected class | Allowed strategies | Typical outcome |
|----------------|--------------------|-----------------|
| Prose / markdown / plain text | SIR/FLD5, TETH/FLD4, teth+peer, body×X×body | Win lane when tethers and peer words are dense |
| Source code | TETH or passthrough | Often passthrough |
| JSON / HTML / XML | TETH | Often leave alone |
| Already compressed (zip/png/jpg/pdf/zst/…) | none | **Refuse** |
| Mixed / unknown UTF-8 | SIR + TETH | Compete; passthrough floor |

Detection uses extension, magic bytes, then UTF-8 / entropy sniff.

## Containers

| Magic | Role |
|-------|------|
| `FLD3` | TETH stream (v0.3 format). Still unfolds. Emitted when TETH wins the bakeoff. |
| `UNI1` | Adaptive payload (SIR, teth+peer, body×X×body). |
| `PASS` | Not a container. Fold wrote the original bytes because nothing shrank. Unfold of non-FLD3/UNI1 is identity. |
| `FLD2` | Retired zlib wrapper. Refused. |

UNI1 header (little-endian):

`magic(4) ver(u8) strategy(u8) flags(u8) class(u8) orig_size(u64) orig_sha256(32) payload_len(u64) payload`

Strategies: `1=teth` (rarely wrapped; TETH winner uses FLD3), `2=sir`, `3=bodyx`, `4=teth_peer`.

## Short strings

If every candidate is larger than the original, FoldLock leaves the
bytes alone. Short notes do not grow. VECTORS.txt (63 bytes) is a
passthrough under UNI1 and still exact-restores.

## Packs

- **TETH-1** — 112 function words. Append-only. IDs 0..111 unchanged.
- **Peer pack** — longer common words encoded as opcodes that restore
  *that* spelling. “house → home” is the density idea; the stream never
  stores a synonym. Exact restore holds.
- **Abbreviations** — first-class tokens (`approx`, `dept`, …). Never
  expanded to a longer phrase.
- **Numbers** — repeated values and long integers may take a compact
  opcode when that is smaller than ASCII.
- **Latin pack** — optional (`--latin-pack`). Extra peer IDs only.
  Never “translate the file to Latin, then fold.”

## Body×X×Body

Paragraph chunks may be folded independently. The strategy competes in
the bakeoff and is **dropped** unless it is the smallest exact restore.

## Scoring honesty

Receipts may include `beats_zstd` when a zstd-19 tool or library is
present. That flag is per file. FoldLock does not claim a universal
zstd championship. Many prose files lose to zstd-19. That is documented,
not hidden. The win lane is structural densification of tether-rich
text versus the original bytes.

## Reticule

Glyph / 2×2 reticule / rotation was explored and discarded. See
[experiments-reticule.md](experiments-reticule.md).
