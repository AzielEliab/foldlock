---
name: FoldLock
description: Use this when folding or unfolding UTF-8 text with FoldLock tether-word suppression (not zip). Hosted preview via /v1. Author Aziel Eliab.
---

# FoldLock

FoldLock pulls common little words (tethers) out of UTF-8 text and puts them back later. It is **not zip**. Magic is FLD3. Lexicon is TETH-1. Author: **Aziel Eliab**.

Use FoldLock when someone asks to **fold** English-like UTF-8 text, **unfold** a `.fld` / FLD3 blob, or check a fold receipt (hits, ratio, hashes). Do **not** use it for zip, gzip, photos, or "make every file smaller."

Always send a normal `User-Agent` (for example `Mozilla/5.0`). Cloudflare Workers may 403 empty agents.

## When to call it

- Fold a short UTF-8 string and show a receipt (`zip: false`, method `tether-suppression`, hits, ratio).
- Unfold an FLD3 blob (base64) and confirm `verified: true`.
- Health / skill / OpenAPI. Never invent a restore. Never claim zip.

Hosted preview caps input around 8 KB. Bigger files use the local package: `foldlock fold` / `foldlock unfold`.

## Endpoints (this Worker)

Host: `https://foldlock-download-tracker.vibelock.workers.dev`

| Method | Path | What |
|--------|------|------|
| GET | `/v1/health` | Liveness. Does not increment downloads. |
| GET | `/v1/skill` | This markdown. Does not increment downloads. |
| POST | `/v1/fold-preview` | Small UTF-8 text in → receipt + FLD3 base64. Not zip. |
| POST | `/v1/unfold-preview` | FLD3 base64 in → verified restore or error. |

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
  -d '{"b64":"<FLD3-base64>"}'
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

THIS IS: reversible tether-word suppression on UTF-8 text; 3-byte opcode per tether; exact restore of letters and bound ASCII spaces.

THIS IS NOT: zip/zlib/gzip/DEFLATE/zstd/lzma; a claim every file shrinks; UL; EmployeeLock; TemporalLock; GodLock; a published bake-off. Ratios are receipts not trophies. Short strings can grow.

Paper: FL-WP-0.3. The same preprint also describes WhistleLock; this product is FoldLock only.

DOI: https://doi.org/10.5281/zenodo.22257762  
Record: https://zenodo.org/records/22257762  
File: FoldLock_WhistleLock_FL-WP-0.3_WL-WP-0.1.pdf · Apache-2.0 · Eliab, Aziel

Forks are welcome and always allowed.
