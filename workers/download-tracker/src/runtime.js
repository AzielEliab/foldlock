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
description: Use this when folding or unfolding UTF-8 text with FoldLock, a zip-class SOTA adaptive UNI1 compression engine (classify → bakeoff → passthrough). Hosted preview via /v1. Author Aziel Eliab.
---

# FoldLock

FoldLock is **compression software** and a **compression engine** — same category as zip, **SOTA** for its job: adaptive UNI1 tether/SIR fold on UTF-8 text (\`classify → bakeoff → passthrough\`). Magics: FLD3 (TETH) and UNI1 (adaptive). Lexicon: TETH-1. Author: **Aziel Eliab**.

Use FoldLock when someone asks to **fold** English-like UTF-8 text, **unfold** a \`.fld\` / FLD3 / UNI1 blob, or check a fold receipt (strategy, hits, ratio, \`beats_zstd\`). It is not the ZIP file format. Prose/text is the win lane. Short strings are left alone. Already-compressed inputs are refused.

Always send a normal \`User-Agent\` (for example \`Mozilla/5.0\`). Cloudflare Workers may 403 empty agents.

## When to call it

- Fold a UTF-8 string and show a receipt (\`zip: false\` means not the ZIP file format; winning \`strategy\`, hits, ratio). Short strings stay the same size.
- Unfold an FLD3 / UNI1 / passthrough blob (base64) and confirm \`verified: true\`.
- Health / skill / OpenAPI. Never invent a restore. Never claim every file beats zstd. Receipts (\`ratio\`, \`beats_zstd\`) are per-file.

Hosted preview caps input around 8 KB. Bigger files use the local package: \`foldlock fold\` / \`foldlock unfold\`.

## Endpoints (this Worker)

Host: \`https://foldlock-download-tracker.vibelock.workers.dev\`

| Method | Path | What |
|--------|------|------|
| GET | \`/v1/health\` | Liveness. Does not increment downloads. |
| GET | \`/v1/skill\` | This markdown. Does not increment downloads. |
| POST | \`/v1/fold-preview\` | Small UTF-8 text in → receipt + FLD3/UNI1/passthrough base64. SOTA adaptive UNI1. |
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

Works with ChatGPT (GPT Actions / OpenAI), Grok (xAI), Venice, Claude (Anthropic), Cursor (MCP), Glama (MCP), Perplexity, Microsoft Copilot / Bing, Google Gemini / Vertex, Mistral, Meta AI, Apple Intelligence surfaces, Amazon Q tooling, DuckAssist, You.com, Cohere, and other MCP/OpenAPI-capable assistants.

OpenAPI import (no auth): catalog or this Worker \`/openapi.json\` — ChatGPT GPT Actions, Grok custom tool, Venice HTTP tools, and any client that accepts an OpenAPI spec. MCP: Cursor, Glama, and other MCP clients — \`POST\` the catalog or Worker \`/mcp\`. Always send \`User-Agent: Mozilla/5.0\`.

## Honest banner

THIS IS: compression software and a compression engine (zip-class category; SOTA adaptive UNI1 tether/SIR fold on UTF-8 text: classify → bakeoff → passthrough); tether-word suppression and SIR with optional packs; exact restore; short strings left alone; already-compressed input refused.

THIS IS NOT: the ZIP file format, nor a zlib/gzip/DEFLATE/zstd/lzma wrapper; a claim every file shrinks or that FoldLock beats zstd on all files; translation of all inputs to Latin; encryption; UL; EmployeeLock; TemporalLock; GodLock.

Prose/text is the win lane. Code and markup often passthrough. \`beats_zstd\` is per-file when zstd is available.

Method paper: FL-WP-0.3. UNI1 shell: FL-WP-0.8 (no new DOI). The same preprint also describes WhistleLock; this product is FoldLock only.

DOI: https://doi.org/10.5281/zenodo.22257762  
Record: https://zenodo.org/records/22257762  
File: FoldLock_WhistleLock_FL-WP-0.3_WL-WP-0.1.pdf · Apache-2.0 · Eliab, Aziel

Forks are welcome and always allowed.

Local UI: Import JSON file and Export JSON. Run foldlock doctor.

## Catalog + local UI

Author: **Aziel Eliab**. Honest scope: zip-class SOTA adaptive UNI1 compression engine on UTF-8 text. Not the ZIP file format.

- Catalog product: https://aziel-runtime.vibelock.workers.dev/p/foldlock/
- Catalog OpenAPI: https://aziel-runtime.vibelock.workers.dev/openapi.json
- Catalog MCP: POST https://aziel-runtime.vibelock.workers.dev/mcp
- This Worker skill: GET https://foldlock-download-tracker.vibelock.workers.dev/v1/skill
- This Worker OpenAPI: https://foldlock-download-tracker.vibelock.workers.dev/openapi.json
- Sample payload: GET https://foldlock-download-tracker.vibelock.workers.dev/v1/example

Local UI: Import JSON file (type=file) and Export JSON. Then foldlock doctor.

Works with ChatGPT (GPT Actions / OpenAI), Grok (xAI), Venice, Claude (Anthropic), Cursor (MCP), Glama (MCP), Perplexity, Microsoft Copilot / Bing, Google Gemini / Vertex, Mistral, Meta AI, Apple Intelligence surfaces, Amazon Q tooling, DuckAssist, You.com, Cohere, and other MCP/OpenAPI-capable assistants. OpenAPI import (no auth): catalog or Worker OpenAPI. MCP: Cursor, Glama, and other MCP clients.
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
      summary: "Zip-class SOTA adaptive UNI1 compression engine on UTF-8 text.",
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
          summary: "Liveness. Does not increment download KV. SOTA adaptive UNI1.",
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
          summary: "Small UTF-8 text in, receipt + FLD3/UNI1/passthrough base64 out. Cap ~8KB. SOTA adaptive UNI1.",
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
          summary: "FLD3/UNI1/passthrough base64 in, verified restore or error. SOTA adaptive UNI1.",
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
<p>Compression engine · zip-class SOTA adaptive UNI1. Author Aziel Eliab. Receipt zip: False (not the ZIP file format).</p>
<p>Works with ChatGPT (GPT Actions / OpenAI), Grok (xAI), Venice, Claude (Anthropic), Cursor (MCP), Glama (MCP), Perplexity, Microsoft Copilot / Bing, Google Gemini / Vertex, Mistral, Meta AI, Apple Intelligence surfaces, Amazon Q tooling, DuckAssist, You.com, Cohere, and other MCP/OpenAPI-capable assistants.</p>
<p>OpenAPI: <a href="${origin}/openapi.json">${origin}/openapi.json</a> (ChatGPT GPT Actions, Grok custom tool, Venice HTTP tools, or any OpenAPI import). MCP: POST <code>${origin}/mcp</code> (Cursor, Glama, and other MCP clients) · Catalog: <a href="${CATALOG}/">${CATALOG}</a></p>
<p>Paper: <a href="${DOI}">${DOI}</a> · <a href="${ZENODO}">Zenodo 22257762</a></p>
<pre>curl -A Mozilla/5.0 ${origin}/v1/health
curl -A Mozilla/5.0 ${origin}/v1/skill
curl -A Mozilla/5.0 -X POST ${origin}/v1/fold-preview -H 'content-type: application/json' \\
  -d '{"text":"the cat and the dog"}'</pre>
<p>GET/POST under <code>/v1</code> never increment the download counter. Hosted preview is the UNI1 compression engine (not the ZIP file format).</p>
<p><a href="/">Downloads</a></p>
</body></html>`;
}

function mcpTools() {
  return [
    { name: "foldlock_health", description: "Liveness. Does not increment download KV. SOTA adaptive UNI1 compression engine.", inputSchema: { type: "object" } },
    { name: "foldlock_skill", description: "Return FoldLock skill markdown. Does not increment download KV.", inputSchema: { type: "object" } },
    {
      name: "foldlock_fold-preview",
      description: "Small UTF-8 text in, receipt + FLD3/UNI1/passthrough base64 out. SOTA adaptive UNI1. Cap ~8KB.",
      inputSchema: { type: "object", additionalProperties: true },
    },
    {
      name: "foldlock_unfold-preview",
      description: "FLD3/UNI1/passthrough base64 in, verified restore or error. SOTA adaptive UNI1.",
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
    banner: "SOTA adaptive UNI1 compression engine",
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
    banner: "SOTA adaptive UNI1 compression engine",
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
      banner: "SOTA adaptive UNI1 compression engine",
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
