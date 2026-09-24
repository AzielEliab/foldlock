/* FoldLock local app. No CDN. No telemetry. */
(function () {
  const kid = document.getElementById("kid-plain");
  const verifyLine = document.getElementById("verify-line");
  const rowsPre = document.getElementById("rows-pre");
  const advanced = document.getElementById("advanced");
  const openText = document.getElementById("open-text");
  const openFld = document.getElementById("open-fld");
  const plain = document.getElementById("plain");

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  const METHOD = {
    passthrough: "left unchanged",
    teth: "tether fold",
    "tether-suppression": "tether fold",
    teth_peer: "tether fold with peer words",
    "tether-peer": "tether fold with peer words",
    sir: "structural fold",
    bodyx: "mixed fold",
    byte: "byte tether",
    "byte-tether": "byte tether"
  };

  function methodName(strategy) {
    if (!strategy) return "";
    const gloss = METHOD[strategy];
    return gloss ? (gloss + " (" + strategy + ")") : strategy;
  }

  function plainStatus(state) {
    if (!state) return "Drop a file or paste text, then choose Fold.";
    if (state.error) {
      return state.error + " Try another file, then Fold again.";
    }
    const receipt = state.receipt || {};
    const strategy = receipt.strategy || state.method || "";
    const verified = (state.verify && state.verify.ok === true) || (state.unfold && state.unfold.verified === true);
    const name = state.name ? (state.name + ": ") : "";
    if (strategy === "passthrough") {
      return name + "Left as-is (" + (state.orig_size || 0) + " bytes). Folding would not make this smaller.";
    }
    if (state.has_folded && state.orig_size && state.folded_size < state.orig_size) {
      let line = name + "Folded " + state.orig_size + " bytes down to " + state.folded_size + " bytes.";
      const how = methodName(strategy);
      if (how) line += " Method: " + how + ".";
      if (verified) line += " Restore check passed.";
      return line;
    }
    if (verified) return name + "Restore check passed.";
    return "Drop a file or paste text, then choose Fold.";
  }

  function paint(state) {
    const receipt = (state && state.receipt) || {};
    const verified = (state && state.verify) || {};
    setText("c-hits", receipt.tether_hits != null ? receipt.tether_hits : (state.tether_hits || 0));
    setText("c-orig", state.orig_size || 0);
    setText("c-folded", state.folded_size || 0);
    setText("c-zip", "False");
    const ratio = receipt.ratio != null ? receipt.ratio : state.ratio;
    setText("c-ratio", typeof ratio === "number" ? ratio.toFixed(3) : "—");
    const ok = verified.ok === true || (state.unfold && state.unfold.verified === true);
    const unknown = verified.ok == null && !state.unfold;
    setText("c-ok", unknown ? "—" : (ok ? "yes" : "no"));
    setText("c-strat", receipt.strategy || state.method || "—");
    if (plain) {
      if (state.sample_text != null) plain.value = state.sample_text;
      else if (state.has_folded && state.name && state.name !== "typed.txt") plain.value = "";
    }
    if (kid) kid.textContent = plainStatus(state);
    const sha = state.orig_sha256 || "";
    if (verifyLine) {
      verifyLine.textContent = sha ? ("SHA-256 " + sha) : "";
    }
    if (rowsPre) rowsPre.textContent = JSON.stringify(state, null, 2);
    window.__azielLastJson = state;
  }

  function post(url, body) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    }).then(function (res) {
      return res.json().then(function (payload) {
        if (!res.ok) {
          const reason = payload.error || ("HTTP " + res.status);
          const err = new Error(reason);
          err.payload = payload;
          throw err;
        }
        return payload;
      });
    });
  }

  function showError(err) {
    const reason = (err && err.message) ? err.message : String(err);
    if (kid) kid.textContent = reason + " Try another file, or choose Unfold for a folded file.";
  }

  function foldFile(file) {
    if (!file) return;
    file.arrayBuffer().then(function (buf) {
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      return post("/api/fold", { name: file.name, b64: btoa(binary) });
    }).then(paint).catch(showError);
  }

  function refresh() {
    return fetch("/api/state").then(function (res) { return res.json(); }).then(paint);
  }

  document.getElementById("btn-fold").addEventListener("click", function () {
    const text = plain.value;
    if (text && text.length) {
      post("/api/text", { text: text, name: "typed.txt" }).then(paint).catch(showError);
      return;
    }
    openText.click();
  });

  document.getElementById("btn-unfold").addEventListener("click", function () {
    openFld.click();
  });

  document.getElementById("btn-verify").addEventListener("click", function () {
    post("/api/verify", {}).then(paint).catch(showError);
  });

  openText.addEventListener("change", function () {
    const file = openText.files && openText.files[0];
    foldFile(file);
    openText.value = "";
  });

  const panel = document.querySelector(".panel");
  if (panel) {
    panel.addEventListener("dragover", function (event) {
      event.preventDefault();
      panel.classList.add("drag");
    });
    panel.addEventListener("dragleave", function () {
      panel.classList.remove("drag");
    });
    panel.addEventListener("drop", function (event) {
      event.preventDefault();
      panel.classList.remove("drag");
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      foldFile(file);
    });
  }

  openFld.addEventListener("change", function () {
    const file = openFld.files && openFld.files[0];
    if (!file) return;
    file.arrayBuffer().then(function (buf) {
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return post("/api/unfold", { name: file.name, b64: btoa(binary) });
    }).then(paint).catch(showError);
    openFld.value = "";
  });

  const sample = document.getElementById("btn-sample");
  if (sample) sample.addEventListener("click", function () {
    post("/api/sample", {}).then(paint).catch(showError);
  });
  const info = document.getElementById("btn-info");
  if (info) info.addEventListener("click", function () {
    post("/api/info", {}).then(paint).catch(showError);
  });
  const exp = document.getElementById("btn-export");
  if (exp) exp.addEventListener("click", function () {
    post("/api/export", {}).then(function (payload) {
      const blob = new Blob([JSON.stringify(payload.receipt, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = payload.filename || "foldlock-receipt.json";
      a.click();
      paint(payload.receipt);
    }).catch(showError);
  });
  const doc = document.getElementById("btn-doctor");
  if (doc) doc.addEventListener("click", function () {
    post("/api/doctor", {}).then(function (payload) {
      if (kid) {
        kid.textContent = payload.ok
          ? "Doctor passed. Every check on this machine succeeded."
          : "Doctor found a problem. The checks are listed below.";
      }
      if (!payload.ok && advanced) advanced.open = true;
      if (rowsPre) rowsPre.textContent = JSON.stringify(payload, null, 2);
    }).catch(showError);
  });
  const dlFld = document.getElementById("btn-dl-fld");
  if (dlFld) dlFld.addEventListener("click", function () { window.location = "/api/download.fld"; });
  const dlTxt = document.getElementById("btn-dl-txt");
  if (dlTxt) dlTxt.addEventListener("click", function () { window.location = "/api/download.txt"; });

  const file = document.getElementById("aziel-import-json");
  const imp = document.getElementById("aziel-import-json-btn");
  const expJson = document.getElementById("aziel-export-json-btn");
  const status = document.getElementById("aziel-json-status");
  function say(message) { if (status) status.textContent = message; }
  function collect() {
    const data = { product: document.title || "", exported_at: new Date().toISOString(), author: "Aziel Eliab" };
    document.querySelectorAll("input, select, textarea").forEach(function (el) {
      if (!el.id || el.type === "file" || el.type === "password") return;
      data[el.id] = el.type === "checkbox" ? el.checked : el.value;
    });
    if (window.__azielLastJson && typeof window.__azielLastJson === "object") {
      data.last = window.__azielLastJson;
    }
    return data;
  }
  function apply(obj) {
    if (!obj || typeof obj !== "object") return;
    window.__azielLastJson = obj;
    Object.keys(obj).forEach(function (key) {
      if (key === "last" || key === "product" || key === "exported_at" || key === "author") return;
      const el = document.getElementById(key);
      if (!el || el.type === "file" || el.type === "password") return;
      if (el.type === "checkbox") el.checked = !!obj[key];
      else if ("value" in el) el.value = obj[key];
    });
  }
  if (imp && file) {
    imp.addEventListener("click", function () { file.click(); });
    file.addEventListener("change", function () {
      const chosen = file.files && file.files[0];
      if (!chosen) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          apply(JSON.parse(String(reader.result || "{}")));
          say("Imported " + chosen.name);
        } catch (err) {
          say("That file is not JSON. Choose another .json file.");
        }
      };
      reader.readAsText(chosen);
    });
  }
  if (expJson) {
    expJson.addEventListener("click", function () {
      const blob = new Blob([JSON.stringify(collect(), null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "session.json";
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 800);
      say("Exported JSON");
    });
  }

  refresh().catch(function () {
    if (kid) kid.textContent = "The page is open. Paste text, then choose Fold.";
  });
})();
