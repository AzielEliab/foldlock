import {
  LIMITATION,
  PAPER,
  PREVIEW_CAP,
  SPEC,
  TETHERS,
  VERSION,
  b64decode,
  b64encode,
  foldBytes,
  unfoldBytes,
} from "./codec.js";

const PRODUCT = "foldlock";
const EXAMPLE_PAYLOAD = {
  "text": "the cat and the dog"
};

const HOST = "https://foldlock-download-tracker.vibelock.workers.dev";
const CATALOG = "https://aziel-runtime.vibelock.workers.dev";
const PROTOCOL = "2025-03-26";
const DOI = "https://doi.org/10.5281/zenodo.22257762";
const ZENODO = "https://zenodo.org/records/22257762";

export const SKILL = `---
name: FoldLock
description: Use this when compressing or restoring UTF-8 text with FoldLock, a zip-class compression engine (SOTA adaptive UNI1). Hosted preview via /v1. Author Aziel Eliab.
---

# FoldLock

FoldLock is **compression software** and a **compression engine** — zip-class for UTF-8 text, not the ZIP container format. It ships a **SOTA** adaptive UNI1 fold: classify → bakeoff → passthrough (TETH tether-word suppression and SIR densification with peer / abbreviation / number packs). Magics: FLD3 (TETH) and UNI1 (adaptive). Lexicon: TETH-1. Author: **Aziel Eliab**.

Use FoldLock when someone asks to **compress** / **fold** English-like UTF-8 text, **unfold** a \`.fld\` / FLD3 / UNI1 blob, or check a fold receipt (strategy, hits, ratio, \`beats_zstd\`). Do **not** use it for ZIP archives, gzip, photos, or "make every file smaller."

Always send a normal \`User-Agent\` (for example \`Mozilla/5.0\`). Cloudflare Workers may 403 empty agents.

## When to call it

- Fold a UTF-8 string and show a receipt (\`zip: false\`, winning \`strategy\`, hits, ratio). Short strings stay the same size.
- Unfold an FLD3 / UNI1 / passthrough blob (base64) and confirm \`verified: true\`.
- Health / skill / OpenAPI. Never invent a restore. Never claim the ZIP container format. Never claim every file beats zstd.

Hosted preview caps input around 8 KB. Bigger files use the local package: \`foldlock fold\` / \`foldlock unfold\`.

## Endpoints (this Worker)

Host: \`https://foldlock-download-tracker.vibelock.workers.dev\`

| Method | Path | What |
|--------|------|------|
| GET | \`/v1/health\` | Liveness. Does not increment downloads. |
| GET | \`/v1/skill\` | This markdown. Does not increment downloads. |
| POST | \`/v1/fold-preview\` | Small UTF-8 text in → receipt + FLD3/UNI1/passthrough base64. Compression engine. |
| POST | \`/v1/unfold-preview\` | FLD3/UNI1/passthrough base64 in → verified restore or error. |

OpenAPI: \`https://foldlock-download-tracker.vibelock.workers.dev/openapi.json\`

Catalog OpenAPI: \`https://aziel-runtime.vibelock.workers.dev/openapi.json\`

MCP: \`POST https://foldlock-download-tracker.vibelock.workers.dev/mcp\`  
also \`POST https://aziel-runtime.vibelock.workers.dev/mcp\`

## How to call (Mozilla/5.0)

\`\`\`bash
curl -s -A 'Mozilla/5.0' https://foldlock-download-tracker.vibelock.workers.dev/v1/health

curl -s -A 'Mozilla/5.0' -X POST https://foldlock-download-tracker.vibelock.workers.dev/v1/fold-preview \\
  -H 'content-type: application/json' \\
  -d '{"text":"the cat and the dog"}'

curl -s -A 'Mozilla/5.0' -X POST https://foldlock-download-tracker.vibelock.workers.dev/v1/unfold-preview \\
  -H 'content-type: application/json' \\
  -d '{"b64":"<FLD3-or-UNI1-or-passthrough-base64>"}'
\`\`\`

Catalog aliases:

\`\`\`bash
curl -s -A 'Mozilla/5.0' -X POST https://aziel-runtime.vibelock.workers.dev/p/foldlock/fold-preview \\
  -H 'content-type: application/json' \\
  -d '{"text":"the cat and the dog"}'
\`\`\`

MCP tools: \`foldlock_health\`, \`foldlock_fold-preview\`, \`foldlock_unfold-preview\`, \`foldlock_skill\`.

Grok: import the catalog OpenAPI as a custom tool. ChatGPT: GPT Actions. Venice: HTTP tools.

## Honest banner

THIS IS: SOTA compression software and a compression engine — zip-class for UTF-8 text; adaptive UNI1 fold (classify → bakeoff → passthrough); tether-word suppression and SIR with optional packs; exact restore; short strings left alone; already-compressed input refused.

THIS IS NOT: the ZIP container format (PKZIP/.zip); a zlib/gzip/DEFLATE/zstd/lzma wrapper; a claim every file shrinks or that FoldLock beats zstd on all files; a universal compressor; translation of all inputs to Latin; encryption; UL; EmployeeLock; TemporalLock; GodLock.

Prose/text is the win lane. Code and markup often passthrough. \`beats_zstd\` is per-file when zstd is available.

Method paper: FL-WP-0.3. UNI1 shell: FL-WP-0.8 (no new DOI). The same preprint also describes WhistleLock; this product is FoldLock only.

DOI: https://doi.org/10.5281/zenodo.22257762  
Record: https://zenodo.org/records/22257762  
File: FoldLock_WhistleLock_FL-WP-0.3_WL-WP-0.1.pdf · Apache-2.0 · Eliab, Aziel

Forks are welcome and always allowed.

Local UI: Import JSON file and Export JSON. Run foldlock doctor.

## Catalog + local UI

Author: **Aziel Eliab**. Honest scope: SOTA compression engine — zip-class adaptive UNI1 for UTF-8 text. Not the ZIP container format.

- Catalog product: https://aziel-runtime.vibelock.workers.dev/p/foldlock/
- Catalog OpenAPI: https://aziel-runtime.vibelock.workers.dev/openapi.json
- Catalog MCP: POST https://aziel-runtime.vibelock.workers.dev/mcp
- This Worker skill: GET https://foldlock-download-tracker.vibelock.workers.dev/v1/skill
- This Worker OpenAPI: https://foldlock-download-tracker.vibelock.workers.dev/openapi.json
- Sample payload: GET https://foldlock-download-tracker.vibelock.workers.dev/v1/example

Local UI: Import JSON file (type=file) and Export JSON. Then foldlock doctor.

Grok: import catalog or Worker OpenAPI as a custom tool. ChatGPT: GPT Actions. Venice: HTTP tools.
`;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, MCP-Protocol-Version, mcp-session-id",
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders() },
  });
}

function html(body) {
  return new Response(body, {
    headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders() },
  });
}

function originOf(request) {
  try {
    return new URL(request.url).origin;
  } catch {
    return HOST;
  }
}

function openapiSpec(origin) {
  return {
    openapi: "3.1.0",
    info: {
      title: "FoldLock runtime",
      version: VERSION,
      summary: "SOTA zip-class compression engine for UTF-8 text (adaptive UNI1).",
      description: LIMITATION,
      license: { name: "Apache-2.0", identifier: "Apache-2.0" },
      contact: { name: "Aziel Eliab", url: "https://github.com/AzielEliab/foldlock" },
    },
    servers: [{ url: origin }],
    paths: {
            "/v1/example": { get: { operationId: "foldlockExample", summary: "Sample JSON payload. Does not increment downloads.", responses: { "200": { description: "OK" } } } },
      "/v1/health": {
        get: {
          operationId: "foldlock_health",
          summary: "Liveness for FoldLock compression engine. Does not increment download KV.",
          responses: { "200": { description: "ok" } },
        },
      },
      "/v1/skill": {
        get: {
          operationId: "foldlock_skill",
          summary: "Return FoldLock skill markdown. Does not increment download KV.",
          responses: { "200": { description: "text/markdown" } },
        },
      },
      "/v1/fold-preview": {
        post: {
          operationId: "foldlock_fold-preview",
          summary: "Compress small UTF-8 text → receipt + FLD3/UNI1/passthrough base64. Cap ~8KB. SOTA adaptive UNI1 engine.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object" },
                example: { text: "the cat and the dog" },
              },
            },
          },
          responses: { "200": { description: "receipt + b64" } },
        },
      },
      "/v1/unfold-preview": {
        post: {
          operationId: "foldlock_unfold-preview",
          summary: "Decompress FLD3/UNI1/passthrough base64 → verified restore or error.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: { "200": { description: "verified restore" } },
        },
      },
    },
  };
}

function aiHtml(origin) {
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>FoldLock — AI runtime</title>
<style>
  :root { color-scheme: dark; }
  body { font: 16px/1.45 system-ui, sans-serif; max-width: 44rem; margin: 3rem auto; padding: 0 1.25rem; background: #0e1014; color: #e8eaef; }
  a { color: #c9d4ff; }
  .banner { border: 1px solid #5c4a1a; background: #241c0d; color: #f0d78c; padding: .85rem 1rem; border-radius: 8px; }
  pre { background: #151922; padding: .85rem 1rem; overflow: auto; border-radius: 8px; }
</style>
<body>
<h1>FoldLock runtime</h1>
<p class="banner">${LIMITATION}</p>
<p>zip: False. Method: adaptive UNI1. Author Aziel Eliab.</p>
<p>OpenAPI: <a href="${origin}/openapi.json">${origin}/openapi.json</a></p>
<p>MCP: POST <code>${origin}/mcp</code> · Catalog: <a href="${CATALOG}/">${CATALOG}</a></p>
<p>Paper: <a href="${DOI}">${DOI}</a> · <a href="${ZENODO}">Zenodo 22257762</a></p>
<pre>curl -A Mozilla/5.0 ${origin}/v1/health
curl -A Mozilla/5.0 ${origin}/v1/skill
curl -A Mozilla/5.0 -X POST ${origin}/v1/fold-preview -H 'content-type: application/json' \\
  -d '{"text":"the cat and the dog"}'</pre>
<p>GET/POST under <code>/v1</code> never increment the download counter. Hosted preview is a compression engine, not the ZIP container format.</p>
<p><a href="/">Downloads</a></p>
</body></html>`;
}

function mcpTools() {
  return [
    { name: "foldlock_health", description: "Liveness for FoldLock compression engine. Does not increment download KV.", inputSchema: { type: "object" } },
    { name: "foldlock_skill", description: "Return FoldLock skill markdown. Does not increment download KV.", inputSchema: { type: "object" } },
    {
      name: "foldlock_fold-preview",
      description: "Compress small UTF-8 text → receipt + FLD3/UNI1/passthrough base64. Cap ~8KB. SOTA adaptive UNI1 engine.",
      inputSchema: { type: "object", additionalProperties: true },
    },
    {
      name: "foldlock_unfold-preview",
      description: "Decompress FLD3/UNI1/passthrough base64 → verified restore or error.",
      inputSchema: { type: "object", additionalProperties: true },
    },
  ];
}

async function foldPreview(body) {
  const src = body && typeof body === "object" ? body : {};
  const text = src.text != null ? String(src.text) : "";
  const raw = new TextEncoder().encode(text);
  if (raw.byteLength > PREVIEW_CAP) {
    return {
      error: "preview cap ~8KB",
      cap: PREVIEW_CAP,
      got: raw.byteLength,
      zip: false,
      kv_increment: false,
      limitation: LIMITATION,
    };
  }
  const { blob, receipt } = await foldBytes(raw);
  return {
    product: PRODUCT,
    version: VERSION,
    spec: SPEC,
    kv_increment: false,
    zip: false,
    method: receipt.method || "adaptive",
    strategy: receipt.strategy,
    banner: "SOTA UNI1 compression engine",
    limitation: LIMITATION,
    receipt,
    b64: b64encode(blob),
    tether_words: TETHERS.length,
  };
}

async function unfoldPreview(body) {
  const src = body && typeof body === "object" ? body : {};
  const b64 = src.b64 || src.fld_b64 || src.bytes_b64;
  if (!b64) {
    return { error: "b64 required", zip: false, verified: false, limitation: LIMITATION };
  }
  let blob;
  try {
    blob = b64decode(b64);
  } catch (err) {
    return { error: "bad base64: " + String(err && err.message ? err.message : err), zip: false, verified: false, limitation: LIMITATION };
  }
  if (blob.byteLength > PREVIEW_CAP + 64) {
    return { error: "preview cap ~8KB", cap: PREVIEW_CAP, zip: false, verified: false, limitation: LIMITATION };
  }
  const { raw, meta } = await unfoldBytes(blob);
  return {
    product: PRODUCT,
    version: VERSION,
    spec: SPEC,
    kv_increment: false,
    zip: false,
    method: meta.method || "adaptive",
    strategy: meta.strategy,
    banner: "SOTA UNI1 compression engine",
    limitation: LIMITATION,
    verified: true,
    text: meta.text,
    orig_size: meta.orig_size,
    orig_sha256: meta.orig_sha256,
  };
}

async function handleMcp(request) {
  if (request.method === "GET") {
    return json({
      ok: true,
      transport: "JSON-RPC MCP-over-HTTP",
      endpoint: "POST /mcp",
      methods: ["initialize", "tools/list", "tools/call", "ping"],
      auth: "none (public)",
      limitation: LIMITATION,
    });
  }
  if (request.method !== "POST") return json({ error: "POST JSON-RPC to /mcp" }, 405);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }
  const id = body && body.id !== undefined ? body.id : null;
  const method = body && body.method;
  const params = (body && body.params) || {};
  const result = (value) => json({ jsonrpc: "2.0", id, result: value });
  if (method === "initialize") {
    return result({
      protocolVersion: PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: PRODUCT, version: VERSION },
      instructions: LIMITATION,
    });
  }
  if (method === "notifications/initialized" || method === "initialized") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (method === "ping") return result({});
  if (method === "tools/list") return result({ tools: mcpTools() });
  if (method === "tools/call") {
    const name = params.name;
    const args = params.arguments || params.input || {};
    let payload;
    try {
      if (name === "foldlock_health") {
        payload = { ok: true, product: PRODUCT, version: VERSION, kv_increment: false, zip: false, limitation: LIMITATION };
      } else if (name === "foldlock_skill") {
        payload = { markdown: SKILL, kv_increment: false, limitation: LIMITATION };
      } else if (name === "foldlock_fold-preview") {
        payload = await foldPreview(args);
      } else if (name === "foldlock_unfold-preview") {
        payload = await unfoldPreview(args);
      } else {
        payload = { error: "unknown tool", name };
      }
    } catch (err) {
      payload = { error: String(err && err.message ? err.message : err), zip: false, limitation: LIMITATION };
    }
    return result({ content: [{ type: "text", text: JSON.stringify(payload) }], isError: Boolean(payload.error) });
  }
  return json({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found: " + String(method) } });
}

export async function handleRuntimeApi(request, url) {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/mcp") return handleMcp(request);
  if (path === "/v1/health" && request.method === "GET") {
    return json({
      ok: true,
      product: PRODUCT,
      version: VERSION,
      spec: SPEC,
      runtime: true,
      kv_increment: false,
      zip: false,
      method: "adaptive",
      paper: PAPER,
      banner: "SOTA UNI1 compression engine",
      limitation: LIMITATION,
      catalog: CATALOG,
      author: "Aziel Eliab",
      doi: DOI,
    });
  }
  if ((path === "/v1/example" || path === "/v1/example/") && (request.method === "GET" || request.method === "HEAD")) {
    return json({
      ok: true,
      product: PRODUCT,
      author: "Aziel Eliab",
      example: EXAMPLE_PAYLOAD,
      note: "Sample payload only. Does not increment downloads.",
    });
  }

  if (path === "/v1/skill" && request.method === "GET") {
    return new Response(SKILL, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-KV-Increment": "false",
        ...corsHeaders(),
      },
    });
  }
  if (path === "/openapi.json" && request.method === "GET") {
    return json(openapiSpec(originOf(request)));
  }
  if ((path === "/ai" || url.pathname === "/ai/") && request.method === "GET") {
    return html(aiHtml(originOf(request)));
  }
  if (path === "/v1/fold-preview" && request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "JSON body required", limitation: LIMITATION, zip: false }, 400);
    }
    try {
      const out = await foldPreview(body);
      return json(out, out.error ? 400 : 200);
    } catch (err) {
      return json({ error: String(err && err.message ? err.message : err), zip: false, limitation: LIMITATION }, 400);
    }
  }
  if (path === "/v1/unfold-preview" && request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "JSON body required", limitation: LIMITATION, zip: false }, 400);
    }
    try {
      const out = await unfoldPreview(body);
      return json(out, out.error ? 400 : 200);
    } catch (err) {
      return json({ error: String(err && err.message ? err.message : err), zip: false, verified: false, limitation: LIMITATION }, 400);
    }
  }
  if (path.startsWith("/v1/") || path === "/v1") {
    return json({ error: "not found", hint: "GET /v1/health  GET /v1/skill  POST /v1/fold-preview  POST /v1/unfold-preview", limitation: LIMITATION, zip: false }, 404);
  }
  return null;
}
