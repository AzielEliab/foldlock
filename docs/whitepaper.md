# FoldLock

Algorithmic tether suppression

**Paper ID:** FL-WP-0.3
**Product:** FoldLock v0.3
**Supersedes:** FL-WP-0.2, FL-WP-0.1
**Author:** Aziel Eliab
**Date:** 2 September 2026
**License:** Apache-2.0

> Pull the tethers. Restore the bytes. Do not ship a zip and call it a fold.

## Abstract

FoldLock is a text compressor whose method is algorithmic suppression of tether words. A tether is a high-frequency function word that holds sentences together without carrying the payload: as, is, has, to, and, or, etc, and the function-word net around them.

Fold walks UTF-8 text, pulls those tethers out of the byte stream, and writes a `.fld` whose body is residual bytes plus compact tether opcodes. Unfold puts the tethers back and will not emit a file unless the restored bytes match the original size and SHA-256.

This is not a zip wrapper. v0.2 used zlib. That draft is retired. FoldLock’s claim is the suppression method — a linguistic fold with exact restore — not a DEFLATE clone and not a fabricated bake-off against general binary compressors.

Runtime: `foldlock.py`. Magic: FLD3. Lexicon: TETH-1.

The same preprint on Zenodo also describes WhistleLock (WL-WP-0.1). **This document and this repository are FoldLock only.**

DOI: https://doi.org/10.5281/zenodo.22257762

## 1. Why v0.2 was the wrong machine

A zlib header plus a compressed body is a zip-class bundle. It reduces bytes by a general entropy coder. That work already has a name.

FoldLock is named for the fold: take the tethers out of the language surface, keep the residual, restore on the way back. If the product cannot name the words it removed and put them back to the original byte length, it is not FoldLock.

Operator correction, 2 September 2026:

- folding compresses by reducing bytes via algorithmic suppression;
- suppression removes tether words (as, is, has, to, and, or, etc);
- unfold restores those tethers to the proper byte-size file;
- a zip bundle is not the product.

## 2. Purpose

1. **Suppress, don't delete.** A deleted word cannot be restored to the original bytes. Each tether becomes an opcode that still knows which word, which case, and which surrounding spaces were pulled.
2. **Restore to the same file.** Unfold is lossless. `orig_size` and `orig_sha256` are the gate.
3. **Refuse binary.** FoldLock v0.3 is a text fold. A PNG is not a sentence. Do not silently wrap it in zlib to look useful.
4. **Name the lexicon.** TETH-1 is a table, not a mood. Reordering IDs orphans containers.

## 3. What this is / is not

**This is**

- reversible tether-word suppression on UTF-8 text;
- a 3-byte opcode for each suppressed tether (escape + marker + id);
- exact restore of letters and of single ASCII spaces bound to those tethers;
- Path A (refold to a new file) / Path B (do not rewrite a `.fld`).

**This is not**

- zip, zlib, gzip, DEFLATE, zstd, or lzma;
- a registration store (FL-WP-0.1, retired);
- a claim that every file class shrinks — short strings and identifier-heavy source can grow by the header and by 3-byte opcodes on one-letter tethers such as a / i;
- UL, EmployeeLock, TemporalLock, or GodLock;
- a published industry bake-off. No corpus ranking is asserted here.

Product stance: FoldLock is the tether-suppression compressor. Ratios track tether density. They are receipts, not trophies.

## 4. Tether lexicon TETH-1

Operator core, first seven IDs, never reordered:

`as is has to and or etc`

Then the function-word net. Live ordered table: `TETHERS` in `foldlock/engine.py`. Capacity cap: 255 IDs. v0.3 ships 112.

A token becomes a tether only if:

- it is a letter-run `[A-Za-z]+`;
- its lowercase form is in TETH-1;
- its case is all-lower, Title, or ALL-CAPS.

Mixed case (`tHe`) stays literal.

`etcetera` is in the table. `etc.` with the period: the letters `etc` suppress; the period stays residual.

IDs 0…111 (do not reorder): as, is, has, to, and, or, etc, the, a, an, of, in, on, for, with, at, by, from, into, onto, upon, it, its, be, am, are, was, were, been, being, have, had, having, do, does, did, doing, will, would, shall, should, can, could, may, might, must, not, no, nor, but, if, then, than, so, too, that, this, these, those, which, who, whom, whose, what, when, where, why, how, i, me, my, we, us, our, you, your, he, him, his, she, her, they, them, their, all, any, each, every, few, more, most, other, some, such, also, just, only, even, up, out, off, over, under, here, there, both, same, own, per, via, vs, etcetera.

## 5. Algorithmic suppression

### 5.1 Tokenise

Split the decoded UTF-8 string with `[A-Za-z]+|[^A-Za-z]+`.

### 5.2 Space shapes

Only U+0020 counts. Tabs, newlines, and double spaces stay residual.

| Shape | Bytes pulled with the word |
|-------|----------------------------|
| bare  | word                       |
| lead  | leading space + word       |
| trail | word + trailing space      |
| both  | leading space + word + trailing space |

Adjacent tethers: if the previous opcode already ate the trailing space, the next opcode does not eat it again.

### 5.3 Stream codec

Not an entropy coder.

| Sequence        | Meaning                                      |
|-----------------|----------------------------------------------|
| `0xFF 0xFF`     | one literal byte `0xFF`                      |
| `0xFF marker id`| tether. `marker = (case << 2) \| shape`      |
| any other byte  | literal residual byte                        |

Case codes: 0 lower, 1 Title, 2 UPPER. Code 3 is illegal in a container.

### 5.4 Header

Little-endian `<4sBBQ32sQ`:

| Field        | Size | Rule                              |
|--------------|------|-----------------------------------|
| magic        | 4    | FLD3                              |
| lexicon_id   | 1    | 1 = TETH-1                        |
| reserved     | 1    | 0                                 |
| orig_size    | 8    | original UTF-8 length             |
| orig_sha256  | 32   | raw digest of original bytes      |
| body_len     | 8    | length of the suppression stream  |
| body         | …    | stream from 5.3                   |

FLD2 files raise: zlib wrapper is retired; refold with v0.3.

## 6. Unfold

1. Parse header. Refuse bad magic, bad lexicon, short file, body_len mismatch.
2. Walk the stream. Expand opcodes to letters and bound spaces.
3. UTF-8 encode the restored text.
4. Refuse if `len != orig_size`.
5. Refuse if SHA-256 != `orig_sha256`.
6. Write bytes. Print `verified: True`, `zip: False`.

Partial decode is not a success.

## 7. Fold and info

```bash
python3 foldlock.py fold INFILE [--out OUT.fld]
python3 foldlock.py unfold IN.fld [--out OUTFILE]
python3 foldlock.py info IN.fld
```

Fold decodes UTF-8 or refuses. Receipt fields include method `tether-suppression`, lexicon, tether hit count, estimated bytes saved inside the stream, orig/folded sizes, ratio, and `zip: False`.

## 8. Paths

Path A — regenerative. The same text may be folded again. New file.

Path B — immutable. Do not rewrite a `.fld` in place.

v0.3 does not stamp A/B into the header.

## 9. Worked miniatures (informative)

VECTORS.txt (exact four lines, orig_size 63, SHA-256 `1db33c4dc38d08b3d29f77f75e15b598e3805a7dde18a7a122b9f257369f4ba1`):

```
the cat and the dog
As is has to and or etc.
and and and
hello
```

Hits: 3, 7, 3, 0. Header makes this tiny file larger than plaintext. That is expected. The check is restore, not ratio.

## 10. Relation to the rest of the mesh

| Sibling        | Boundary                                              |
|----------------|-------------------------------------------------------|
| WhistleLock    | Same preprint, different product and repository.      |
| EmployeeLock   | May index a `.fld` as evidence. Does not suppress.    |
| TemporalLock   | Time receipts. FoldLock has no timestamp field.       |
| GodLock        | Not a codec.                                          |
| UL / BAL       | Issue cluster. Do not file FoldLock under UL-CAT.     |

## 11. Limits

FoldLock v0.3 does not:

- fold non-UTF-8 bytes;
- invent tethers that were never in the file;
- suppress tabs, newlines, or punctuation;
- encrypt;
- stream-fold without reading the file;
- repair a truncated stream;
- claim a zip-beating corpus score.

English is the shipped lexicon language. Other languages need a new `lexicon_id`.

## 12. Reproduction (FL-WP-0.3-R)

```bash
python3 foldlock.py fold   VECTORS.txt --out /tmp/v.fld
python3 foldlock.py unfold /tmp/v.fld --out /tmp/v.out
cmp VECTORS.txt /tmp/v.out
python3 foldlock.py info   /tmp/v.fld
```

Unfold must print `verified: True` and `zip: False`. `cmp` must be silent.

## Status

| Item     | State                                      |
|----------|--------------------------------------------|
| Paper    | FL-WP-0.3 / FL-WP-0.3-R                    |
| Runtime  | foldlock.py v0.3                           |
| Magic    | FLD3                                       |
| Lexicon  | TETH-1 (112 words, append-only)            |
| Method   | algorithmic tether suppression             |
| Zip      | False                                      |
| License  | Apache-2.0                                 |
| Retired  | FL-WP-0.2 zlib wrapper; FL-WP-0.1 store    |
| DOI      | https://doi.org/10.5281/zenodo.22257762    |

A fork that wraps zlib and keeps the name FoldLock is a zip bundle. It is not this spec.

## 13. UNI1 addendum (FL-WP-0.8)

FoldLock v0.8 adds an adaptive champion shell around this TETH-1 method.
It does not invent a new Zenodo DOI. The method paper remains FL-WP-0.3.

Normative shell: [uni1.md](uni1.md).

Changes versus v0.3:

- classify → allowlist → bakeoff → passthrough if the fold would grow;
- short strings are left alone;
- already-compressed input is refused (not wrapped);
- optional peer / abbreviation / number packs (SIR) when they shrink
  and still exact-restore;
- optional Latin peer pack; never translate-then-fold;
- body×X×body only if it wins the bakeoff;
- receipts may record `beats_zstd` per file when zstd-19 is present.
  That is not a universal championship.

v0.3 FLD3 containers still unfold.

Discarded: 2×2 reticule / glyph rotation / crypto-cosplay. See
[experiments-reticule.md](experiments-reticule.md).

Aziel Eliab · 2 September 2026 (method) · 4 September 2026 (UNI1 shell)

