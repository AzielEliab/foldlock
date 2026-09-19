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
`/v1/mesh/*` PROXY to aziel-runtime suite mesh (`AZIEL_RUNTIME` / `https://aziel-runtime.vibelock.workers.dev`). Default OFF. QNM-BUILD-1.0 live|locked|isolated. QNS-CD-1.0 photon QNS1 packet transfer is a hub cite / Worker mesh cross-map only (local qnsd in [qnm-node](https://github.com/AzielEliab/qnm-node); runtime cites + catalog field in [aziel-runtime](https://github.com/AzielEliab/aziel-runtime); pair custody in [AZInterface](https://github.com/AzielEliab/azinterface)). Not a Softwares-tab product. No public qnsd proxy. No Node Gate. No auto-heal. Not anonymity. Human UI Live Nodes strip polls `GET /v1/mesh`.

Verify: `curl -sS -A 'Mozilla/5.0' https://foldlock-download-tracker.vibelock.workers.dev/v1/mesh/status` returns MESH-OK style JSON with `enabled: false` by default.

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

## Human / bot schema (`/stats` and `/count`)

Additive dual-count (Whitestone canary). Classification lives in `src/classify.js`
and response shaping in `src/stats-shape.js`.

Invariant: `views === views_human + views_bot` and
`downloads === downloads_human + downloads_bot`.

Legacy strategy (b): existing KV totals are never reset. Pre-split remainder
is shown as bot on read (`views_bot = views - views_human`). Author: Aziel Eliab only.

