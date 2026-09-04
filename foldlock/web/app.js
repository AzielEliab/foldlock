/* FoldLock UI. No CDN. No telemetry. Zip-class compression engine. */
(function () {
  const kid = document.getElementById("kid-plain");
  const verifyLine = document.getElementById("verify-line");
  const rowsPre = document.getElementById("rows-pre");
  const advancedPanel = document.getElementById("advanced-panel");
  const viewSimple = document.getElementById("view-simple");
  const viewAdvanced = document.getElementById("view-advanced");
  const openText = document.getElementById("open-text");
  const openFld = document.getElementById("open-fld");
  const plain = document.getElementById("plain");

  let advanced = false;
  document.body.classList.add("simple");

  function setView(next) {
    advanced = next;
    document.body.classList.toggle("simple", !advanced);
    viewSimple.classList.toggle("on", !advanced);
    viewAdvanced.classList.toggle("on", advanced);
    viewSimple.setAttribute("aria-pressed", String(!advanced));
    viewAdvanced.setAttribute("aria-pressed", String(advanced));
    advancedPanel.hidden = !advanced;
  }

  function paint(state) {
    const r = (state && state.receipt) || {};
    const v = (state && state.verify) || {};
    document.getElementById("c-hits").textContent = r.tether_hits != null ? r.tether_hits : (state.tether_hits || 0);
    document.getElementById("c-orig").textContent = state.orig_size || 0;
    document.getElementById("c-folded").textContent = state.folded_size || 0;
    document.getElementById("c-zip").textContent = "False";
    const ratio = r.ratio != null ? r.ratio : state.ratio;
    document.getElementById("c-ratio").textContent = typeof ratio === "number" ? ratio.toFixed(3) : "—";
    const ok = v.ok === true || (state.unfold && state.unfold.verified === true);
    document.getElementById("c-ok").textContent = v.ok == null && !(state.unfold) ? "—" : (ok ? "True" : "False");
    const strat = r.strategy || state.method || "—";
    const stratEl = document.getElementById("c-strat");
    if (stratEl) stratEl.textContent = strat;
    if (state.sample_text != null) plain.value = state.sample_text;
    if (state.error) {
      kid.textContent = "Could not fold or unfold. " + state.error + " This is a compression engine, not the ZIP format.";
    } else if (ok) {
      kid.textContent = "Hashes match. The words went back. zip is False. Strategy is " + strat + ".";
    } else {
      kid.textContent = "Type a sentence. Tap Fold. Tap Verify to check the hash. Short notes stay the same size. This is a compression engine, not the ZIP format.";
    }
    const sha = state.orig_sha256 || "";
    verifyLine.textContent = sha
      ? ("orig_sha256=" + sha + "  hits=" + (r.tether_hits || 0) + "  zip=False  strategy=" + strat)
      : "";
    rowsPre.textContent = JSON.stringify(state, null, 2);
  }

  function post(url, body) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    }).then(function (res) {
      return res.json().then(function (j) {
        if (!res.ok) throw new Error(j.error || ("HTTP " + res.status));
        return j;
      });
    });
  }

  function refresh() {
    return fetch("/api/state").then(function (r) { return r.json(); }).then(paint);
  }

  viewSimple.addEventListener("click", function () { setView(false); });
  viewAdvanced.addEventListener("click", function () { setView(true); });

  document.getElementById("btn-fold").addEventListener("click", function () {
    const text = plain.value;
    if (text && text.length) {
      post("/api/text", { text: text, name: "typed.txt" }).then(paint).catch(function (err) {
        kid.textContent = String(err.message || err);
      });
      return;
    }
    openText.click();
  });

  document.getElementById("btn-unfold").addEventListener("click", function () {
    openFld.click();
  });

  document.getElementById("btn-verify").addEventListener("click", function () {
    post("/api/verify", {}).then(paint).catch(function (err) {
      kid.textContent = String(err.message || err);
    });
  });

  openText.addEventListener("change", function () {
    const file = openText.files && openText.files[0];
    if (!file) return;
    file.arrayBuffer().then(function (buf) {
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);
      return post("/api/fold", { name: file.name, b64: b64 });
    }).then(paint).catch(function (err) {
      kid.textContent = String(err.message || err);
    });
    openText.value = "";
  });

  openFld.addEventListener("change", function () {
    const file = openFld.files && openFld.files[0];
    if (!file) return;
    file.arrayBuffer().then(function (buf) {
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return post("/api/unfold", { name: file.name, b64: btoa(binary) });
    }).then(paint).catch(function (err) {
      kid.textContent = String(err.message || err);
    });
    openFld.value = "";
  });

  const sample = document.getElementById("btn-sample");
  if (sample) sample.addEventListener("click", function () {
    post("/api/sample", {}).then(paint);
  });
  const info = document.getElementById("btn-info");
  if (info) info.addEventListener("click", function () {
    post("/api/info", {}).then(paint);
  });
  const exp = document.getElementById("btn-export");
  if (exp) exp.addEventListener("click", function () {
    post("/api/export", {}).then(function (j) {
      const blob = new Blob([JSON.stringify(j.receipt, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = j.filename || "foldlock-receipt.json";
      a.click();
      paint(j.receipt);
    });
  });
  const doc = document.getElementById("btn-doctor");
  if (doc) doc.addEventListener("click", function () {
    post("/api/doctor", {}).then(function (j) {
      kid.textContent = j.ok ? "Doctor passed. Compression engine. zip is False. No network." : "Doctor failed. See Advanced.";
      rowsPre.textContent = JSON.stringify(j, null, 2);
    });
  });
  const dlFld = document.getElementById("btn-dl-fld");
  if (dlFld) dlFld.addEventListener("click", function () { window.location = "/api/download.fld"; });
  const dlTxt = document.getElementById("btn-dl-txt");
  if (dlTxt) dlTxt.addEventListener("click", function () { window.location = "/api/download.txt"; });

  refresh().catch(function () {
    kid.textContent = "UI loaded. Type a sentence and tap Fold.";
  });
})();
