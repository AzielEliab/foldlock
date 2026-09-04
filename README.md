# FoldLock

SOTA compression software and a compression engine — zip-class for UTF-8 text via adaptive UNI1 (classify → bakeoff → passthrough).

**Author:** Aziel Eliab
**Date:** 4 September 2026
**License:** [Apache-2.0](LICENSE)
**Version:** 0.8.0-UNI1
**Spec:** `foldlock-v0.8-UNI1` · Magics `FLD3` / `UNI1` · Lexicon TETH-1 (112 words)
**Method paper:** FL-WP-0.3 — [docs/whitepaper.md](docs/whitepaper.md) · DOI [10.5281/zenodo.22257762](https://doi.org/10.5281/zenodo.22257762)
**UNI1 shell:** FL-WP-0.8 — [docs/uni1.md](docs/uni1.md) (repo spec; no new DOI)

> Pull the tethers. Restore the bytes. Zip-class compression — not the ZIP container format.

**Forks are welcome and always allowed.**

## Honest scope

**THIS IS:** SOTA compression software and a compression engine — zip-class for UTF-8 text; adaptive UNI1 fold (classify → bakeoff → passthrough); tether-word suppression (TETH/FLD4) and structural SIR/FLD5 with optional dictionary, abbreviation, number, and peer packs; exact restore of the original bytes; short strings left alone; already-compressed input refused.

**THIS IS NOT:** the ZIP container format (PKZIP/.zip); a zlib/gzip/DEFLATE/zstd/lzma wrapper; a claim every file shrinks or that FoldLock beats zstd on all files; a universal compressor; translation of all inputs to Latin; encryption; UL; EmployeeLock; TemporalLock; GodLock; a published industry bake-off. Prose/text is the win lane. Code and markup often passthrough. Ratios are receipts not trophies. `beats_zstd` is per-file when zstd is available, never a global championship.

| Input | What FoldLock does |
|-------|--------------------|
| Prose / markdown / plain text | Compete SIR + TETH + peer; keep the smallest exact restore |
| Source code | TETH or passthrough |
| JSON / HTML / XML | Often leave alone |
| zip / png / jpg / pdf / zst / … | Refuse |
| Short strings | Passthrough — they do not grow |
| Mixed / unknown UTF-8 | Compete; passthrough if nothing shrinks |

v0.3 FLD3 files still unfold. Discarded reticule / glyph-rotation experiment: [docs/experiments-reticule.md](docs/experiments-reticule.md).

## One-click install

```bash
curl -fsSL https://foldlock-download-tracker.vibelock.workers.dev/install.sh | bash
```

The script curls the **counted** tarball from this project's Worker
(`/download`, User-Agent `Mozilla/5.0`), extracts, makes a venv, and
`pip install -e .`. Then run `foldlock ui`.

Or tap **Download and install** / **Install** on the Worker homepage
(a 6th-grader can tap it):
https://foldlock-download-tracker.vibelock.workers.dev/

## Quick start

```bash
python -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"
python3 foldlock.py fold examples/PROSE.txt --out /tmp/p.fld
python3 foldlock.py unfold /tmp/p.fld --out /tmp/p.out
cmp examples/PROSE.txt /tmp/p.out
foldlock doctor
foldlock ui
```

Open http://127.0.0.1:8872 (loopback only). No CDN, no telemetry.

`examples/VECTORS.txt` (63 bytes) is left alone (passthrough). Unfold is identity. That is the short-string rule.

Optional Latin peer pack (opcodes restore English; never translate-then-fold):

```bash
python3 foldlock.py fold examples/PROSE.txt --out /tmp/p.fld --latin-pack
```

## Counted download (Cloudflare Worker)

**This is the counted download.** GitHub releases exist as a mirror.
The Worker serves the gzip itself (HTTP 200, no 302 to GitHub).

# → [https://foldlock-download-tracker.vibelock.workers.dev/](https://foldlock-download-tracker.vibelock.workers.dev/) ←

Direct tarball (also counted):
[foldlock-0.8.0.tar.gz](https://foldlock-download-tracker.vibelock.workers.dev/download?asset=foldlock-0.8.0.tar.gz)

- Live count JSON: [https://foldlock-download-tracker.vibelock.workers.dev/stats](https://foldlock-download-tracker.vibelock.workers.dev/stats)
- OpenAPI: [https://foldlock-download-tracker.vibelock.workers.dev/openapi.json](https://foldlock-download-tracker.vibelock.workers.dev/openapi.json)
- Skill: [https://foldlock-download-tracker.vibelock.workers.dev/v1/skill](https://foldlock-download-tracker.vibelock.workers.dev/v1/skill)
- GitHub: [https://github.com/AzielEliab/foldlock](https://github.com/AzielEliab/foldlock)

Isolated counter: Worker `foldlock-download-tracker`, KV `FOLDLOCK_DOWNLOADS`. Not mixed with any other product. `/v1` does not increment downloads.

## CLI

```bash
python3 foldlock.py fold INFILE [--out OUT.fld] [--latin-pack]
python3 foldlock.py unfold IN.fld [--out OUTFILE]
python3 foldlock.py info IN.fld
foldlock ui
foldlock doctor
```

Unfold prints `verified: True` and `zip: False` when size and SHA-256 match.
FLD2 (zlib wrapper) is refused. Already-compressed files (png/zip/…) are refused.
Short strings and no-shrink losers are written as the original bytes (`magic: PASS`).

## Local UI

`foldlock ui` serves a loopback dashboard at http://127.0.0.1:8872

Simple: **Fold**, **Unfold**, **Verify**. Advanced (tucked away): Info,
Doctor, Sample vectors, Export receipt, hashes, hits, ratio, strategy.
Import JSON / Export JSON. Shows `zip: False` and the winning strategy.
Binds `127.0.0.1` only.

## iPhone & Android

Flutter sources: [`mobile/`](mobile/). Application id
`com.azieeliab.foldlock`. Offline. No analytics. Dark matte / gold.
Not a store listing. Not a separate repo.

```bash
cd mobile
flutter create --org com.azieeliab --project-name foldlock .
flutter pub get
flutter run
```

## Hosted `/v1`

The Worker hosts a **stateless** preview API. It does not increment DOWNLOADS.

- `GET /v1/health`
- `GET /v1/skill` — this repo's [SKILL.md](SKILL.md)
- `POST /v1/fold-preview` — small UTF-8 text in, receipt + container or passthrough base64 (cap ~8 KB)
- `POST /v1/unfold-preview` — FLD3 / UNI1 / passthrough base64 in, verified restore or error
- OpenAPI: `/openapi.json`
- MCP: this Worker `/mcp` and catalog `https://aziel-runtime.vibelock.workers.dev/mcp`

Banner: SOTA UNI1 compression engine.

Catalog card fields to bump on **aziel-runtime** (separate deploy) and the
Downloadable-software listing hint for azielcorpuslibrary:
[docs/catalog-aziel-runtime.md](docs/catalog-aziel-runtime.md).

## AI (Grok, ChatGPT, Venice)

Always send `User-Agent: Mozilla/5.0`. Empty agents can 403.

**ChatGPT** — GPT Actions → Import from URL →
`https://aziel-runtime.vibelock.workers.dev/openapi.json`
(or this Worker's `https://foldlock-download-tracker.vibelock.workers.dev/openapi.json`).

**Grok** — custom tool / OpenAPI: same catalog URL.
MCP remote: `POST https://aziel-runtime.vibelock.workers.dev/mcp`
(or `POST https://foldlock-download-tracker.vibelock.workers.dev/mcp`).
Tools: `foldlock_health`, `foldlock_fold-preview`, `foldlock_unfold-preview`, `foldlock_skill`.

**Venice** — custom HTTP tools / OpenAPI: same catalog OpenAPI.

Example:

```bash
curl -s -A 'Mozilla/5.0' -X POST \
  https://aziel-runtime.vibelock.workers.dev/p/foldlock/fold-preview \
  -H 'content-type: application/json' \
  -d '{"text":"the cat and the dog"}'
```

Skill markdown: [SKILL.md](SKILL.md) · live `GET /v1/skill`.

TETH-1 method DOI: [10.5281/zenodo.22257762](https://doi.org/10.5281/zenodo.22257762). UNI1 has no new DOI.

## Papers

See [docs/whitepaper.md](docs/whitepaper.md) (FL-WP-0.3 / FL-WP-0.3-R) and
[docs/uni1.md](docs/uni1.md) (FL-WP-0.8 adaptive shell).

The FL-WP-0.3 preprint also describes **WhistleLock**. **This repository is FoldLock only.** Do not put WhistleLock code here.

- Paper (PDF): [FoldLock_WhistleLock_FL-WP-0.3_WL-WP-0.1.pdf](https://zenodo.org/records/22257762)
- DOI: [https://doi.org/10.5281/zenodo.22257762](https://doi.org/10.5281/zenodo.22257762)
- Zenodo record: [https://zenodo.org/records/22257762](https://zenodo.org/records/22257762)
- License: Apache-2.0. Creator: Eliab, Aziel.

## Mesh (siblings, not this product)

| Sibling | Boundary |
|---------|----------|
| WhistleLock | Local drop + dead-man. Same preprint, different repo. |
| EmployeeLock | May index a `.fld` as a file. It does not fold. |
| TemporalLock | Time receipts. FoldLock has no timestamp field. |
| GodLock | Public ABAD node. Not a codec. |
| UL / BAL | Issue papers stay issue papers. Do not file FoldLock under UL-CAT. |

## Tests

```bash
python -m pytest -q
```

VECTORS.txt must exact-restore and must not grow. PROSE.txt must shrink and exact-restore. png/zip fixtures must be refused. `foldlock doctor` must pass.

## Use with Grok / ChatGPT / Venice

Catalog OpenAPI: https://aziel-runtime.vibelock.workers.dev/openapi.json
Catalog MCP: `POST https://aziel-runtime.vibelock.workers.dev/mcp`
This Worker skill: https://foldlock-download-tracker.vibelock.workers.dev/v1/skill
This Worker OpenAPI: https://foldlock-download-tracker.vibelock.workers.dev/openapi.json

Grok: import the catalog or Worker OpenAPI as a custom tool. ChatGPT: GPT Actions (no auth). Venice: HTTP tools. Always send `User-Agent: Mozilla/5.0`.

## Cite this

Aziel Eliab. FoldLock. https://github.com/AzielEliab/foldlock. https://foldlock-download-tracker.vibelock.workers.dev. https://doi.org/10.5281/zenodo.22257762.

- Catalog: https://aziel-runtime.vibelock.workers.dev/
- Worker homepage: https://foldlock-download-tracker.vibelock.workers.dev/
- Counted download (gzip HTTP 200, no 302): https://foldlock-download-tracker.vibelock.workers.dev/download
- GitHub: https://github.com/AzielEliab/foldlock
- Citation JSON: https://foldlock-download-tracker.vibelock.workers.dev/cite.json
- DOI (TETH-1 method paper): https://doi.org/10.5281/zenodo.22257762
