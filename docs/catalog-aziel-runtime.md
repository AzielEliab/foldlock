# Catalog bump: FoldLock 0.8.0-UNI1

Author: **Aziel Eliab**. No new DOI. Do not credit any other author.

This is the exact machine-readable card for **aziel-runtime**
(`https://github.com/AzielEliab/aziel-runtime`) and a listing hint for
**azielcorpuslibrary** (Downloadable software). Another agent owns the
corpus site UI.

Live catalog should already lead as SOTA compression software / compression
engine. FoldLock Worker health/skill/fold-preview/unfold-preview stay
routed: `/p/foldlock/{op}` → `foldlock-download-tracker.vibelock.workers.dev/v1/{op}`.

## aziel-runtime `PRODUCTS_RAW` / `/v1/catalog.json` fields

Replace the `slug: "foldlock"` object (and `ONE_LINE.foldlock`). Do not
reorder other products. Do not invent a DOI.

```json
{
  "slug": "foldlock",
  "name": "FoldLock",
  "one_line": "SOTA compression engine for UTF-8 text. Zip-class adaptive UNI1.",
  "github": "https://github.com/AzielEliab/foldlock",
  "worker": "foldlock-download-tracker",
  "download": "https://foldlock-download-tracker.vibelock.workers.dev/download",
  "install": "https://foldlock-download-tracker.vibelock.workers.dev/install.sh",
  "skill": "https://foldlock-download-tracker.vibelock.workers.dev/v1/skill",
  "openapi": "https://foldlock-download-tracker.vibelock.workers.dev/openapi.json",
  "doi": "10.5281/zenodo.22257762",
  "doi_url": "https://doi.org/10.5281/zenodo.22257762",
  "banner": "FoldLock 0.8.0-UNI1 is SOTA compression software and a compression engine — zip-class for UTF-8 text. Adaptive UNI1: classify → bakeoff → passthrough (tether/SIR packs). Prose/text is the win lane. Short strings are left alone. Already-compressed files are refused. Per-file receipts may include ratios and beats_zstd. Hosted preview compresses small text samples. Author Aziel Eliab.",
  "ops": [
    {
      "op": "health",
      "method": "GET",
      "summary": "Liveness for FoldLock compression engine. Does not increment download KV."
    },
    {
      "op": "fold-preview",
      "method": "POST",
      "summary": "Compress small UTF-8 text → receipt + FLD3/UNI1/passthrough base64. Cap ~8KB. SOTA adaptive UNI1 engine."
    },
    {
      "op": "unfold-preview",
      "method": "POST",
      "summary": "Decompress FLD3/UNI1/passthrough base64 → verified restore or error."
    },
    {
      "op": "skill",
      "method": "GET",
      "summary": "Return FoldLock skill markdown. Does not increment download KV."
    }
  ],
  "example": { "text": "the cat and the dog" },
  "catalog_card": "https://aziel-runtime.vibelock.workers.dev/p/foldlock",
  "catalog_health": "https://aziel-runtime.vibelock.workers.dev/p/foldlock/health",
  "catalog_skill": "https://aziel-runtime.vibelock.workers.dev/p/foldlock/skill"
}
```

Honesty line (catalog homepage + OpenAPI `info.description`):

> FoldLock 0.8.0-UNI1 is SOTA compression software and a compression engine — zip-class for UTF-8 text. Adaptive UNI1: classify → bakeoff → passthrough (tether/SIR packs). Prose/text is the win lane. Short strings are left alone. Already-compressed files are refused. Per-file receipts may include ratios and beats_zstd. Not the ZIP container format.

Source files in aziel-runtime:

- `src/index.js` — `PRODUCTS_RAW` foldlock object, `ONE_LINE.foldlock`, homepage honesty `<li>`, OpenAPI description sentence
- `README.md` — honesty banner bullet

Ops stay `health`, `fold-preview`, `unfold-preview`, `skill`. Do not drop routing.

## azielcorpuslibrary — Downloadable software card

For the corpus-site agent. Section: **Downloadable software**. Not a 26-card
software index rewrite. Author Aziel Eliab only.

```json
{
  "section": "Downloadable software",
  "slug": "foldlock",
  "name": "FoldLock",
  "version": "0.8.0-UNI1",
  "author": "Aziel Eliab",
  "one_line": "SOTA compression engine for UTF-8 text. Zip-class adaptive UNI1.",
  "banner": "Classify → bakeoff → passthrough. Short strings are left alone. Already-compressed files are refused. Prose/text is the win lane. Ratios are receipts, not a zstd championship. Not the ZIP container format.",
  "github": "https://github.com/AzielEliab/foldlock",
  "download": "https://foldlock-download-tracker.vibelock.workers.dev/download?asset=foldlock-0.8.0.tar.gz",
  "install": "curl -fsSL https://foldlock-download-tracker.vibelock.workers.dev/install.sh | bash",
  "worker": "https://foldlock-download-tracker.vibelock.workers.dev/",
  "catalog": "https://aziel-runtime.vibelock.workers.dev/p/foldlock",
  "skill": "https://foldlock-download-tracker.vibelock.workers.dev/v1/skill",
  "doi": "10.5281/zenodo.22257762",
  "license": "Apache-2.0"
}
```
