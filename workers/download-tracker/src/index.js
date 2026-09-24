import { handleMeshApi } from "./mesh.js";
import { handleRuntimeApi } from "./runtime.js";
import { classifyRequest, readBotManagement } from "./classify.js";
import {
  isolatedKeys,
  isReservedCounterKey,
  shapeCountBody,
  shapeHumanBotFields,
} from "./stats-shape.js";

/**
 * FoldLock download tracker (Cloudflare Worker).
 *
 * GET  /          increments page-view counter, HTML with Views + Downloads
 * GET  /download  increments downloads, serves tarball via env.ASSETS.fetch (no 302)
 * GET  /go        increments downloads, still serves via this Worker (no 302 to GitHub)
 * GET  /install.sh  one-click install script (does not increment; script curls /download)
 * GET  /stats     {views, downloads, total, by_repo, github:{stars,forks,watchers,release_download_count}}
 * POST /event     forks report a download {owner,repo,branch,fork,asset}
 *
 * KV binding DOWNLOADS. Isolated: Worker foldlock-download-tracker, KV FOLDLOCK_DOWNLOADS.
 * /v1, /v1/mesh/* do not increment. Suite mesh PROXY via AZIEL_RUNTIME.
 */

const PROJECT = "foldlock";
const KEYS = isolatedKeys(PROJECT);

const DEFAULT_ASSET = "foldlock-0.8.0.tar.gz";
const DEFAULT_OWNER = "AzielEliab";
const DEFAULT_REPO = "foldlock";
const DEFAULT_BRANCH = "main";
const HOST = "https://foldlock-download-tracker.vibelock.workers.dev";
const GITHUB_RELEASES = "https://github.com/AzielEliab/foldlock/releases";
const GITHUB_LATEST = "https://github.com/AzielEliab/foldlock/releases/latest";
const GITHUB_REPO = "https://github.com/AzielEliab/foldlock";
const DOI = "https://doi.org/10.5281/zenodo.22257762";
const ZENODO = "https://zenodo.org/records/22257762";
const INSTALL_LINE = "curl -fsSL https://foldlock-download-tracker.vibelock.workers.dev/install.sh | bash";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, X-Aziel-Runtime-Token, User-Agent",
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders() },
  });
}

function splitOwnerRepo(value, fallbackOwner, fallbackRepo) {
  if (typeof value === "string" && value.includes("/")) {
    const [o, r] = value.split("/").filter(Boolean);
    if (o && r) return { owner: o, repo: r };
  }
  return { owner: fallbackOwner, repo: fallbackRepo };
}

function parseDims(src) {
  const get = (k) => {
    if (src == null) return null;
    if (typeof src.get === "function") {
      const v = src.get(k);
      return v == null || v === "" ? null : v;
    }
    const v = src[k];
    return v == null || v === "" ? null : v;
  };

  let owner = get("owner") || DEFAULT_OWNER;
  let repo = get("repo") || DEFAULT_REPO;
  if (typeof repo === "string" && repo.includes("/")) {
    const split = splitOwnerRepo(repo, owner, DEFAULT_REPO);
    owner = split.owner;
    repo = split.repo;
  }

  const branch = get("branch") || DEFAULT_BRANCH;
  const tag = get("tag") || "latest";
  const asset = get("asset") || "";

  const forkRaw = get("fork");
  let fork = "0";
  if (forkRaw === 1 || forkRaw === true || forkRaw === "1" || forkRaw === "true") {
    fork = "1";
  } else if (typeof forkRaw === "string" && forkRaw.includes("/")) {
    const split = splitOwnerRepo(forkRaw, owner, repo);
    owner = split.owner;
    repo = split.repo;
    fork = "1";
  } else if (forkRaw != null && forkRaw !== 0 && forkRaw !== false && forkRaw !== "0" && forkRaw !== "false") {
    fork = "1";
  }

  if (`${owner}/${repo}`.toLowerCase() !== `${DEFAULT_OWNER}/${DEFAULT_REPO}`.toLowerCase()) {
    fork = "1";
  }

  return { project: PROJECT, owner, repo, branch, fork, tag, asset };
}

function kvKey(dims) {
  return `${dims.project}|${dims.owner}|${dims.repo}|${dims.branch}|${dims.fork}`;
}

function totalKey() {
  return PROJECT + "|__total__";
}

function viewsKey() {
  return PROJECT + "|__views__";
}

function githubCacheKey() {
  return PROJECT + "|__github__";
}


async function bump(env, key) {
  const n = parseInt((await env.DOWNLOADS.get(key)) || "0", 10) + 1;
  await env.DOWNLOADS.put(key, String(n));
  return n;
}

async function incrementSplit(env, humanKey, botKey, request) {
  const cls = classifyRequest(request);
  const splitKey = cls.bucket === "human" ? humanKey : botKey;
  await bump(env, splitKey);
  return cls;
}

async function readHumanBotSplit(env, request) {
  const views = parseInt((await env.DOWNLOADS.get(KEYS.views)) || "0", 10) || 0;
  const downloadsRaw = await env.DOWNLOADS.get(KEYS.total);
  let downloads = parseInt(downloadsRaw || "0", 10);
  if (!Number.isFinite(downloads) || downloads < 0) downloads = 0;
  const viewsHuman = parseInt((await env.DOWNLOADS.get(KEYS.views_human)) || "0", 10) || 0;
  const downloadsHuman = parseInt((await env.DOWNLOADS.get(KEYS.downloads_human)) || "0", 10) || 0;
  const botManagementAvailable = readBotManagement(request).available;
  return shapeHumanBotFields({
    views,
    downloads,
    views_human: viewsHuman,
    downloads_human: downloadsHuman,
    botManagementAvailable,
  });
}

function enrichStatsWithHumanBot(stats, split) {
  return {
    ...stats,
    views_human: split.views_human,
    views_bot: split.views_bot,
    downloads_human: split.downloads_human,
    downloads_bot: split.downloads_bot,
    human: split.human,
    bot: split.bot,
    classification: split.classification,
  };
}

async function increment(env, dims, request) {
  const key = kvKey(dims);
  const n = parseInt((await env.DOWNLOADS.get(key)) || "0", 10) + 1;
  await env.DOWNLOADS.put(key, String(n));
  const tot = parseInt((await env.DOWNLOADS.get(totalKey())) || "0", 10) + 1;
  await env.DOWNLOADS.put(totalKey(), String(tot));
  if (request) await incrementSplit(env, KEYS.downloads_human, KEYS.downloads_bot, request);

  return tot;
}

async function incrementViews(env, request) {
  const n = parseInt((await env.DOWNLOADS.get(viewsKey())) || "0", 10) + 1;
  await env.DOWNLOADS.put(viewsKey(), String(n));
  if (request) await incrementSplit(env, KEYS.views_human, KEYS.views_bot, request);

  return n;
}

async function listAllKeys(env) {
  const keys = [];
  let cursor;
  do {
    const page = await env.DOWNLOADS.list(cursor ? { cursor } : {});
    keys.push(...page.keys);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

async function githubStats(env) {
  const cached = await env.DOWNLOADS.get(githubCacheKey());
  if (cached) {
    try {
      const obj = JSON.parse(cached);
      if (obj && obj.fetched_at && Date.now() - obj.fetched_at < 5 * 60 * 1000) {
        return obj;
      }
    } catch {
      /* ignore */
    }
  }
  const headers = { "User-Agent": "Mozilla/5.0 FoldLock-download-tracker", Accept: "application/vnd.github+json" };
  let stars = 0;
  let forks = 0;
  let watchers = 0;
  let release_download_count = 0;
  try {
    const repoRes = await fetch("https://api.github.com/repos/AzielEliab/foldlock", { headers });
    if (repoRes.ok) {
      const repo = await repoRes.json();
      stars = Number(repo.stargazers_count) || 0;
      forks = Number(repo.forks_count) || 0;
      watchers = Number(repo.subscribers_count != null ? repo.subscribers_count : repo.watchers_count) || 0;
    }
    const relRes = await fetch("https://api.github.com/repos/AzielEliab/foldlock/releases/latest", { headers });
    if (relRes.ok) {
      const rel = await relRes.json();
      const assets = Array.isArray(rel.assets) ? rel.assets : [];
      release_download_count = assets.reduce((s, a) => s + (Number(a.download_count) || 0), 0);
    }
  } catch {
    /* public API; empty is fine */
  }
  const out = { stars, forks, watchers, release_download_count, fetched_at: Date.now() };
  try {
    await env.DOWNLOADS.put(githubCacheKey(), JSON.stringify(out));
  } catch {
    /* ignore */
  }
  return out;
}

async function collectStats(env, request) {
  const keys = await listAllKeys(env);
  let summed = 0;
  const by_repo = {};
  const by_branch = {};
  const by_fork = { "0": 0, "1": 0 };
  const breakdown = [];

  for (const k of keys) {
    const name = k.name;
    if (isReservedCounterKey(name, PROJECT)) continue;
    const n = parseInt((await env.DOWNLOADS.get(name)) || "0", 10);
    if (!Number.isFinite(n) || n <= 0) continue;
    const parts = name.split("|");
    if (parts.length < 5) continue;
    const [project, owner, repo, branch, fork] = parts;
    summed += n;
    const repoId = `${owner}/${repo}`;
    by_repo[repoId] = (by_repo[repoId] || 0) + n;
    by_branch[branch] = (by_branch[branch] || 0) + n;
    const forkFlag = fork === "1" ? "1" : "0";
    by_fork[forkFlag] = (by_fork[forkFlag] || 0) + n;
    breakdown.push({ project, owner, repo, branch, fork: forkFlag, count: n });
  }

  const downloadsDirect = parseInt((await env.DOWNLOADS.get(totalKey())) || "0", 10);
  const downloads = Number.isFinite(downloadsDirect) && downloadsDirect > 0 ? downloadsDirect : summed;
  const views = parseInt((await env.DOWNLOADS.get(viewsKey())) || "0", 10) || 0;
  const github = await githubStats(env);
  const __hbViews = parseInt((await env.DOWNLOADS.get(KEYS.views)) || "0", 10) || 0;
  const __hbViewsHuman = parseInt((await env.DOWNLOADS.get(KEYS.views_human)) || "0", 10) || 0;
  const __hbDownloadsHuman = parseInt((await env.DOWNLOADS.get(KEYS.downloads_human)) || "0", 10) || 0;
  const __hbBotMgmt = request ? readBotManagement(request).available : false;

  return {
    ...shapeHumanBotFields({
      views: (typeof views !== 'undefined' ? views : __hbViews),
      downloads: (typeof downloads !== 'undefined' ? downloads : (typeof shown !== 'undefined' ? shown : (typeof total !== 'undefined' ? total : 0))),
      views_human: __hbViewsHuman,
      downloads_human: __hbDownloadsHuman,
      botManagementAvailable: __hbBotMgmt,
    }),

    project: PROJECT,
    views,
    downloads,
    total: downloads,
    by_repo,
    by_branch,
    by_fork,
    breakdown,
    github: {
      stars: github.stars || 0,
      forks: github.forks || 0,
      watchers: github.watchers || 0,
      release_download_count: github.release_download_count || 0,
    },
    note: "Forks identified by GitHub owner/repo. Key layout: project|owner|repo|branch|fork. Views are separate from downloads. /v1 does not increment.",
  };
}

function installScript() {
  return `#!/usr/bin/env bash
# FoldLock one-click install. Counted download via this Worker.
set -euo pipefail
HOST="${HOST}"
ASSET="${DEFAULT_ASSET}"
WORKDIR="\${FOLDLOCK_HOME:-\$HOME/foldlock}"
mkdir -p "\$WORKDIR"
cd "\$WORKDIR"
echo "Downloading counted tarball from \${HOST}/download (User-Agent Mozilla/5.0)…"
curl -fsSL -A 'Mozilla/5.0' "\${HOST}/download?asset=\${ASSET}" -o "\${ASSET}"
tar -xzf "\${ASSET}"
DIR="\$(find . -maxdepth 1 -type d -name 'foldlock-*' | head -n 1)"
if [ -n "\${DIR}" ]; then
  cd "\${DIR}"
fi
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -U pip
python -m pip install -e .
echo
echo "Installed FoldLock 0.8.0-UNI1 — zip-class SOTA compression engine."
echo "Run:  foldlock ui"
echo "Then open http://127.0.0.1:8872  (loopback only)"
echo "Author: Aziel Eliab."
`;
}

async function serveAsset(request, env, asset, { head = false } = {}) {
  if (!env.ASSETS) {
    return json({ error: "assets binding missing" }, 500);
  }
  const assetUrl = new URL("/" + asset, request.url);
  const assetRes = await env.ASSETS.fetch(new Request(assetUrl, { method: "GET" }));
  if (!assetRes.ok) {
    return json({ error: "asset not hosted", asset, status: assetRes.status }, 404);
  }
  const headers = new Headers();
  headers.set("Content-Type", "application/gzip");
  headers.set("Content-Disposition", 'attachment; filename="' + asset.replaceAll('"', "") + '"');
  headers.set("Cache-Control", "private, no-store");
  const len = assetRes.headers.get("Content-Length");
  if (len) headers.set("Content-Length", len);
  for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);
  if (head) {
    return new Response(null, { status: 200, headers });
  }
  return new Response(assetRes.body, { status: 200, headers });
}

async function indexHtml(env) {
  const stats = await collectStats(env);
  const views = Number(stats.views) || 0;
  const downloads = Number(stats.downloads) || 0;
  const v = views.toLocaleString("en-US");
  const n = downloads.toLocaleString("en-US");
  const gh = stats.github || {};
  const breakdown = (stats.breakdown || [])
    .map(
      (b) =>
        `<li><code>${b.owner}/${b.repo}</code> branch <code>${b.branch}</code> fork=${b.fork} → ${b.count}</li>`,
    )
    .join("") || "<li>none yet</li>";
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FoldLock — Aziel Eliab</title>
<meta name="description" content="FoldLock is compression software and a compression engine by Aziel Eliab — zip-class SOTA adaptive UNI1 fold on UTF-8 text.">
<meta name="author" content="Aziel Eliab">
<link rel="canonical" href="https://foldlock-download-tracker.vibelock.workers.dev/">
<meta property="og:title" content="FoldLock — Aziel Eliab">
<meta property="og:description" content="FoldLock is compression software and a compression engine by Aziel Eliab — zip-class SOTA adaptive UNI1 fold on UTF-8 text.">
<meta property="og:url" content="https://foldlock-download-tracker.vibelock.workers.dev/">
<meta property="og:type" content="website">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "FoldLock",
  "author": {
    "@type": "Person",
    "name": "Aziel Eliab"
  },
  "codeRepository": "https://github.com/AzielEliab/foldlock",
  "downloadUrl": "https://foldlock-download-tracker.vibelock.workers.dev/download",
  "license": "https://www.apache.org/licenses/LICENSE-2.0",
  "url": "https://foldlock-download-tracker.vibelock.workers.dev/",
  "description": "FoldLock is compression software and a compression engine by Aziel Eliab — zip-class SOTA adaptive UNI1 fold on UTF-8 text.",
  "identifier": "https://doi.org/10.5281/zenodo.22257762"
}
</script>
<!-- gitbaby-seo -->
<style>
  :root {
    color-scheme: dark;
    --bg: #0e1014;
    --ink: #f3efe4;
    --muted: #c8c2b4;
    --panel: #151922;
    --panel-2: #10141b;
    --line: #3a4152;
    --gold: #e0c36a;
    --btn: #f4f1ea;
    --btn-ink: #14120e;
    --link: #d6e0ff;
    --focus: #ffffff;
    --ok: #8ee0b0;
    --mesh-bg: #12160e;
    --mesh-line: #c9a227;
    --code-bg: #0c0e12;
  }
  @media (prefers-color-scheme: light) {
    :root {
      color-scheme: light;
      --bg: #f7f4ee;
      --ink: #1c1914;
      --muted: #3f3a32;
      --panel: #ffffff;
      --panel-2: #f3efe6;
      --line: #d5cbb8;
      --gold: #6d5410;
      --btn: #1c1914;
      --btn-ink: #f7f4ee;
      --link: #1d3f86;
      --focus: #1c1914;
      --ok: #0f6b3c;
      --mesh-bg: #fffdf8;
      --mesh-line: #8a6a12;
      --code-bg: #f3efe6;
    }
  }
  * { box-sizing: border-box; }
  html { overflow-x: clip; }
  html, body { margin: 0; background: var(--bg); color: var(--ink); }
  body {
    font: 16px/1.5 system-ui, "Segoe UI", sans-serif;
    max-width: 40rem;
    margin: 0 auto;
    padding: 1.15rem 1rem 2.75rem;
    overflow-wrap: anywhere;
  }
  a { color: var(--link); }
  :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  a.skip { position: absolute; left: -999px; top: 0; }
  a.skip:focus {
    left: 1rem; top: 1rem; z-index: 5;
    background: var(--btn); color: var(--btn-ink);
    padding: .4rem .7rem; text-decoration: none;
  }
  .brandrow { display: flex; align-items: center; justify-content: flex-start; gap: 12px; margin: 0 0 .75rem; }
  .brandmark { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; flex: 0 0 auto; box-shadow: 0 0 0 1px #d4af3733; }
  h1 { font-size: 2rem; font-weight: 650; letter-spacing: .02em; line-height: 1.15; margin: 0 0 .2rem; }
  h2 { font-size: 1.05rem; font-weight: 650; letter-spacing: .02em; margin: 1.15rem 0 .4rem; }
  .motto { color: var(--gold); font-style: italic; margin: 0 0 .45rem; font-size: 1.08rem; }
  .lede { color: var(--muted); margin: 0 0 1rem; max-width: 40rem; }
  a.btn.block.primary {
    display: block; width: 100%; max-width: 40rem;
    margin: 0 0 .7rem; padding: 1.05rem 1.2rem;
    border: 1px solid transparent; border-radius: 10px;
    background: var(--btn); color: var(--btn-ink);
    text-align: center; text-decoration: none;
    font: 700 1.25rem/1.15 ui-monospace, Menlo, Consolas, monospace;
    letter-spacing: .03em; cursor: pointer;
  }
  a.btn.block.primary:hover { filter: brightness(1.06); }
  a.btn.block.primary:focus-visible { outline-offset: 3px; }
  .asset-note { color: var(--muted); font-size: .92rem; margin: 0 0 .2rem; }
  .features { display: grid; grid-template-columns: 1fr; gap: .55rem; margin: 1rem 0 0; padding: 0; list-style: none; }
  .features li { margin: 0; padding-left: 1rem; position: relative; }
  .features li::before {
    content: ""; position: absolute; left: 0; top: .55em;
    width: .4rem; height: .4rem; border-radius: 50%; background: var(--gold);
  }
  .card {
    border: 1px solid var(--line); border-radius: 14px;
    padding: 1.05rem 1rem 1.15rem; background: var(--panel); margin: 1.15rem 0;
  }
  .nums { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; margin: 0; }
  .count { font-size: 2rem; font-variant-numeric: tabular-nums; font-weight: 700; margin: 0; }
  .count span { display: block; font-size: .92rem; font-weight: 500; color: var(--muted); }
  button.secondary {
    background: transparent; color: var(--ink);
    border: 1px solid var(--line); border-radius: 9px;
    padding: .72rem .95rem; margin-top: .35rem;
    font: 700 .95rem/1.2 ui-monospace, Menlo, Consolas, monospace;
    cursor: pointer;
  }
  button.secondary:hover { background: var(--panel-2); }
  .meta, .iso { color: var(--muted); font-size: .92rem; }
  .iso { margin: .75rem 0 0; font-size: .85rem; }
  .toast { margin: .45rem 0 0; min-height: 1.3rem; color: var(--ok); font-weight: 650; overflow-wrap: anywhere; }
  pre, code { font-family: ui-monospace, Menlo, Consolas, monospace; }
  pre {
    background: var(--code-bg); color: var(--ink);
    padding: .75rem .9rem; border-radius: 8px; font-size: .82rem;
    max-width: 100%; margin: .75rem 0;
    white-space: pre-wrap; overflow-wrap: anywhere;
  }
  code { font-size: .88em; }
  .breakdown { margin: .3rem 0 0; padding-left: 1.1rem; }
  .breakdown li { margin: .2rem 0; }
  #meshStrip {
    border: 1px solid var(--mesh-line); border-radius: 14px;
    padding: .85rem 1rem; background: var(--mesh-bg);
    margin: 0 0 1.15rem;
    display: flex; flex-wrap: wrap; align-items: center; gap: .7rem 1rem;
    font-size: .88rem; color: var(--muted);
  }
  #meshStrip > * { min-width: 0; max-width: 100%; }
  #meshLine, #meshProducts, .mesh-note { flex: 1 1 100%; margin: 0; overflow-wrap: anywhere; }
  #meshStrip .live { color: var(--ink); }
  #meshStrip .live b { color: var(--gold); font-size: 1.35rem; margin-right: .35rem; }
  #meshStrip .rollup b { color: var(--gold); }
  .mesh-controls { flex: 1 1 100%; display: flex; flex-wrap: wrap; gap: .45rem; }
  #meshStrip button {
    font: 700 .78rem/1 ui-monospace, Menlo, Consolas, monospace;
    min-height: 2rem; padding: 0 .75rem; border-radius: 8px;
    background: transparent; color: var(--ink);
    border: 1px solid var(--mesh-line); cursor: pointer;
  }
  #meshStrip button:hover { background: var(--panel-2); }
  #meshStrip input {
    flex: 1 1 12rem; width: auto; min-width: 0; max-width: 100%;
    padding: .4rem .55rem; border: 1px solid var(--mesh-line); border-radius: 8px;
    background: var(--code-bg); color: var(--ink); font: inherit;
  }
  footer.quiet { color: var(--muted); font-size: .9rem; margin-top: .4rem; }
  footer.quiet p { margin: .35rem 0; }
  footer.quiet a { color: var(--link); }
  .cite { margin-top: .8rem; padding-top: .8rem; border-top: 1px solid var(--line); }
  .cite h2 { font-size: 1rem; margin: 0 0 .35rem; color: var(--ink); }
  .cite p { color: var(--muted); font-size: .92rem; }
  @media (min-width: 800px) {
    body { padding: 2.25rem 1.5rem 3.5rem; }
    .features { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem 1.1rem; }
  }
  @media (max-width: 420px) {
    h1 { font-size: 1.85rem; }
    .count { font-size: 1.75rem; }
    .mesh-controls { flex-direction: column; align-items: stretch; }
    .mesh-controls button, .mesh-controls input { width: 100%; }
  }
</style>
<body>
  <a class="skip" href="#downloadBtn">Skip to download</a>
  <header class="hero">
    <div class="brandrow"><img class="brandmark" src="/sigil.png" width="40" height="40" alt="" decoding="async"></div>
    <h1>FoldLock</h1>
    <p class="motto">Compression software. Compression engine.</p>
    <p class="lede">Zip-class adaptive UNI1 on UTF-8 text: classify, bake off, and pass through. Author Aziel Eliab.</p>
    <a class="btn block primary" id="downloadBtn" href="/download?asset=${DEFAULT_ASSET}" aria-describedby="downloadNote">Download</a>
    <p class="asset-note" id="downloadNote">${DEFAULT_ASSET} · counted on this Worker for every branch and fork</p>
    <ul class="features">
      <li>Common words fold out of a story so the file can get smaller.</li>
      <li>Unfold puts those words back and checks the size and the hash.</li>
      <li>Short notes stay the same size. Already-compressed files are refused.</li>
    </ul>
  </header>
  <section class="card" id="tracker" aria-labelledby="tracker-heading">
    <h2 id="tracker-heading">Counted downloads</h2>
    <div class="nums">
      <p class="count">${v}<span>Views</span></p>
      <p class="count">${n}<span>Downloads</span></p>
    </div>
    <h2>Install on this computer</h2>
    <p class="meta">One-click install copies a Terminal command. It downloads this same file. Then run <code>foldlock ui</code> and open http://127.0.0.1:8872 on this computer.</p>
    <button type="button" class="secondary" id="btn-install">One-click install</button>
    <p class="toast" id="install-toast" role="status"></p>
    <pre id="install-line">${INSTALL_LINE}</pre>
    <p class="iso">Isolated counter: Worker <code>foldlock-download-tracker</code>, project <code>foldlock</code>, KV <code>FOLDLOCK_DOWNLOADS</code>. Page views and downloads stay on their own keys. /v1 does not increment downloads.</p>
    <h2>Per repo / branch / fork</h2>
    <ul class="breakdown">${breakdown}</ul>
  </section>
  <div id="meshStrip" aria-label="Suite Live Nodes">
    <div class="live"><b id="meshLiveCount">0</b> Live Nodes</div>
    <div id="meshLine">Suite mesh: off (default). QNM-BUILD-1.0. QNS-CD-1.0. Not an anonymity network.</div>
    <div class="rollup">live <b id="qnmLive">0</b> · locked <b id="qnmLocked">0</b> · isolated <b id="qnmIsolated">0</b></div>
    <div class="mesh-note">No Node Gate · No auto-heal · Aziel Eliab only</div>
    <div class="mesh-controls">
      <input id="meshBearer" type="text" maxlength="80" placeholder="bearer (required to enable)" aria-label="mesh bearer">
      <button id="meshEnable" type="button" title="Enable suite mesh. Declared bearer required. Default off.">Enable</button>
      <button id="meshDisable" type="button" title="Disable suite mesh (always allowed)">Disable</button>
      <button id="meshJoin" type="button" title="Join as foldlock. Refused while mesh is OFF. No auto-join.">Join</button>
      <button id="meshLeave" type="button" title="Leave this node. No auto-heal.">Leave</button>
    </div>
    <p id="meshProducts">Catalog MCP mesh_* · FragGate slug=mesh · QNS-CD-1.0 cross-map · /v1/mesh/* PROXY · not AnonBroadcast · not AZMail ring · not a Node Gate · no public qnsd proxy</p>
  </div>
  <script>
    (function () {
      var line = ${JSON.stringify(INSTALL_LINE)};
      var btn = document.getElementById("btn-install");
      var toast = document.getElementById("install-toast");
      btn.addEventListener("click", function () {
        function ok() {
          toast.textContent = "Copied. Open Terminal, paste, press Enter. Then run: foldlock ui";
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(line).then(ok).catch(function () {
            toast.textContent = "Copy this: " + line;
          });
        } else {
          toast.textContent = "Copy this: " + line;
        }
      });
    })();
    (function () {
      function $(id) { return document.getElementById(id); }
      function meshNum() {
        for (var i = 0; i < arguments.length; i++) {
          var raw = arguments[i];
          if (raw == null || raw === "") continue;
          var n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
          if (Number.isFinite(n) && n >= 0) return Math.floor(n);
        }
        return 0;
      }
      function unwrapMesh(j) {
        if (!j || typeof j !== "object") return {};
        if (j.result && typeof j.result === "object") return Object.assign({}, j, j.result);
        if (j.mesh && typeof j.mesh === "object") return Object.assign({}, j, j.mesh);
        return j;
      }
      function paintMesh(raw) {
        var j = unwrapMesh(raw);
        var on = j.enabled === true || j.enabled === 1 || String(j.status || "").toLowerCase() === "on";
        var r = (j.rollup && typeof j.rollup === "object") ? j.rollup : {};
        var live = on ? meshNum(r.live, j.live_nodes, j.live) : 0;
        var locked = on ? meshNum(r.locked, j.locked_nodes, j.locked) : 0;
        var isolated = on ? meshNum(r.isolated, j.isolated_nodes, j.isolated) : 0;
        $("meshLiveCount").textContent = String(live);
        $("qnmLive").textContent = String(live);
        $("qnmLocked").textContent = String(locked);
        $("qnmIsolated").textContent = String(isolated);
        var line = $("meshLine");
        if (on) line.textContent = "Suite mesh: on · live " + live + " · locked " + locked + " · isolated " + isolated + ". QNS-CD-1.0. Not an anonymity network.";
        else if (j.status === "unavailable" || (j.ok === false && j.error)) line.textContent = "Suite mesh: off (unavailable). QNM-BUILD-1.0. QNS-CD-1.0. Not an anonymity network.";
        else line.textContent = "Suite mesh: off (default). QNM-BUILD-1.0. QNS-CD-1.0. Not an anonymity network.";
        var products = j.products_present || j.products || [];
        var names = Array.isArray(products) ? products.map(function (p) { return typeof p === "string" ? p : (p && (p.product || p.slug)) || ""; }).filter(Boolean) : [];
        var nodes = Array.isArray(j.nodes) ? j.nodes : [];
        var extra = names.length ? " · products " + names.join(", ") : (nodes.length ? " · " + nodes.length + " node labels" : "");
        $("meshProducts").textContent = "Catalog MCP mesh_* · FragGate slug=mesh · QNS-CD-1.0 cross-map · /v1/mesh/* PROXY · not AnonBroadcast · not AZMail ring · not a Node Gate · no public qnsd proxy" + extra;
      }
      async function meshGet(path) {
        var r = await fetch(path, { headers: { "user-agent": "Mozilla/5.0", accept: "application/json" } });
        return r.json();
      }
      async function meshPost(path, payload) {
        var r = await fetch(path, { method: "POST", headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0" }, body: JSON.stringify(payload || {}) });
        return r.json();
      }
      async function refreshMesh() {
        try {
          var status = await meshGet("/v1/mesh");
          var merged = status;
          var inner = unwrapMesh(status);
          var on = inner.enabled === true;
          if (on) {
            try {
              var nodes = await meshGet("/v1/mesh/nodes");
              merged = Object.assign({}, inner, unwrapMesh(nodes));
            } catch (e) { /* status is enough */ }
          }
          paintMesh(merged);
          var nodeId = sessionStorage.getItem("foldlock_mesh_node");
          if (on && nodeId) {
            try { await meshPost("/v1/mesh/heartbeat", { node_id: nodeId }); } catch (e) { /* no auto-heal */ }
          }
        } catch (e) {
          paintMesh({ ok: false, enabled: false, status: "unavailable", error: "mesh_unavailable" });
        }
      }
      $("meshEnable").onclick = async function () {
        var bearer = ($("meshBearer").value || "").trim();
        paintMesh(await meshPost("/v1/mesh/enable", bearer ? { bearer: bearer } : {}));
        refreshMesh();
      };
      $("meshDisable").onclick = async function () {
        sessionStorage.removeItem("foldlock_mesh_node");
        paintMesh(await meshPost("/v1/mesh/disable", {}));
        refreshMesh();
      };
      $("meshJoin").onclick = async function () {
        var j = await meshPost("/v1/mesh/join", { product: "foldlock", label: "FoldLock Worker" });
        var inner = unwrapMesh(j);
        var id = inner.node_id || inner.id || (inner.session && inner.session.node_id);
        if (id) sessionStorage.setItem("foldlock_mesh_node", String(id));
        paintMesh(j);
        refreshMesh();
      };
      $("meshLeave").onclick = async function () {
        var id = sessionStorage.getItem("foldlock_mesh_node");
        if (id) await meshPost("/v1/mesh/leave", { node_id: id });
        sessionStorage.removeItem("foldlock_mesh_node");
        refreshMesh();
      };
      window.addEventListener("pagehide", function () {
        var id = sessionStorage.getItem("foldlock_mesh_node");
        if (!id || typeof navigator.sendBeacon !== "function") return;
        try { navigator.sendBeacon("/v1/mesh/leave", new Blob([JSON.stringify({ node_id: id })], { type: "application/json" })); } catch (e) { /* leave expires in 5 minutes */ }
      });
      refreshMesh();
      setInterval(refreshMesh, 30000);
      document.addEventListener("visibilitychange", function () { if (!document.hidden) refreshMesh(); });
    })();
  </script>

<footer class="quiet">
  <p>Apache-2.0 · Aziel Eliab · FoldLock 0.8.0</p>
  <p>GitHub: stars ${gh.stars || 0} · forks ${gh.forks || 0} · watchers ${gh.watchers || 0} · release assets ${gh.release_download_count || 0}</p>
  <p><a href="/stats">JSON stats</a> · <a href="/openapi.json">OpenAPI</a> · <a href="/v1/mesh">/v1/mesh</a> · <a href="/v1/skill">Skill</a> · <a href="/ai">AI runtime</a> · <a href="${GITHUB_REPO}">GitHub</a> · <a href="${GITHUB_LATEST}">releases</a> · <a href="${DOI}">Paper</a> · <a href="${ZENODO}">Zenodo</a></p>
  <section class="cite" id="cite">
    <h2>How to cite</h2>
    <p>Aziel Eliab. FoldLock. https://github.com/AzielEliab/foldlock. https://foldlock-download-tracker.vibelock.workers.dev. https://doi.org/10.5281/zenodo.22257762.</p>
    <p><a href="https://aziel-runtime.vibelock.workers.dev/">Catalog</a> · <a href="https://github.com/AzielEliab/foldlock">GitHub</a> · <a href="https://foldlock-download-tracker.vibelock.workers.dev/download">Download</a> · <a href="https://foldlock-download-tracker.vibelock.workers.dev/cite.json">cite.json</a></p>
  </section>
</footer>
<!-- /gitbaby-seo -->
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const mesh = await handleMeshApi(request, url, env);
    if (mesh) return mesh;

    const runtime = await handleRuntimeApi(request, url);
    if (runtime) return runtime;

    if ((url.pathname === "/install.sh" || url.pathname === "/install.sh/") && request.method === "GET") {
      return new Response(installScript(), {
        status: 200,
        headers: {
          "Content-Type": "text/x-shellscript; charset=utf-8",
          "Cache-Control": "private, no-store",
          ...corsHeaders(),
        },
      });
    }

    if (url.pathname === "/" && request.method === "GET") {
      await incrementViews(env, request);
      return new Response(await indexHtml(env), {
        headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders() },
      });
    }

    if (url.pathname === "/count" && request.method === "GET") {
      const stats = await collectStats(env, request);
      return json(shapeCountBody({
        project: PROJECT,
        views: stats.views || 0,
        downloads: stats.downloads || 0,
        total: stats.total || 0,
        views_human: stats.views_human,
        downloads_human: stats.downloads_human,
        botManagementAvailable: readBotManagement(request).available,
      }));
    }

    if (url.pathname === "/stats" && request.method === "GET") {
      return json(await collectStats(env, request));
    }

    if (url.pathname === "/event" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "JSON body required" }, 400);
      }
      const dims = parseDims(body || {});
      const count = await increment(env, dims, request);
      return json({
        ok: true,
        key: kvKey(dims),
        count,
        owner: dims.owner,
        repo: dims.repo,
        branch: dims.branch,
        fork: dims.fork,
        asset: dims.asset || null,
      });
    }

    if (url.pathname === "/go" && (request.method === "GET" || request.method === "HEAD")) {
      const dims = parseDims(url.searchParams);
      const asset = dims.asset || DEFAULT_ASSET;
      dims.asset = asset;
      if (request.method === "GET") await increment(env, dims, request);
      return serveAsset(request, env, asset, { head: request.method === "HEAD" });
    }

    if ((url.pathname === "/download" || url.pathname.startsWith("/download/")) && (request.method === "GET" || request.method === "HEAD")) {
      const dims = parseDims(url.searchParams);
      if (!dims.asset && url.pathname.startsWith("/download/")) {
        dims.asset = decodeURIComponent(url.pathname.slice("/download/".length));
      }
      const asset = dims.asset || DEFAULT_ASSET;
      dims.asset = asset;
      if (request.method === "GET") await increment(env, dims, request);
      return serveAsset(request, env, asset, { head: request.method === "HEAD" });
    }


    // gitbaby-seo-routes
    if ((url.pathname === "/robots.txt" || url.pathname === "/robots.txt/") && request.method === "GET") {
      const body = "User-agent: *\nAllow: /\nSitemap: " + HOST + "/sitemap.xml\n";
      return new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders() },
      });
    }
    if ((url.pathname === "/sitemap.xml" || url.pathname === "/sitemap.xml/") && request.method === "GET") {
      const locs = [HOST + "/", HOST + "/download", HOST + "/install.sh", HOST + "/v1/skill", HOST + "/v1/mesh", HOST + "/openapi.json", GITHUB_REPO];
      const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + locs.map((u) => "  <url><loc>" + u + "</loc></url>").join("\n")
        + "\n</urlset>\n";
      return new Response(xml, {
        status: 200,
        headers: { "Content-Type": "application/xml; charset=utf-8", ...corsHeaders() },
      });
    }
    if ((url.pathname === "/cite.json" || url.pathname === "/cite.json/") && request.method === "GET") {
      return json({"author": "Aziel Eliab", "title": "FoldLock", "one_line": "Zip-class SOTA adaptive UNI1 compression engine on UTF-8 text.", "github": "https://github.com/AzielEliab/foldlock", "download": "https://foldlock-download-tracker.vibelock.workers.dev/download", "doi": "10.5281/zenodo.22257762", "license": "Apache-2.0", "catalog": "https://aziel-runtime.vibelock.workers.dev/"});
    }
    // /gitbaby-seo-routes
    return json({ error: "not found" }, 404);
  },
};
