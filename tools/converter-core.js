/* Menchmark Firebase rebuild — Step 3 converter core.
 * Design record: docs/Firebase_Step3_Converter_Tool_Design_Proposal.md
 *
 * Shared by tools/admin-convert.html (superadmin: bulk, provisioning,
 * backup-upload for any rebbi) and app.html's own tier-1 Settings mount
 * (self-serve, own-account only). One core, two thin surfaces — no build
 * step, plain <script src>, attaches to window.ConverterCore.
 *
 * Normalization is never re-implemented here: this module never parses or
 * transforms a backup blob's fields itself. It always routes through
 * app.html's own migrateData()/load2fix() via window.__exportNormalized —
 * directly, when this script runs inside app.html itself, or through a
 * hidden same-origin iframe + postMessage when it runs from a separate
 * document (tools/admin-convert.html). Either path returns the exact
 * normalized shape app.html itself trusts, so the converter can never
 * silently drift from it.
 */
(function (global) {
  "use strict";

  var NORMALIZE_TIMEOUT_MS = 8000;
  var pendingNormalizeRequests = {};
  var bridgeIframe = null;
  var bridgeReady = null;

  function randomReqId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  // Lazily creates a hidden iframe pointed at app.html, used only when this
  // script is NOT already running inside app.html (i.e. window.__exportNormalized
  // is absent). Reused across calls rather than recreated each time.
  function ensureBridgeIframe(appHtmlUrl) {
    if (bridgeReady) return bridgeReady;
    bridgeReady = new Promise(function (resolve, reject) {
      var frame = document.createElement("iframe");
      frame.style.display = "none";
      frame.setAttribute("aria-hidden", "true");
      var settled = false;
      frame.onload = function () {
        if (settled) return;
        settled = true;
        bridgeIframe = frame;
        resolve(frame);
      };
      frame.onerror = function () {
        if (settled) return;
        settled = true;
        reject(new Error("Could not load the normalization bridge (" + appHtmlUrl + ")."));
      };
      frame.src = appHtmlUrl;
      document.body.appendChild(frame);
    });
    return bridgeReady;
  }

  global.addEventListener("message", function (ev) {
    if (!ev.data || ev.data.type !== "menchmark:normalized") return;
    var pending = pendingNormalizeRequests[ev.data.reqId];
    if (!pending) return;
    delete pendingNormalizeRequests[ev.data.reqId];
    clearTimeout(pending.timer);
    if (ev.data.ok) pending.resolve(ev.data.data);
    else pending.reject(new Error(ev.data.error || "Normalization failed."));
  });

  /**
   * Runs a raw backup blob (parsed JSON, pre-migrateData/load2fix) through
   * app.html's own normalization and returns the result app.html itself
   * would trust — same shape, same one-shot backfills, same everything.
   *
   * @param {object} rawData - a parsed backup JSON object (data.students,
   *   data.trackedItems, etc. — whatever shape it was exported in).
   * @param {object} [opts]
   * @param {string} [opts.appHtmlUrl] - only used when this script is NOT
   *   already inside app.html (i.e. from tools/admin-convert.html).
   *   Defaults to "/app.html".
   * @returns {Promise<object>} the normalized data blob.
   */
  function normalizeBackup(rawData, opts) {
    opts = opts || {};
    if (typeof global.__exportNormalized === "function") {
      // Running inside app.html itself (the Settings mount) — no iframe
      // needed, this is a same-document function call.
      try {
        return Promise.resolve(global.__exportNormalized(rawData));
      } catch (e) {
        return Promise.reject(e);
      }
    }

    var appHtmlUrl = opts.appHtmlUrl || "/app.html";
    return ensureBridgeIframe(appHtmlUrl).then(function (frame) {
      return new Promise(function (resolve, reject) {
        var reqId = randomReqId();
        var timer = setTimeout(function () {
          delete pendingNormalizeRequests[reqId];
          reject(new Error("Normalization bridge timed out — is " + appHtmlUrl + " reachable?"));
        }, NORMALIZE_TIMEOUT_MS);
        pendingNormalizeRequests[reqId] = { resolve: resolve, reject: reject, timer: timer };
        frame.contentWindow.postMessage(
          { type: "menchmark:normalize", reqId: reqId, payload: rawData },
          location.origin
        );
      });
    });
  }

  /**
   * Calls the provisionRebbi callable through the Firebase SDK (compat API
   * — matches vendor/firebase/firebase-functions-compat.js).
   *
   * @param {firebase.functions.Functions} functionsInstance
   * @param {object} payload - {mode, email?, students?, normalized?, self?,
   *   force?, asNewClass?, className?, deviceId?}
   * @returns {Promise<object>} the callable's response data.
   */
  function callProvisionRebbi(functionsInstance, payload) {
    var callable = functionsInstance.httpsCallable("provisionRebbi");
    return callable(payload).then(function (result) {
      return result.data;
    });
  }

  /**
   * Runs the same-shape roster-only or backup-upload flow for each row in
   * `rows`, sequentially (never parallel — a bad row must not stall or
   * corrupt the rest, and progress must stay observable mid-run), reporting
   * per-row status via onRowUpdate. Matches the design doc's bulk-mode
   * "client-side loop, not a server-batch-job" choice.
   *
   * @param {firebase.functions.Functions} functionsInstance
   * @param {Array<object>} rows - each row is a full provisionRebbi payload
   *   (mode:"roster"|"backup", email, ...).
   * @param {function(index:number, status:string, detail:object=)} onRowUpdate
   *   status is one of "queued" | "running" | "verified" | "mismatch" | "failed".
   * @returns {Promise<Array<object|null>>} one result (or null on failure) per row.
   */
  function runBulk(functionsInstance, rows, onRowUpdate) {
    var results = [];
    rows.forEach(function (_, i) {
      if (onRowUpdate) onRowUpdate(i, "queued");
    });
    var chain = Promise.resolve();
    rows.forEach(function (row, i) {
      chain = chain.then(function () {
        if (onRowUpdate) onRowUpdate(i, "running");
        return callProvisionRebbi(functionsInstance, row)
          .then(function (res) {
            var status = res && res.receipt && res.receipt.status === "mismatch" ? "mismatch" : "verified";
            if (onRowUpdate) onRowUpdate(i, status, res);
            results.push(res);
          })
          .catch(function (err) {
            if (onRowUpdate) onRowUpdate(i, "failed", { error: String((err && err.message) || err) });
            results.push(null);
          });
      });
    });
    return chain.then(function () {
      return results;
    });
  }

  /**
   * Renders the manual diff report described in the design doc's
   * "Manual diff report UI": one row per collection with old->new count and
   * a check/cross, plus a 5-row student sample. Returns the DOM node — the
   * caller decides where to mount it and whether to enable a
   * "Looks right, retire local copy" button (gate that on receipt.status
   * === "verified", per the design's two-independent-gates rule).
   *
   * @param {object} receipt - the `receipt` field from provisionRebbi's response.
   */
  function renderReceiptReport(receipt) {
    var wrap = document.createElement("div");
    wrap.className = "converter-receipt";
    if (!receipt) {
      wrap.textContent = "No receipt to show.";
      return wrap;
    }

    var statusLine = document.createElement("p");
    statusLine.className = "converter-receipt-status converter-receipt-status--" + receipt.status;
    statusLine.textContent =
      receipt.status === "verified" ? "✓ Verified — every count matched." : "✗ Mismatch — do not retire the local copy.";
    wrap.appendChild(statusLine);

    var table = document.createElement("table");
    table.className = "converter-receipt-table";
    var thead = document.createElement("tr");
    ["Collection", "Expected", "Actual", ""].forEach(function (h) {
      var th = document.createElement("th");
      th.textContent = h;
      thead.appendChild(th);
    });
    table.appendChild(thead);

    var expected = (receipt.counts && receipt.counts.expected) || {};
    var actual = (receipt.counts && receipt.counts.actual) || {};
    Object.keys(expected).forEach(function (key) {
      var row = document.createElement("tr");
      var ok = expected[key] === actual[key];
      [key, expected[key], actual[key], ok ? "✓" : "✗"].forEach(function (val) {
        var td = document.createElement("td");
        td.textContent = String(val);
        row.appendChild(td);
      });
      if (!ok) row.className = "converter-receipt-row--mismatch";
      table.appendChild(row);
    });
    wrap.appendChild(table);

    if (receipt.spotCheckSample && receipt.spotCheckSample.length) {
      var sampleHeading = document.createElement("p");
      sampleHeading.textContent = "Sample students (eyeball these):";
      wrap.appendChild(sampleHeading);
      var list = document.createElement("ul");
      receipt.spotCheckSample.forEach(function (s) {
        var li = document.createElement("li");
        li.textContent = (s.firstName || "") + " " + (s.lastName || "") + (s.section ? " — " + s.section : "");
        list.appendChild(li);
      });
      wrap.appendChild(list);
    }

    if (receipt.nameSplitFlags) {
      var flagNote = document.createElement("p");
      flagNote.className = "converter-receipt-flag";
      flagNote.textContent =
        receipt.nameSplitFlags +
        " student name(s) could not be split into first/last (single word) — review these manually.";
      wrap.appendChild(flagNote);
    }

    return wrap;
  }

  global.ConverterCore = {
    normalizeBackup: normalizeBackup,
    callProvisionRebbi: callProvisionRebbi,
    runBulk: runBulk,
    renderReceiptReport: renderReceiptReport,
  };
})(window);
