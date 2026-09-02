/**
 * FoldLock FLD3 tether-suppression codec. Not zip. Mirrors foldlock/engine.py.
 * Hosted preview cap ~8KB. /v1 never touches DOWNLOADS.
 */
export const TETHERS = [
  "as","is","has","to","and","or","etc","the","a","an","of","in","on","for","with","at","by","from","into","onto","upon",
  "it","its","be","am","are","was","were","been","being","have","had","having","do","does","did","doing","will","would",
  "shall","should","can","could","may","might","must","not","no","nor","but","if","then","than","so","too","that","this",
  "these","those","which","who","whom","whose","what","when","where","why","how","i","me","my","we","us","our","you",
  "your","he","him","his","she","her","they","them","their","all","any","each","every","few","more","most","other","some",
  "such","also","just","only","even","up","out","off","over","under","here","there","both","same","own","per","via","vs",
  "etcetera",
];
const TETHER_INDEX = Object.fromEntries(TETHERS.map((w, i) => [w, i]));
const TOKEN_RE = /[A-Za-z]+|[^A-Za-z]+/g;
const ESC = 0xFF;
const SHAPE_BARE = 0, SHAPE_LEAD = 1, SHAPE_TRAIL = 2, SHAPE_BOTH = 3;
const CASE_LOWER = 0, CASE_TITLE = 1, CASE_UPPER = 2, CASE_MIXED = 3;
const HEADER_LEN = 54;
export const PREVIEW_CAP = 8192;
export const LIMITATION =
  "THIS IS: reversible tether-word suppression on UTF-8 text; 3-byte opcode per tether; exact restore of letters and bound ASCII spaces. THIS IS NOT: zip/zlib/gzip/DEFLATE/zstd/lzma; a claim every file shrinks; UL; EmployeeLock; TemporalLock; GodLock; a published bake-off. Ratios are receipts not trophies. Short strings can grow.";

function caseCode(word) {
  if (word === word.toLowerCase()) return CASE_LOWER;
  if (word === word.toUpperCase()) return CASE_UPPER;
  if (word[0] === word[0].toUpperCase() && word.slice(1) === word.slice(1).toLowerCase()) return CASE_TITLE;
  return null;
}

function applyCase(base, cse) {
  if (cse === CASE_LOWER) return base;
  if (cse === CASE_UPPER) return base.toUpperCase();
  if (cse === CASE_TITLE) return base.slice(0, 1).toUpperCase() + base.slice(1);
  throw new Error("mixed case is not a tether opcode");
}

export function suppress(text) {
  const tokens = text.match(TOKEN_RE) || [];
  const out = [];
  let tetherHits = 0;
  let tetherBytesSaved = 0;
  const enc = new TextEncoder();
  function emitLit(raw) {
    for (const b of raw) {
      out.push(b);
      if (b === ESC) out.push(ESC);
    }
  }
  let i = 0;
  const n = tokens.length;
  let prevTookTrail = false;
  while (i < n) {
    const tok = tokens[i];
    const key = tok.toLowerCase();
    if (/^[A-Za-z]+$/.test(tok) && Object.prototype.hasOwnProperty.call(TETHER_INDEX, key)) {
      const cse = caseCode(tok);
      if (cse === null) {
        emitLit(enc.encode(tok));
        prevTookTrail = false;
        i += 1;
        continue;
      }
      const lead = !prevTookTrail && i > 0 && tokens[i - 1] === " ";
      const trail = i + 1 < n && tokens[i + 1] === " ";
      let shape = SHAPE_BARE;
      let takeLead = false;
      let takeTrail = false;
      if (lead && trail) {
        shape = SHAPE_BOTH;
        takeLead = true;
        takeTrail = true;
      } else if (lead) {
        shape = SHAPE_LEAD;
        takeLead = true;
      } else if (trail) {
        shape = SHAPE_TRAIL;
        takeTrail = true;
      }
      if (takeLead && out.length && out[out.length - 1] === 0x20) {
        out.pop();
      } else if (takeLead && out.length) {
        shape = takeTrail ? SHAPE_TRAIL : SHAPE_BARE;
        takeLead = false;
      }
      out.push(ESC);
      out.push((cse << 2) | shape);
      out.push(TETHER_INDEX[key]);
      tetherHits += 1;
      const original = (takeLead ? " " : "") + tok + (takeTrail ? " " : "");
      tetherBytesSaved += enc.encode(original).length - 3;
      i += 1;
      if (takeTrail) i += 1;
      prevTookTrail = takeTrail;
      continue;
    }
    emitLit(enc.encode(tok));
    prevTookTrail = false;
    i += 1;
  }
  return {
    body: new Uint8Array(out),
    stats: {
      tether_hits: tetherHits,
      tether_bytes_saved: tetherBytesSaved,
      lexicon: "TETH-1",
      tether_words: TETHERS.length,
    },
  };
}

export function expand(body) {
  const rawOut = [];
  const enc = new TextEncoder();
  let i = 0;
  const n = body.length;
  while (i < n) {
    const b = body[i++];
    if (b !== ESC) {
      rawOut.push(b);
      continue;
    }
    if (i >= n) throw new Error("truncated escape");
    const nxt = body[i++];
    if (nxt === ESC) {
      rawOut.push(ESC);
      continue;
    }
    if (i >= n) throw new Error("truncated tether id");
    const wid = body[i++];
    if (wid >= TETHERS.length) throw new Error("tether id " + wid + " not in TETH-1");
    const cse = (nxt >> 2) & 0x03;
    const shape = nxt & 0x03;
    if (cse === CASE_MIXED) throw new Error("mixed-case tether opcode is illegal");
    let word = applyCase(TETHERS[wid], cse);
    if (shape === SHAPE_LEAD) word = " " + word;
    else if (shape === SHAPE_TRAIL) word = word + " ";
    else if (shape === SHAPE_BOTH) word = " " + word + " ";
    rawOut.push(...enc.encode(word));
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(rawOut));
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(digest);
}

function hex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function packHeader(origSize, digest, bodyLen) {
  const buf = new Uint8Array(HEADER_LEN);
  const view = new DataView(buf.buffer);
  buf[0] = 0x46; buf[1] = 0x4c; buf[2] = 0x44; buf[3] = 0x33;
  buf[4] = 1;
  buf[5] = 0;
  view.setUint32(6, origSize >>> 0, true);
  view.setUint32(10, Math.floor(origSize / 0x100000000), true);
  buf.set(digest, 14);
  view.setUint32(46, bodyLen >>> 0, true);
  view.setUint32(50, Math.floor(bodyLen / 0x100000000), true);
  return buf;
}

function readU64(view, offset) {
  const lo = view.getUint32(offset, true);
  const hi = view.getUint32(offset + 4, true);
  return lo + hi * 0x100000000;
}

export async function foldBytes(raw) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch (err) {
    const e = new Error(
      "FoldLock v0.3 folds UTF-8 text by tether suppression. Binary input is refused. This is not a zip wrapper.",
    );
    e.cause = err;
    throw e;
  }
  const digest = await sha256(raw);
  const { body, stats } = suppress(text);
  const header = packHeader(raw.byteLength, digest, body.byteLength);
  const blob = new Uint8Array(HEADER_LEN + body.byteLength);
  blob.set(header, 0);
  blob.set(body, HEADER_LEN);
  const foldedSize = blob.byteLength;
  return {
    blob,
    receipt: {
      method: "tether-suppression",
      lexicon: stats.lexicon,
      tether_words: stats.tether_words,
      tether_hits: stats.tether_hits,
      tether_bytes_saved: stats.tether_bytes_saved,
      orig_size: raw.byteLength,
      folded_size: foldedSize,
      body_size: body.byteLength,
      orig_sha256: hex(digest),
      ratio: raw.byteLength ? foldedSize / raw.byteLength : 0,
      zip: false,
      version: "0.3.0",
      spec: "foldlock-v0.3",
      paper: "FL-WP-0.3",
      limitation: LIMITATION,
    },
  };
}

export function readContainer(blob) {
  if (blob.byteLength >= 4 && blob[0] === 0x46 && blob[1] === 0x4c && blob[2] === 0x44 && blob[3] === 0x32) {
    throw new Error("FLD2 (zlib wrapper) is retired. Refold with FoldLock v0.3.");
  }
  if (blob.byteLength < HEADER_LEN) throw new Error("file too short for FoldLock v0.3 header");
  if (!(blob[0] === 0x46 && blob[1] === 0x4c && blob[2] === 0x44 && blob[3] === 0x33)) {
    throw new Error("not a FoldLock v0.3 file");
  }
  if (blob[4] !== 1) throw new Error("unsupported lexicon " + blob[4]);
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  const origSize = readU64(view, 6);
  const digest = blob.slice(14, 46);
  const bodyLen = readU64(view, 46);
  const body = blob.slice(HEADER_LEN);
  if (body.byteLength !== bodyLen) {
    throw new Error("body length mismatch: header " + bodyLen + " file " + body.byteLength);
  }
  return {
    meta: {
      lexicon: "TETH-1",
      orig_size: origSize,
      body_size: bodyLen,
      orig_sha256: hex(digest),
      digest,
      method: "tether-suppression",
      zip: false,
    },
    body,
  };
}

export async function unfoldBytes(blob) {
  const { meta, body } = readContainer(blob);
  const text = expand(body);
  const raw = new TextEncoder().encode(text);
  if (raw.byteLength !== meta.orig_size) {
    throw new Error("orig_size mismatch after unfold — suppression restore failed");
  }
  const got = await sha256(raw);
  const expect = meta.digest;
  for (let i = 0; i < 32; i++) {
    if (got[i] !== expect[i]) throw new Error("orig_sha256 mismatch — unfold refused");
  }
  return {
    raw,
    meta: {
      orig_size: raw.byteLength,
      orig_sha256: hex(got),
      verified: true,
      method: "tether-suppression",
      zip: false,
      text,
      version: "0.3.0",
      spec: "foldlock-v0.3",
      paper: "FL-WP-0.3",
      limitation: LIMITATION,
    },
  };
}

export function b64encode(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function b64decode(s) {
  const bin = atob(String(s));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
