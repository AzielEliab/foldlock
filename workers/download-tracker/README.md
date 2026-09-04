# foldlock download tracker

Isolated Worker `foldlock-download-tracker`. Project `foldlock`.
KV namespace `FOLDLOCK_DOWNLOADS` bound as `DOWNLOADS`.
Does **not** 302 to GitHub on `/download`. Serves gzip via `ASSETS.fetch`,
`Cache-Control: private, no-store`.

`/v1` hosts FoldLock 0.8.0-UNI1 — zip-class SOTA compression engine
(classify → bakeoff → passthrough). Not the ZIP file format.
Author Aziel Eliab.

GET `/` increments a **page-view** counter (separate from downloads).
GET `/download` increments **downloads**.
`/v1` never increments DOWNLOADS KV.

Host: https://foldlock-download-tracker.vibelock.workers.dev

## Deploy

Account `ac575a9b822bea2bed97d0ab73aed238`. Isolated KV `FOLDLOCK_DOWNLOADS`.
Needs `CLOUDFLARE_API_TOKEN` (edit Workers + Workers KV + Workers Assets on that account).

```bash
cd workers/download-tracker
npm install
npx wrangler deploy
```

Default counted asset: `public/foldlock-0.8.0.tar.gz` via `/download` and
`/download?asset=foldlock-0.8.0.tar.gz`. Rebuild the sdist from repo root
(`python3 -m build --sdist`) and copy `dist/foldlock-0.8.0.tar.gz` here
before deploy.
