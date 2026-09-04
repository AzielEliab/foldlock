/**
 * FoldLock FLD3 + UNI1 adaptive codec. Not zip. Mirrors the Python engine.
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
const SIR_TOKEN_RE = /[A-Za-z]+(?:'[A-Za-z]+)*|[A-Za-z](?:\.[A-Za-z])+\.?|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+|\d+|[^A-Za-z0-9]+/g;
const ESC = 0xFF;
const SHAPE_BARE = 0, SHAPE_LEAD = 1, SHAPE_TRAIL = 2, SHAPE_BOTH = 3;
const CASE_LOWER = 0, CASE_TITLE = 1, CASE_UPPER = 2, CASE_MIXED = 3;
const TAG_NUM = 0xfa, TAG_LATIN = 0xfb, TAG_ABBREV = 0xfc, TAG_LOCAL = 0xfd, TAG_PEER = 0xfe;
const HEADER_LEN = 54;
const UNI1_HEADER_LEN = 56;
export const PREVIEW_CAP = 8192;
export const VERSION = "0.8.0";
export const SPEC = "foldlock-v0.8-UNI1";
export const PAPER = "FL-WP-0.8";
export const LIMITATION =
  "THIS IS: adaptive reversible fold on UTF-8 text (UNI1 champion shell); tether-word suppression (TETH/FLD4) and structural SIR/FLD5 with optional dictionary, abbreviation, number, and peer packs; exact restore of the original bytes; short strings left alone; already-compressed input refused. THIS IS NOT: zip/zlib/gzip/DEFLATE/zstd/lzma; a claim every file shrinks or that FoldLock beats zstd on all files; a universal compressor; translation of all inputs to Latin; encryption; UL; EmployeeLock; TemporalLock; GodLock; a published industry bake-off. Prose/text is the win lane. Code and markup often passthrough. Ratios are receipts not trophies. beats_zstd is per-file when zstd is available, never a global championship.";

const PEER_RAW = [
  "about","after","again","against","almost","already","although","always","another","around","because","before","behind",
  "between","beyond","cannot","child","children","company","country","different","during","enough","everyone","everything",
  "example","family","first","following","government","great","group","himself","home","house","however","human",
  "important","including","information","instead","itself","little","million","money","month","mother","never","nothing",
  "number","often","people","percent","perhaps","place","possible","power","probably","problem","program","public",
  "question","rather","really","school","second","several","since","someone","something","state","still","story","student",
  "system","themselves","therefore","thing","things","though","thousand","through","today","together","toward","until",
  "water","week","whether","while","without","within","woman","world","year","years","young",
];
const ABBREV_RAW = [
  "approx","dept","govt","intl","acct","admin","config","info","qty","avg","amt","est","fig","vol","chap","stat","temp",
  "blvd","assoc","corp","univ","sept","jan","feb","aug","oct","nov","dec",
];
const LATIN_RAW = [
  "according","across","among","cause","circle","city","day","father","friend","hand","life","light","man","name","night",
  "part","time","voice","war","way","word","work",
];

function bindPack(words, exclude) {
  const out = [];
  const seen = new Set();
  for (const w of words) {
    const key = w.toLowerCase();
    if (exclude.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function boundPacks(latin) {
  const exclude = new Set(TETHERS);
  const peer = bindPack(PEER_RAW, exclude);
  const abbrev = bindPack(ABBREV_RAW, new Set([...exclude, ...peer]));
  const latinP = latin ? bindPack(LATIN_RAW, new Set([...exclude, ...peer, ...abbrev])) : [];
  return { peer, abbrev, latinP };
}

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

function wordKey(tok) {
  return /^[A-Za-z]+$/.test(tok) ? tok.toLowerCase() : null;
}

function isNumber(tok) {
  return tok && /^\d/.test(tok) && /^[\d,.]+$/.test(tok);
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
      if (lead && trail) { shape = SHAPE_BOTH; takeLead = true; takeTrail = true; }
      else if (lead) { shape = SHAPE_LEAD; takeLead = true; }
      else if (trail) { shape = SHAPE_TRAIL; takeTrail = true; }
      if (takeLead && out.length && out[out.length - 1] === 0x20) out.pop();
      else if (takeLead && out.length) {
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
    if (b !== ESC) { rawOut.push(b); continue; }
    if (i >= n) throw new Error("truncated escape");
    const nxt = body[i++];
    if (nxt === ESC) { rawOut.push(ESC); continue; }
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

function shapeFor(tokens, i, prevTookTrail) {
  const lead = !prevTookTrail && i > 0 && tokens[i - 1] === " ";
  const trail = i + 1 < tokens.length && tokens[i + 1] === " ";
  if (lead && trail) return [SHAPE_BOTH, true, true];
  if (lead) return [SHAPE_LEAD, true, false];
  if (trail) return [SHAPE_TRAIL, false, true];
  return [SHAPE_BARE, false, false];
}

function adjustLead(out, shape, takeLead, takeTrail) {
  if (takeLead && out.length && out[out.length - 1] === 0x20) {
    out.pop();
    return [shape, true];
  }
  if (takeLead && out.length) return [takeTrail ? SHAPE_TRAIL : SHAPE_BARE, false];
  return [shape, takeLead];
}

function compactInt(tok) {
  if (!/^[1-9]\d*$|^0$/.test(tok)) return null;
  const n = Number(tok);
  if (!Number.isSafeInteger(n)) return null;
  const asciiLen = tok.length;
  if (n >= 0 && n <= 255 && asciiLen > 4) return new Uint8Array([ESC, TAG_NUM, 0, n]);
  if (n >= 0 && n <= 0xffffffff && asciiLen > 7) {
    const buf = new Uint8Array(7);
    buf[0] = ESC; buf[1] = TAG_NUM; buf[2] = 1;
    new DataView(buf.buffer).setUint32(3, n >>> 0, true);
    return buf;
  }
  return null;
}

export function encodeSir(text, opts = {}) {
  const usePeer = opts.usePeer !== false;
  const useAbbrev = opts.useAbbrev !== false;
  const useLocal = opts.useLocal !== false;
  const useNumbers = opts.useNumbers !== false;
  const useLatin = !!opts.useLatin;
  const { peer, abbrev, latinP } = boundPacks(useLatin);
  const peerIndex = usePeer ? Object.fromEntries(peer.map((w, i) => [w, i])) : {};
  const abbrevIndex = useAbbrev ? Object.fromEntries(abbrev.map((w, i) => [w, i])) : {};
  const latinIndex = useLatin ? Object.fromEntries(latinP.map((w, i) => [w, i])) : {};
  const tokens = text.match(SIR_TOKEN_RE) || [];
  const wordKeys = [];
  const numKeys = [];
  for (const tok of tokens) {
    const wk = wordKey(tok);
    if (wk && !(wk in TETHER_INDEX) && !(wk in peerIndex) && !(wk in abbrevIndex) && !(wk in latinIndex)) wordKeys.push(wk);
    else if (useNumbers && isNumber(tok)) numKeys.push(tok);
  }
  let localWords = [];
  let localNums = [];
  if (useLocal) {
    const wc = new Map();
    for (const w of wordKeys) wc.set(w, (wc.get(w) || 0) + 1);
    localWords = [...wc.entries()].filter(([w, n]) => n >= 2 && w.length > 3)
      .sort((a, b) => (b[0].length * (b[1] - 1)) - (a[0].length * (a[1] - 1)) || b[0].length - a[0].length || (a[0] < b[0] ? 1 : -1))
      .slice(0, 200).map(([w]) => w);
    if (useNumbers) {
      const nc = new Map();
      for (const t of numKeys) nc.set(t, (nc.get(t) || 0) + 1);
      const remain = Math.max(0, 255 - localWords.length);
      localNums = [...nc.entries()].filter(([t, n]) => n >= 2 && t.length > 3)
        .sort((a, b) => (b[0].length * (b[1] - 1)) - (a[0].length * (a[1] - 1)))
        .slice(0, remain).map(([t]) => t);
    }
  }
  const wordIndex = Object.fromEntries(localWords.map((w, i) => [w, i]));
  const numIndex = Object.fromEntries(localNums.map((t, i) => [t, i]));
  const enc = new TextEncoder();
  const prefix = [];
  prefix.push(localWords.length);
  for (const w of localWords) {
    const raw = enc.encode(w);
    prefix.push(raw.length);
    prefix.push(...raw);
  }
  prefix.push(localNums.length);
  for (const t of localNums) {
    const raw = enc.encode(t);
    prefix.push(raw.length);
    prefix.push(...raw);
  }
  const out = [];
  let tetherHits = 0, peerHits = 0, abbrevHits = 0, latinHits = 0, localHits = 0, numberHits = 0;
  let prevTookTrail = false;
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    const key = wordKey(tok);
    const cse = key ? caseCode(tok) : null;
    let used = false;
    if (key && cse !== null) {
      let [shape, takeLead, takeTrail] = shapeFor(tokens, i, prevTookTrail);
      let tag = null;
      let tagId = null;
      if (key in TETHER_INDEX) tagId = TETHER_INDEX[key];
      else if (key in peerIndex) { tag = TAG_PEER; tagId = peerIndex[key]; }
      else if (key in abbrevIndex) { tag = TAG_ABBREV; tagId = abbrevIndex[key]; }
      else if (key in latinIndex) { tag = TAG_LATIN; tagId = latinIndex[key]; }
      else if (key in wordIndex) { tag = TAG_LOCAL; tagId = wordIndex[key]; }
      if (tagId !== null) {
        [shape, takeLead] = adjustLead(out, shape, takeLead, takeTrail);
        const marker = (cse << 2) | shape;
        out.push(ESC);
        if (key in TETHER_INDEX) {
          out.push(marker);
          out.push(tagId);
          tetherHits += 1;
        } else {
          out.push(tag);
          out.push(marker);
          out.push(tagId);
          if (tag === TAG_PEER) peerHits += 1;
          else if (tag === TAG_ABBREV) abbrevHits += 1;
          else if (tag === TAG_LATIN) latinHits += 1;
          else localHits += 1;
        }
        i += 1;
        if (takeTrail) i += 1;
        prevTookTrail = takeTrail;
        used = true;
      }
    }
    if (used) continue;
    if (useNumbers && isNumber(tok)) {
      let [shape, takeLead, takeTrail] = shapeFor(tokens, i, prevTookTrail);
      if (tok in numIndex) {
        [shape, takeLead] = adjustLead(out, shape, takeLead, takeTrail);
        out.push(ESC, TAG_LOCAL, (CASE_LOWER << 2) | shape, localWords.length + numIndex[tok]);
        localHits += 1;
        i += 1;
        if (takeTrail) i += 1;
        prevTookTrail = takeTrail;
        continue;
      }
      const compact = compactInt(tok);
      if (compact) {
        out.push(...compact);
        numberHits += 1;
        prevTookTrail = false;
        i += 1;
        continue;
      }
    }
    const raw = enc.encode(tok);
    for (const b of raw) {
      out.push(b);
      if (b === ESC) out.push(ESC);
    }
    prevTookTrail = false;
    i += 1;
  }
  return {
    body: new Uint8Array([...prefix, ...out]),
    stats: {
      tether_hits: tetherHits,
      peer_hits: peerHits,
      abbrev_hits: abbrevHits,
      latin_hits: latinHits,
      local_hits: localHits,
      number_hits: numberHits,
      lexicon: "TETH-1+SIR",
      tether_words: TETHERS.length,
      latin_pack: useLatin,
    },
  };
}

function readCountedTable(body, pos) {
  if (pos >= body.length) throw new Error("truncated SIR dictionary");
  const count = body[pos++];
  const items = [];
  for (let k = 0; k < count; k++) {
    if (pos >= body.length) throw new Error("truncated SIR dictionary");
    const ln = body[pos++];
    const chunk = body.slice(pos, pos + ln);
    if (chunk.length !== ln) throw new Error("truncated SIR dictionary entry");
    items.push(new TextDecoder("utf-8", { fatal: true }).decode(chunk));
    pos += ln;
  }
  return [items, pos];
}

export function decodeSir(payload, latin = false) {
  const { peer, abbrev, latinP } = boundPacks(latin);
  let pos = 0;
  let localWords, localNums;
  [localWords, pos] = readCountedTable(payload, pos);
  [localNums, pos] = readCountedTable(payload, pos);
  const localAll = localWords.concat(localNums);
  const nWords = localWords.length;
  const rawOut = [];
  const enc = new TextEncoder();
  let i = pos;
  while (i < payload.length) {
    const b = payload[i++];
    if (b !== ESC) { rawOut.push(b); continue; }
    if (i >= payload.length) throw new Error("truncated escape");
    const nxt = payload[i++];
    if (nxt === ESC) { rawOut.push(ESC); continue; }
    if (nxt === TAG_PEER || nxt === TAG_ABBREV || nxt === TAG_LOCAL || nxt === TAG_LATIN) {
      if (i + 1 >= payload.length) throw new Error("truncated SIR opcode");
      const marker = payload[i++];
      const wid = payload[i++];
      const cse = (marker >> 2) & 0x03;
      const shape = marker & 0x03;
      let word;
      if (nxt === TAG_PEER) word = applyCase(peer[wid], cse);
      else if (nxt === TAG_ABBREV) word = applyCase(abbrev[wid], cse);
      else if (nxt === TAG_LATIN) word = applyCase(latinP[wid], cse);
      else word = wid < nWords ? applyCase(localAll[wid], cse) : localAll[wid];
      if (shape === SHAPE_LEAD) word = " " + word;
      else if (shape === SHAPE_TRAIL) word = word + " ";
      else if (shape === SHAPE_BOTH) word = " " + word + " ";
      rawOut.push(...enc.encode(word));
      continue;
    }
    if (nxt === TAG_NUM) {
      const kind = payload[i++];
      if (kind === 0) rawOut.push(...enc.encode(String(payload[i++])));
      else if (kind === 1) {
        const view = new DataView(payload.buffer, payload.byteOffset + i, 4);
        rawOut.push(...enc.encode(String(view.getUint32(0, true))));
        i += 4;
      } else throw new Error("bad number kind " + kind);
      continue;
    }
    if (i >= payload.length) throw new Error("truncated tether id");
    const wid = payload[i++];
    const cse = (nxt >> 2) & 0x03;
    const shape = nxt & 0x03;
    let word = applyCase(TETHERS[wid], cse);
    if (shape === SHAPE_LEAD) word = " " + word;
    else if (shape === SHAPE_TRAIL) word = word + " ";
    else if (shape === SHAPE_BOTH) word = " " + word + " ";
    rawOut.push(...enc.encode(word));
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(rawOut));
}

export function encodeBodyx(text) {
  const parts = text.split(/(\n{2,})/);
  const out = [];
  const view16 = new Uint8Array(2);
  new DataView(view16.buffer).setUint16(0, parts.length, true);
  out.push(...view16);
  let tethParts = 0, litParts = 0;
  const enc = new TextEncoder();
  for (const part of parts) {
    const hdr = new Uint8Array(5);
    const dv = new DataView(hdr.buffer);
    if (!part) {
      dv.setUint8(0, 0);
      dv.setUint32(1, 0, true);
      out.push(...hdr);
      litParts += 1;
      continue;
    }
    const { body } = suppress(part);
    const restored = expand(body);
    const rawPart = enc.encode(part);
    let kind = 0;
    let raw = rawPart;
    if (restored === part && body.length < rawPart.length) {
      kind = 1;
      raw = body;
      tethParts += 1;
    } else litParts += 1;
    dv.setUint8(0, kind);
    dv.setUint32(1, raw.length, true);
    out.push(...hdr, ...raw);
  }
  return {
    body: new Uint8Array(out),
    stats: { tether_hits: tethParts, lexicon: "TETH-1", tether_words: TETHERS.length, bodyx_parts: parts.length },
  };
}

export function decodeBodyx(payload) {
  if (payload.length < 2) throw new Error("truncated bodyx header");
  const count = new DataView(payload.buffer, payload.byteOffset, 2).getUint16(0, true);
  let pos = 2;
  const chunks = [];
  for (let k = 0; k < count; k++) {
    if (pos + 5 > payload.length) throw new Error("truncated bodyx part");
    const kind = payload[pos];
    const ln = new DataView(payload.buffer, payload.byteOffset + pos + 1, 4).getUint32(0, true);
    pos += 5;
    const chunk = payload.slice(pos, pos + ln);
    if (chunk.length !== ln) throw new Error("truncated bodyx body");
    pos += ln;
    if (kind === 1) chunks.push(expand(chunk));
    else if (kind === 0) chunks.push(new TextDecoder("utf-8", { fatal: true }).decode(chunk));
    else throw new Error("bad bodyx kind " + kind);
  }
  return chunks.join("");
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

function packUni1(origSize, digest, payload, strategy, flags, klass) {
  const buf = new Uint8Array(UNI1_HEADER_LEN);
  const view = new DataView(buf.buffer);
  buf[0] = 0x55; buf[1] = 0x4e; buf[2] = 0x49; buf[3] = 0x31;
  buf[4] = 1;
  buf[5] = strategy;
  buf[6] = flags;
  buf[7] = klass;
  view.setUint32(8, origSize >>> 0, true);
  view.setUint32(12, Math.floor(origSize / 0x100000000), true);
  buf.set(digest, 16);
  view.setUint32(48, payload.length >>> 0, true);
  view.setUint32(52, Math.floor(payload.length / 0x100000000), true);
  const out = new Uint8Array(UNI1_HEADER_LEN + payload.length);
  out.set(buf, 0);
  out.set(payload, UNI1_HEADER_LEN);
  return out;
}

function readU64(view, offset) {
  const lo = view.getUint32(offset, true);
  const hi = view.getUint32(offset + 4, true);
  return lo + hi * 0x100000000;
}

const COMPRESSED_MAGICS = [
  [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "png"],
  [new Uint8Array([0xff, 0xd8, 0xff]), "jpg"],
  [new Uint8Array([0x50, 0x4b, 0x03, 0x04]), "zip"],
  [new Uint8Array([0x50, 0x4b, 0x05, 0x06]), "zip"],
  [new Uint8Array([0x1f, 0x8b]), "gzip"],
  [new Uint8Array([0x28, 0xb5, 0x2f, 0xfd]), "zstd"],
  [new TextEncoder().encode("%PDF"), "pdf"],
];
const COMPRESSED_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".pdf", ".zip", ".gz", ".zst", ".zstd", ".webp"]);
const PROSE_EXT = new Set([".txt", ".text", ".md", ".markdown", ".rst"]);
const CODE_EXT = new Set([".py", ".js", ".ts", ".c", ".h", ".rs", ".go", ".java"]);
const MARKUP_EXT = new Set([".json", ".html", ".htm", ".xml", ".yaml", ".yml", ".svg"]);
const KIND_ID = { prose: 0, code: 1, markup: 2, mixed: 3, compressed: 4 };

function startsWithBytes(raw, magic) {
  if (raw.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) if (raw[i] !== magic[i]) return false;
  return true;
}

function extOf(name) {
  const m = String(name || "").toLowerCase().match(/\.[a-z0-9]+$/);
  return m ? m[0] : "";
}

export function classify(raw, name = "") {
  const ext = extOf(name);
  for (const [magic, media] of COMPRESSED_MAGICS) {
    if (startsWithBytes(raw, magic)) return { kind: "compressed", reason: "magic:" + media, media };
  }
  if (COMPRESSED_EXT.has(ext)) return { kind: "compressed", reason: "ext:" + ext, media: ext.slice(1) };
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(raw); }
  catch { return { kind: "mixed", reason: "non-utf8", media: "bin" }; }
  if (MARKUP_EXT.has(ext)) return { kind: "markup", reason: "ext:" + ext, media: ext.slice(1) };
  if (CODE_EXT.has(ext)) return { kind: "code", reason: "ext:" + ext, media: ext.slice(1) };
  if (PROSE_EXT.has(ext)) return { kind: "prose", reason: "ext:" + ext, media: ext.slice(1) };
  const stripped = text.replace(/^\s+/, "");
  if (stripped.startsWith("{") || stripped.startsWith("[")) {
    try { JSON.parse(text); return { kind: "markup", reason: "json-sniff", media: "json" }; } catch { /* fall */ }
  }
  if (stripped.startsWith("<") && (stripped.toLowerCase().startsWith("<!doctype") || stripped.toLowerCase().startsWith("<html") || stripped.includes("</"))) {
    return { kind: "markup", reason: "html-xml-sniff", media: "html" };
  }
  return { kind: "prose", reason: "utf8-prose-sniff", media: "txt" };
}

function allowlist(kind) {
  if (kind === "prose") return ["sir", "teth", "teth_peer", "bodyx"];
  if (kind === "code") return ["teth"];
  if (kind === "markup") return ["teth"];
  if (kind === "mixed") return ["sir", "teth"];
  return [];
}

export async function foldFld3Bytes(raw) {
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(raw); }
  catch (err) {
    const e = new Error("FoldLock v0.8 folds UTF-8 text. Binary input is refused. This is not a zip wrapper.");
    e.cause = err;
    throw e;
  }
  const digest = await sha256(raw);
  const { body, stats } = suppress(text);
  const header = packHeader(raw.byteLength, digest, body.byteLength);
  const blob = new Uint8Array(HEADER_LEN + body.byteLength);
  blob.set(header, 0);
  blob.set(body, HEADER_LEN);
  return { blob, stats, receipt: receiptFrom(raw, blob, stats, "teth", "FLD3", "txt") };
}

function receiptFrom(raw, blob, stats, strategy, magic, klass) {
  const method = strategy === "passthrough" ? "passthrough" : strategy === "teth" ? "tether-suppression" : strategy === "teth_peer" ? "tether-peer" : strategy;
  return {
    method,
    strategy,
    champion: strategy,
    class: klass,
    passthrough: strategy === "passthrough",
    grew: blob.byteLength > raw.byteLength,
    lexicon: stats.lexicon || "TETH-1",
    tether_words: stats.tether_words || TETHERS.length,
    tether_hits: stats.tether_hits || 0,
    tether_bytes_saved: stats.tether_bytes_saved || 0,
    peer_hits: stats.peer_hits || 0,
    abbrev_hits: stats.abbrev_hits || 0,
    latin_hits: stats.latin_hits || 0,
    local_hits: stats.local_hits || 0,
    number_hits: stats.number_hits || 0,
    orig_size: raw.byteLength,
    folded_size: blob.byteLength,
    body_size: stats.body_size || Math.max(0, blob.byteLength - 54),
    orig_sha256: null,
    ratio: raw.byteLength ? blob.byteLength / raw.byteLength : 0,
    zip: false,
    beats_zstd: null,
    zstd_available: false,
    version: VERSION,
    spec: SPEC,
    paper: PAPER,
    limitation: LIMITATION,
    magic,
  };
}

export async function foldBytes(raw, opts = {}) {
  const name = opts.name || "";
  const latinPack = !!opts.latinPack;
  const cls = classify(raw, name);
  if (cls.kind === "compressed") {
    throw new Error("FoldLock refuses already-compressed input (" + (cls.media || cls.reason) + "). This is not a zip wrapper.");
  }
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(raw); }
  catch (err) {
    const e = new Error("FoldLock v0.8 folds UTF-8 text. Binary input is refused. This is not a zip wrapper.");
    e.cause = err;
    throw e;
  }
  const digest = await sha256(raw);
  const allowed = allowlist(cls.kind);
  const bakeoff = [];
  let best = null;

  async function consider(strategy, blob, stats) {
    let ok = false;
    try {
      const { raw: restored } = await unfoldBytes(blob);
      ok = restored.byteLength === raw.byteLength && hex(restored) === hex(raw);
    } catch { ok = false; }
    const shrinks = ok && blob.byteLength < raw.byteLength;
    bakeoff.push({ strategy, size: blob.byteLength, roundtrip: ok, shrinks });
    if (!shrinks) return;
    if (!best || blob.byteLength < best.blob.byteLength) best = { strategy, blob, stats };
  }

  if (allowed.includes("teth")) {
    const { blob, stats } = await foldFld3Bytes(raw);
    await consider("teth", blob, stats);
  }
  if (allowed.includes("teth_peer")) {
    const { body, stats } = encodeSir(text, { usePeer: true, useAbbrev: true, useLocal: false, useNumbers: true, useLatin: latinPack });
    const flags = 0x02 | 0x04 | (latinPack ? 0x01 : 0);
    const blob = packUni1(raw.byteLength, digest, body, 4, flags, KIND_ID[cls.kind] ?? 3);
    stats.body_size = body.length;
    await consider("teth_peer", blob, stats);
  }
  if (allowed.includes("sir")) {
    const { body, stats } = encodeSir(text, { usePeer: true, useAbbrev: true, useLocal: true, useNumbers: true, useLatin: latinPack });
    const flags = 0x02 | 0x04 | (latinPack ? 0x01 : 0);
    const blob = packUni1(raw.byteLength, digest, body, 2, flags, KIND_ID[cls.kind] ?? 3);
    stats.body_size = body.length;
    await consider("sir", blob, stats);
  }
  if (allowed.includes("bodyx")) {
    const { body, stats } = encodeBodyx(text);
    const blob = packUni1(raw.byteLength, digest, body, 3, 0, KIND_ID[cls.kind] ?? 3);
    stats.body_size = body.length;
    await consider("bodyx", blob, stats);
  }

  if (!best) {
    const receipt = receiptFrom(raw, raw, { lexicon: "none", tether_words: 0, tether_hits: 0 }, "passthrough", "PASS", cls.kind);
    receipt.orig_sha256 = hex(digest);
    receipt.bakeoff = bakeoff;
    receipt.grew = false;
    return { blob: raw, receipt };
  }
  const receipt = receiptFrom(raw, best.blob, best.stats, best.strategy, best.blob[0] === 0x55 ? "UNI1" : "FLD3", cls.kind);
  receipt.orig_sha256 = hex(digest);
  receipt.bakeoff = bakeoff;
  return { blob: best.blob, receipt };
}

export function readContainer(blob) {
  if (blob.byteLength >= 4 && blob[0] === 0x46 && blob[1] === 0x4c && blob[2] === 0x44 && blob[3] === 0x32) {
    throw new Error("FLD2 (zlib wrapper) is retired. Refold with FoldLock v0.8.");
  }
  if (blob.byteLength < HEADER_LEN) throw new Error("file too short for FoldLock FLD3 header");
  if (!(blob[0] === 0x46 && blob[1] === 0x4c && blob[2] === 0x44 && blob[3] === 0x33)) {
    throw new Error("not a FoldLock FLD3 file");
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

function readUni1(blob) {
  if (blob.byteLength < UNI1_HEADER_LEN) throw new Error("file too short for FoldLock UNI1 header");
  if (!(blob[0] === 0x55 && blob[1] === 0x4e && blob[2] === 0x49 && blob[3] === 0x31)) {
    throw new Error("not a FoldLock UNI1 file");
  }
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  const ver = blob[4];
  if (ver !== 1) throw new Error("unsupported UNI1 version " + ver);
  const strategy = blob[5];
  const flags = blob[6];
  const klass = blob[7];
  const origSize = readU64(view, 8);
  const digest = blob.slice(16, 48);
  const payloadLen = readU64(view, 48);
  const payload = blob.slice(UNI1_HEADER_LEN);
  if (payload.byteLength !== payloadLen) throw new Error("payload length mismatch");
  return { strategy, flags, klass, origSize, digest, payload };
}

export async function unfoldBytes(blob) {
  if (blob.byteLength >= 4 && blob[0] === 0x46 && blob[1] === 0x4c && blob[2] === 0x44 && blob[3] === 0x32) {
    throw new Error("FLD2 (zlib wrapper) is retired. Refold with FoldLock v0.8.");
  }
  if (blob.byteLength >= 4 && blob[0] === 0x46 && blob[1] === 0x4c && blob[2] === 0x44 && blob[3] === 0x33) {
    const { meta, body } = readContainer(blob);
    const text = expand(body);
    const raw = new TextEncoder().encode(text);
    if (raw.byteLength !== meta.orig_size) throw new Error("orig_size mismatch after unfold — suppression restore failed");
    const got = await sha256(raw);
    for (let i = 0; i < 32; i++) if (got[i] !== meta.digest[i]) throw new Error("orig_sha256 mismatch — unfold refused");
    return {
      raw,
      meta: {
        orig_size: raw.byteLength,
        orig_sha256: hex(got),
        verified: true,
        method: "tether-suppression",
        strategy: "teth",
        zip: false,
        text,
        version: VERSION,
        spec: SPEC,
        paper: PAPER,
        limitation: LIMITATION,
      },
    };
  }
  if (blob.byteLength >= 4 && blob[0] === 0x55 && blob[1] === 0x4e && blob[2] === 0x49 && blob[3] === 0x31) {
    const u = readUni1(blob);
    const latin = !!(u.flags & 0x01);
    let text;
    if (u.strategy === 2 || u.strategy === 4) text = decodeSir(u.payload, latin);
    else if (u.strategy === 3) text = decodeBodyx(u.payload);
    else if (u.strategy === 1) text = expand(u.payload);
    else if (u.strategy === 0) text = new TextDecoder("utf-8", { fatal: true }).decode(u.payload);
    else throw new Error("unsupported UNI1 strategy " + u.strategy);
    const raw = new TextEncoder().encode(text);
    if (raw.byteLength !== u.origSize) throw new Error("orig_size mismatch after unfold — suppression restore failed");
    const got = await sha256(raw);
    for (let i = 0; i < 32; i++) if (got[i] !== u.digest[i]) throw new Error("orig_sha256 mismatch — unfold refused");
    const names = { 0: "passthrough", 1: "tether-suppression", 2: "sir", 3: "bodyx", 4: "tether-peer" };
    return {
      raw,
      meta: {
        orig_size: raw.byteLength,
        orig_sha256: hex(got),
        verified: true,
        method: names[u.strategy] || "adaptive",
        strategy: names[u.strategy] || String(u.strategy),
        zip: false,
        text,
        version: VERSION,
        spec: SPEC,
        paper: PAPER,
        limitation: LIMITATION,
      },
    };
  }
  const got = await sha256(blob);
  let text = null;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(blob); } catch { text = null; }
  return {
    raw: blob,
    meta: {
      orig_size: blob.byteLength,
      orig_sha256: hex(got),
      verified: true,
      method: "passthrough",
      strategy: "passthrough",
      zip: false,
      text,
      version: VERSION,
      spec: SPEC,
      paper: PAPER,
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
