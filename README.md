# FoldLock

Algorithmic tether-word suppression. UTF-8 text fold. Not zip.

**Author:** Aziel Eliab
**Date:** 2 September 2026
**License:** [Apache-2.0](LICENSE)
**Version:** 0.3.0
**Spec:** `foldlock-v0.3` · Magic `FLD3` · Lexicon TETH-1 (112 words)
**Paper:** FL-WP-0.3 — [docs/whitepaper.md](docs/whitepaper.md) · DOI [10.5281/zenodo.22257762](https://doi.org/10.5281/zenodo.22257762)

> Pull the tethers. Restore the bytes. Do not ship a zip and call it a fold.

**Forks are welcome and always allowed.**

## Honest scope

**THIS IS:** reversible tether-word suppression on UTF-8 text; 3-byte opcode per tether; exact restore of letters and bound ASCII spaces.

**THIS IS NOT:** zip/zlib/gzip/DEFLATE/zstd/lzma; a claim every file shrinks; UL; EmployeeLock; TemporalLock; GodLock; a published bake-off. Ratios are receipts not trophies. Short strings can grow.

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
python3 foldlock.py fold examples/VECTORS.txt --out /tmp/v.fld
python3 foldlock.py unfold /tmp/v.fld --out /tmp/v.out
cmp examples/VECTORS.txt /tmp/v.out
foldlock ui
```

Open http://127.0.0.1:8872 (loopback only). No CDN, no telemetry.

Self-check: `foldlock doctor`.

## Counted download (Cloudflare Worker)

**This is the counted download.** GitHub releases exist as a mirror.
The Worker serves the gzip itself (HTTP 200, no 302 to GitHub).

# → [https://foldlock-download-tracker.vibelock.workers.dev/](https://foldlock-download-tracker.vibelock.workers.dev/) ←

Direct tarball (also counted):
[foldlock-0.3.0.tar.gz](https://foldlock-download-tracker.vibelock.workers.dev/download?asset=foldlock-0.3.0.tar.gz)

- Live count JSON: [https://foldlock-download-tracker.vibelock.workers.dev/stats](https://foldlock-download-tracker.vibelock.workers.dev/stats)
- OpenAPI: [https://foldlock-download-tracker.vibelock.workers.dev/openapi.json](https://foldlock-download-tracker.vibelock.workers.dev/openapi.json)
- Skill: [https://foldlock-download-tracker.vibelock.workers.dev/v1/skill](https://foldlock-download-tracker.vibelock.workers.dev/v1/skill)
- GitHub: [https://github.com/AzielEliab/foldlock](https://github.com/AzielEliab/foldlock)

Isolated counter: Worker `foldlock-download-tracker`, KV `FOLDLOCK_DOWNLOADS`. Not mixed with any other product. `/v1` does not increment downloads.

## CLI

```bash
python3 foldlock.py fold INFILE [--out OUT.fld]
python3 foldlock.py unfold IN.fld [--out OUTFILE]
python3 foldlock.py info IN.fld
foldlock ui
foldlock doctor
```

Unfold prints `verified: True` and `zip: False` when size and SHA-256 match.
FLD2 (zlib wrapper) is refused. Binary (non-UTF-8) is refused.

## Local UI

`foldlock ui` serves a loopback dashboard at http://127.0.0.1:8872

Simple: **Fold**, **Unfold**, **Verify**. Advanced (tucked away): Info,
Doctor, Sample vectors, Export receipt, hashes, hits, ratio.
Shows `zip: False`, method `tether-suppression`. Binds `127.0.0.1` only.

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
- `POST /v1/fold-preview` — small UTF-8 text in, receipt + FLD3 base64 out (cap ~8 KB)
- `POST /v1/unfold-preview` — FLD3 base64 in, verified restore or error
- OpenAPI: `/openapi.json`
- MCP: this Worker `/mcp` and catalog `https://aziel-runtime.vibelock.workers.dev/mcp`

Banner: not zip.

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

Paper DOI for the method: [10.5281/zenodo.22257762](https://doi.org/10.5281/zenodo.22257762).

## Papers

See [docs/whitepaper.md](docs/whitepaper.md) (FL-WP-0.3 and FL-WP-0.3-R).

The same preprint also describes **WhistleLock**. **This repository is FoldLock only.** Do not put WhistleLock code here.

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

VECTORS.txt (four lines, orig_size 63) must unfold with `verified: True` and `zip: False`.

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
- DOI: https://doi.org/10.5281/zenodo.22257762
