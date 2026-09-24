/**
 * Homepage Download is a real one-click asset link.
 * /download still counts the canonical tree and a fork on separate keys,
 * and the total includes both. HEAD does not count.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../src/index.js";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "../public");
const store = new Map();
const env = {
  DOWNLOADS: {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, String(value));
    },
    async list() {
      return { keys: [...store.keys()].map((name) => ({ name })), list_complete: true };
    },
  },
  ASSETS: {
    async fetch(request) {
      const name = decodeURIComponent(new URL(request.url).pathname.replace(/^\//, ""));
      try {
        const body = readFileSync(join(publicDir, name));
        return new Response(body, { status: 200, headers: { "Content-Length": String(body.length) } });
      } catch {
        return new Response("missing", { status: 404 });
      }
    },
  },
};

const previousFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  if (String(url).includes("api.github.com")) {
    return new Response(JSON.stringify({ stargazers_count: 0, forks_count: 0, subscribers_count: 0 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return previousFetch(input, init);
};

function get(path, method = "GET") {
  return worker.fetch(new Request("https://foldlock-download-tracker.vibelock.workers.dev" + path, {
    method,
    headers: { "user-agent": "Mozilla/5.0" },
  }), env);
}

try {
  const home = await get("/");
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /id="downloadBtn"[^>]*href="\/download\?asset=foldlock-0\.8\.0\.tar\.gz"/);
  assert.match(html, /0<span>Downloads<\/span>/);
  assert.equal(store.get("foldlock|__total__"), undefined);
  assert.equal(store.get("foldlock|__views__"), "1");

  const head = await get("/download?asset=foldlock-0.8.0.tar.gz", "HEAD");
  assert.equal(head.status, 200);
  assert.equal(store.get("foldlock|__total__"), undefined);

  const file = await get("/download?asset=foldlock-0.8.0.tar.gz");
  assert.equal(file.status, 200);
  assert.match(file.headers.get("content-type") || "", /gzip/);
  assert.match(file.headers.get("content-disposition") || "", /foldlock-0\.8\.0\.tar\.gz/);
  const bytes = new Uint8Array(await file.arrayBuffer());
  assert.equal(bytes[0], 0x1f);
  assert.equal(bytes[1], 0x8b);
  assert.equal(store.get("foldlock|AzielEliab|foldlock|main|0"), "1");
  assert.equal(store.get("foldlock|__total__"), "1");

  const fork = await get("/download?asset=foldlock-0.8.0.tar.gz&owner=Someone&repo=foldlock&branch=feature&fork=1");
  assert.equal(fork.status, 200);
  assert.equal(store.get("foldlock|Someone|foldlock|feature|1"), "1");
  assert.equal(store.get("foldlock|AzielEliab|foldlock|main|0"), "1");
  assert.equal(store.get("foldlock|__total__"), "2");

  const counted = await get("/");
  const again = await counted.text();
  assert.match(again, /2<span>Downloads<\/span>/);
  const count = await get("/count");
  const body = await count.json();
  assert.equal(body.downloads, 2);
  assert.equal(body.total, 2);
  assert.equal(body.project, "foldlock");
} finally {
  globalThis.fetch = previousFetch;
}

console.log("worker download landing ok");
