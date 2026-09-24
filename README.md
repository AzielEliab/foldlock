# FoldLock

FoldLock makes a UTF-8 text file smaller when it can, then restores the same bytes.

**Author:** Aziel Eliab
**License:** [Apache-2.0](LICENSE)
**Version:** 0.8.0

## Start

1. `python -m venv .venv && source .venv/bin/activate && pip install -e .`
2. `foldlock ui`
3. Open http://127.0.0.1:8872/ and choose **Fold**.

From a file you already have: `foldlock fold examples/PROSE.txt`

See [RUN.txt](RUN.txt) for the same three steps.

## Commands

```bash
foldlock
foldlock fold INFILE [--out OUT.fld]
foldlock unfold IN.fld [--out OUTFILE]
foldlock info IN.fld
foldlock ui
foldlock doctor
foldlock --help
```

People get short sentences. Add `--json` for the machine receipt (`fold`, `unfold`, `info`, `doctor`).

Advanced: `foldlock fold INFILE --latin-pack` also tries the optional Latin peer pack. Opcodes restore the original English words.

`foldlock ui` listens on `127.0.0.1` only. The page has one primary action, **Fold**. **Unfold** sits beside it. Verify, Doctor, sample text, receipts, and JSON import/export are under **Advanced**.

## Notes

FoldLock folds UTF-8 text. It classifies the text, tries the folds it knows, and keeps the smallest exact restore. When folding would not shrink the file, the original bytes are written unchanged. Short text stays the same size. Photos, ZIP archives, and other already-compressed files are refused. A restore is kept when the size and SHA-256 match. Ratios and `beats_zstd` belong to that file. FLD3 files from v0.3 still unfold.

| Input | What FoldLock does |
|-------|--------------------|
| Prose / markdown / plain text | Keep the smallest exact restore |
| Source code | Tether fold, or leave unchanged |
| JSON / HTML / XML | Often leave unchanged |
| zip / png / jpg / pdf / zst / … | Refuse |
| Short strings | Leave unchanged |
| Mixed / unknown UTF-8 | Try; leave unchanged when nothing shrinks |

Spec `foldlock-v0.8-UNI1`. Magics `FLD3` / `UNI1`. Lexicon TETH-1 (112 words).
Method paper FL-WP-0.3 — [docs/whitepaper.md](docs/whitepaper.md) · DOI [10.5281/zenodo.22257762](https://doi.org/10.5281/zenodo.22257762).
UNI1 shell FL-WP-0.8 — [docs/uni1.md](docs/uni1.md).
Discarded reticule experiment: [docs/experiments-reticule.md](docs/experiments-reticule.md).

**Forks are welcome and always allowed.**

## Install from the counted download

```bash
curl -fsSL https://foldlock-download-tracker.vibelock.workers.dev/install.sh | bash
```

The script downloads the counted tarball (`/download`, User-Agent `Mozilla/5.0`), extracts it, makes a venv, and runs `pip install -e .`. Then run `foldlock ui`.

Counted tarball:
[foldlock-0.8.0.tar.gz](https://foldlock-download-tracker.vibelock.workers.dev/download?asset=foldlock-0.8.0.tar.gz)

- Live count JSON: [https://foldlock-download-tracker.vibelock.workers.dev/stats](https://foldlock-download-tracker.vibelock.workers.dev/stats)
- OpenAPI: [https://foldlock-download-tracker.vibelock.workers.dev/openapi.json](https://foldlock-download-tracker.vibelock.workers.dev/openapi.json)
- Skill: [https://foldlock-download-tracker.vibelock.workers.dev/v1/skill](https://foldlock-download-tracker.vibelock.workers.dev/v1/skill)
- Suite mesh proxy: [https://foldlock-download-tracker.vibelock.workers.dev/v1/mesh](https://foldlock-download-tracker.vibelock.workers.dev/v1/mesh) — default OFF; QNM live / locked / isolated; QNS-CD-1.0 photon QNS1 packet transfer (hub cite / Worker mesh cross-map only; no public qnsd proxy)
- GitHub: [https://github.com/AzielEliab/foldlock](https://github.com/AzielEliab/foldlock)

Isolated counter: Worker `foldlock-download-tracker`, KV `FOLDLOCK_DOWNLOADS`. `/v1` does not increment downloads.

## iPhone & Android

Flutter sources: [`mobile/`](mobile/). Application id `com.azieeliab.foldlock`. Offline. The phone screen is a simple reader. The fold runs in this desktop package.

```bash
cd mobile
flutter create --org com.azieeliab --project-name foldlock .
flutter pub get && flutter run
```

## Hosted preview

The Worker hosts a stateless preview API. It does not increment DOWNLOADS.

- `GET /v1/health`
- `GET /v1/skill` — this repo's [SKILL.md](SKILL.md)
- `GET /v1/mesh` — PROXY suite mesh status (default OFF; QNM-BUILD-1.0 live|locked|isolated; QNS-CD-1.0 cross-map)
- `POST /v1/fold-preview` — small UTF-8 text in, receipt + container or unchanged bytes base64 (cap ~8 KB)
- `POST /v1/unfold-preview` — FLD3 / UNI1 / passthrough base64 in, verified restore or error
- OpenAPI: `/openapi.json`
- MCP: this Worker `/mcp` and catalog `https://aziel-runtime.vibelock.workers.dev/mcp`. Suite mesh `/v1/mesh/*` PROXY via `AZIEL_RUNTIME` (default OFF; QNM-BUILD-1.0 live|locked|isolated; QNS-CD-1.0 photon QNS1 packet transfer is a hub cite / Worker mesh cross-map only — local qnsd in [qnm-node](https://github.com/AzielEliab/qnm-node), runtime cites + catalog field in [aziel-runtime](https://github.com/AzielEliab/aziel-runtime), pair custody in [AZInterface](https://github.com/AzielEliab/azinterface); no public qnsd proxy; not a Softwares-tab product; no Node Gate). Catalog MCP `mesh_*` + FragGate `slug=mesh`.

Catalog card fields live in [docs/catalog-aziel-runtime.md](docs/catalog-aziel-runtime.md).

## Use with AI assistants

Works with OpenAPI- and MCP-capable assistants, including **ChatGPT (GPT Actions / OpenAI)**, **Grok (xAI)**, **Venice**, **Claude (Anthropic)**, **Cursor (MCP)**, **Glama (MCP)**, **Perplexity**, **Microsoft Copilot / Bing**, **Google Gemini / Vertex**, **Mistral**, **Meta AI**, **Apple Intelligence surfaces**, **Amazon Q tooling**, **DuckAssist**, **You.com**, **Cohere**, and other MCP/OpenAPI-capable assistants.

Always send `User-Agent: Mozilla/5.0`. Empty agents can 403.

**OpenAPI (no auth)** — Import from URL:
`https://aziel-runtime.vibelock.workers.dev/openapi.json`
(or this Worker's `https://foldlock-download-tracker.vibelock.workers.dev/openapi.json`).

**MCP** — Cursor, Glama, and other MCP clients:
`POST https://aziel-runtime.vibelock.workers.dev/mcp`
(or `POST https://foldlock-download-tracker.vibelock.workers.dev/mcp`).
Tools: `foldlock_health`, `foldlock_fold-preview`, `foldlock_unfold-preview`, `foldlock_skill`.

```bash
curl -s -A 'Mozilla/5.0' -X POST \
  https://aziel-runtime.vibelock.workers.dev/p/foldlock/fold-preview \
  -H 'content-type: application/json' \
  -d '{"text":"the cat and the dog"}'
```

Skill markdown: [SKILL.md](SKILL.md) · live `GET /v1/skill`.

## Papers

See [docs/whitepaper.md](docs/whitepaper.md) (FL-WP-0.3 / FL-WP-0.3-R) and
[docs/uni1.md](docs/uni1.md) (FL-WP-0.8 adaptive shell).

The FL-WP-0.3 preprint also describes WhistleLock. This repository is FoldLock only. WhistleLock stays in its own repository.

- Paper (PDF): [FoldLock_WhistleLock_FL-WP-0.3_WL-WP-0.1.pdf](https://zenodo.org/records/22257762)
- DOI: [https://doi.org/10.5281/zenodo.22257762](https://doi.org/10.5281/zenodo.22257762)
- Zenodo record: [https://zenodo.org/records/22257762](https://zenodo.org/records/22257762)
- License: Apache-2.0. Creator: Eliab, Aziel.

## Sibling products

| Sibling | Boundary |
|---------|----------|
| WhistleLock | Local drop + dead-man. Same preprint, different repo. |
| EmployeeLock | May index a `.fld` as a file. It does not fold. |
| TemporalLock | Time receipts. FoldLock has no timestamp field. |
| GodLock | Public ABAD node. A sibling product name. |
| UL / BAL | Issue papers stay issue papers. |

## Tests

```bash
python -m pytest -q
```

`examples/VECTORS.txt` must exact-restore and must not grow. `examples/PROSE.txt` must shrink and exact-restore. png/zip fixtures must be refused. `foldlock doctor` must pass.

## Cite this

Aziel Eliab. FoldLock. https://github.com/AzielEliab/foldlock. https://foldlock-download-tracker.vibelock.workers.dev. https://doi.org/10.5281/zenodo.22257762.

- Catalog: https://aziel-runtime.vibelock.workers.dev/
- Counted download: https://foldlock-download-tracker.vibelock.workers.dev/download
- GitHub: https://github.com/AzielEliab/foldlock
- Citation JSON: https://foldlock-download-tracker.vibelock.workers.dev/cite.json
- DOI (TETH-1 method paper): https://doi.org/10.5281/zenodo.22257762
