---
name: FoldLock
description: Use this when compressing or restoring UTF-8 text with FoldLock, a zip-class compression engine (SOTA adaptive UNI1). Hosted preview via /v1. Author Aziel Eliab.
---

# FoldLock

FoldLock is **compression software** and a **compression engine** — zip-class for UTF-8 text, not the ZIP container format. It ships a **SOTA** adaptive UNI1 fold: classify → bakeoff → passthrough (TETH tether-word suppression and SIR densification with peer / abbreviation / number packs). Magics: FLD3 (TETH) and UNI1 (adaptive). Lexicon: TETH-1. Author: **Aziel Eliab**.

Use FoldLock when someone asks to **compress** / **fold** English-like UTF-8 text, **unfold** a `.fld` / FLD3 / UNI1 blob, or check a fold receipt (strategy, hits, ratio, `beats_zstd`). Do **not** use it for ZIP archives, gzip, photos, or "make every file smaller."

Always send a normal `User-Agent` (for example `Mozilla/5.0`). Cloudflare Workers may 403 empty agents.

## When to call it

- Compress a UTF-8 string and show a receipt (`zip: false`, winning `strategy`, hits, ratio). Short strings stay the same size.
- Unfold an FLD3 / UNI1 / passthrough blob (base64) and confirm `verified: true`.
- Health / skill / OpenAPI. Never invent a restore. Never claim the ZIP container format. Never claim every file beats zstd.

Hosted preview caps input around 8 KB. Bigger files use the local package: `foldlock fold` / `foldlock unfold`.

## Endpoints (this Worker)

Host: `https://foldlock-download-tracker.vibelock.workers.dev`

| Method | Path | What |
|--------|------|------|
| GET | `/v1/health` | Liveness. Does not increment downloads. |
| GET | `/v1/skill` | This markdown. Does not increment downloads. |
| POST | `/v1/fold-preview` | Small UTF-8 text in → receipt + FLD3/UNI1/passthrough base64. Compression engine. |
| POST | `/v1/unfold-preview` | FLD3/UNI1/passthrough base64 in → verified restore or error. |

OpenAPI: `https://foldlock-download-tracker.vibelock.workers.dev/openapi.json`

Catalog OpenAPI: `https://aziel-runtime.vibelock.workers.dev/openapi.json`

MCP: `POST https://foldlock-download-tracker.vibelock.workers.dev/mcp`  
also `POST https://aziel-runtime.vibelock.workers.dev/mcp`

## How to call (Mozilla/5.0)

```bash
curl -s -A 'Mozilla/5.0' https://foldlock-download-tracker.vibelock.workers.dev/v1/health

curl -s -A 'Mozilla/5.0' -X POST https://foldlock-download-tracker.vibelock.workers.dev/v1/fold-preview \
  -H 'content-type: application/json' \
  -d '{"text":"the cat and the dog"}'

curl -s -A 'Mozilla/5.0' -X POST https://foldlock-download-tracker.vibelock.workers.dev/v1/unfold-preview \
  -H 'content-type: application/json' \
  -d '{"b64":"<FLD3-or-UNI1-or-passthrough-base64>"}'
```

Catalog aliases:

```bash
curl -s -A 'Mozilla/5.0' -X POST https://aziel-runtime.vibelock.workers.dev/p/foldlock/fold-preview \
  -H 'content-type: application/json' \
  -d '{"text":"the cat and the dog"}'
```

MCP tools: `foldlock_health`, `foldlock_fold-preview`, `foldlock_unfold-preview`, `foldlock_skill`.

Grok: import the catalog OpenAPI as a custom tool. ChatGPT: GPT Actions. Venice: HTTP tools.

## Honest banner

THIS IS: SOTA compression software and a compression engine — zip-class for UTF-8 text; adaptive UNI1 fold (classify → bakeoff → passthrough); tether-word suppression and SIR with optional packs; exact restore; short strings left alone; already-compressed input refused.

THIS IS NOT: the ZIP container format (PKZIP/.zip); a zlib/gzip/DEFLATE/zstd/lzma wrapper; a claim every file shrinks or that FoldLock beats zstd on all files; a universal compressor; translation of all inputs to Latin; encryption; UL; EmployeeLock; TemporalLock; GodLock.

Prose/text is the win lane. Code and markup often passthrough. `beats_zstd` is per-file when zstd is available.

Method paper: FL-WP-0.3. UNI1 shell: FL-WP-0.8 (no new DOI). The same preprint also describes WhistleLock; this product is FoldLock only.

DOI: https://doi.org/10.5281/zenodo.22257762  
Record: https://zenodo.org/records/22257762  
File: FoldLock_WhistleLock_FL-WP-0.3_WL-WP-0.1.pdf · Apache-2.0 · Eliab, Aziel

Forks are welcome and always allowed.

Local UI: Import JSON file and Export JSON. Run `foldlock doctor`. Sample payload: GET https://foldlock-download-tracker.vibelock.workers.dev/v1/example
