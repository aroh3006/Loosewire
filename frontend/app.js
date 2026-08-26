(function () {
  "use strict";

  const tabs = document.querySelectorAll("#nav-tabs .nav-item");
  const views = document.querySelectorAll(".view");

  function showView(name) {
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.view === name));
    views.forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
    if (name === "metrics") loadMetrics();
  }

  tabs.forEach((t) => t.addEventListener("click", () => showView(t.dataset.view)));

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function pct(x) {
    return (x * 100).toFixed(1) + "%";
  }

  const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

  function severityDistHtml(counts) {
    const max = Math.max(1, ...SEVERITY_ORDER.map((k) => counts[k] || 0));
    let html = "";
    for (const key of SEVERITY_ORDER) {
      const v = counts[key] || 0;
      const widthPct = v === 0 ? 0 : Math.max(4, (v / max) * 100);
      html += '<div class="severity-dist-row">' +
        '<span class="severity-dist-label">' + key + "</span>" +
        '<span class="severity-dist-track"><span class="severity-dist-fill" style="width:' + widthPct +
        "%;background:" + cssVar("--" + key) + '"></span></span>' +
        '<span class="severity-dist-count">' + v + "</span></div>";
    }
    return html;
  }

  /* ---------- scan ---------- */

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const statusEl = document.getElementById("upload-status");
  const chooseFileBtn = document.getElementById("choose-file-btn");
  const scanStagesWrap = document.getElementById("scan-stages-wrap");

  dropzone.addEventListener("click", () => fileInput.click());
  chooseFileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("drag-over");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
    if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length) uploadFile(fileInput.files[0]);
  });

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = "upload-status" + (kind ? " " + kind : "");
  }

  const SCAN_STAGES = [
    "Extracting archive",
    "Discovering source files",
    "Evaluating signatures",
    "Checking webhook handling",
    "Validating amounts",
    "Checking secret exposure",
  ];

  function renderStages(doneCount, runningIndex) {
    let html = '<div class="scan-stages">';
    SCAN_STAGES.forEach((label, i) => {
      const state = i < doneCount ? "done" : i === runningIndex ? "running" : "";
      const statusText = i < doneCount ? "Complete" : i === runningIndex ? "Running" : "—";
      html += '<div class="scan-stage ' + state + '">' +
        '<span class="scan-stage-index">' + String(i + 1).padStart(2, "0") + "</span>" +
        '<span class="scan-stage-name">' + label + "</span>" +
        '<span class="scan-stage-status">' + statusText + "</span></div>";
    });
    html += "</div>";
    scanStagesWrap.innerHTML = html;
  }

  async function uploadFile(file) {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (ext !== ".zip" && ext !== ".apk") {
      setStatus("Only .zip or .apk files are accepted.", "error");
      return;
    }

    setStatus("Scanning " + file.name, "info");

    let stageIndex = 0;
    renderStages(0, 0);
    const stageTimer = setInterval(() => {
      if (stageIndex < SCAN_STAGES.length - 1) {
        stageIndex++;
        renderStages(stageIndex, stageIndex);
      }
    }, 420);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/scan", { method: "POST", body: form });
      const body = await res.json();
      clearInterval(stageTimer);
      renderStages(SCAN_STAGES.length, -1);
      setTimeout(() => { scanStagesWrap.innerHTML = ""; }, 900);

      if (!res.ok) {
        setStatus(body.detail || "Scan failed.", "error");
        return;
      }
      setStatus(
        "Scan complete — " + body.findings.length + " finding(s) across " + body.files_scanned + " file(s).",
        "success"
      );
      renderFindings(body);
      showView("findings");
    } catch (err) {
      clearInterval(stageTimer);
      scanStagesWrap.innerHTML = "";
      setStatus("Could not reach the scanner: " + err.message, "error");
    }
  }

  /* ---------- findings ---------- */

  const findingsTitle = document.getElementById("findings-title");
  const findingsCount = document.getElementById("findings-count");
  const findingsEmpty = document.getElementById("findings-empty");
  const findingsBodyWrap = document.getElementById("findings-body");
  const findingsSeverityDist = document.getElementById("findings-severity-dist");
  const findingList = document.getElementById("finding-list");
  const findingDetailContent = document.getElementById("finding-detail-content");
  const investigation = document.getElementById("investigation");
  const findingBack = document.getElementById("finding-back");

  let currentFindings = [];
  let selectedIndex = 0;

  const WHY_IT_MATTERS = {
    missing_signature_verification:
      "Without a signature check, anyone who knows or guesses an order id can call this path directly and mark the order as paid without a real payment ever happening.",
    missing_webhook_signature:
      "A forged callback to this endpoint would be processed the same as a genuine one, letting an attacker trigger order-completion logic on demand.",
    missing_amount_validation:
      "The amount being confirmed is never checked against what the order actually cost, so a client can report a lower amount than the one that should have been charged.",
    exposed_secret_key:
      "A secret shipped to a browser or bundled into an app can be extracted by anyone who inspects the client, letting them act as the merchant against the gateway.",
  };

  function renderFindings(report) {
    currentFindings = report.findings;
    selectedIndex = 0;

    if (!report.findings.length) {
      findingsTitle.textContent = "No issues found";
      findingsCount.textContent = report.files_scanned + " file(s) scanned";
      findingsEmpty.style.display = "block";
      findingsEmpty.textContent = "No issues found in " + report.files_scanned + " file(s) scanned.";
      findingsBodyWrap.style.display = "none";
      return;
    }

    findingsTitle.textContent = report.findings.length + " finding" + (report.findings.length === 1 ? "" : "s");
    findingsCount.textContent = report.files_scanned + " file(s) scanned" +
      (report.frameworks_detected.length ? " · " + report.frameworks_detected.join(", ") : "");

    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of report.findings) if (f.severity in counts) counts[f.severity]++;
    findingsSeverityDist.innerHTML = severityDistHtml(counts);

    findingsEmpty.style.display = "none";
    findingsBodyWrap.style.display = "block";
    investigation.classList.remove("show-detail");

    renderFindingList();
    renderFindingDetail();
  }

  function renderFindingList() {
    findingList.innerHTML = currentFindings.map((f, i) =>
      '<button class="finding-row' + (i === selectedIndex ? " selected" : "") + '" data-index="' + i + '">' +
      '<div class="finding-row-top"><span class="severity-mark" style="background:' + cssVar("--" + f.severity) + '"></span>' +
      '<span class="finding-row-rule">' + f.rule.replace(/_/g, " ") + "</span></div>" +
      '<div class="finding-row-loc">' + escapeHtml(f.file) + ":" + f.line + "</div>" +
      "</button>"
    ).join("");

    findingList.querySelectorAll(".finding-row").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedIndex = parseInt(btn.dataset.index, 10);
        renderFindingList();
        renderFindingDetail();
        investigation.classList.add("show-detail");
      });
    });
  }

  function renderFindingDetail() {
    const f = currentFindings[selectedIndex];
    if (!f) return;

    findingDetailContent.innerHTML =
      '<div class="detail-severity-row"><span class="severity-tag ' + f.severity + '">' + f.severity + "</span>" +
      '<span class="confidence-note">' + f.confidence + " confidence</span></div>" +
      '<div class="detail-title">' + escapeHtml(f.description) + "</div>" +
      '<div class="code-ref"><div class="code-ref-path">' + escapeHtml(f.file) + '</div>' +
      '<div class="code-ref-body"><div class="code-ref-gutter">' + f.line + '</div>' +
      '<div class="code-ref-line">' + escapeHtml(f.rule.replace(/_/g, " ")) + " flagged at this line</div></div></div>" +
      '<div class="detail-block"><div class="detail-block-label">Why it matters</div>' +
      '<div class="detail-block-body">' + (WHY_IT_MATTERS[f.rule] ||
        "This pattern was flagged based on how the code path is structured; review it in context before dismissing or fixing it.") +
      "</div></div>" +
      '<div class="detail-block"><div class="detail-block-label">Recommended fix</div>' +
      '<div class="detail-fix">' + escapeHtml(f.fix) + "</div></div>";
  }

  findingBack.addEventListener("click", () => investigation.classList.remove("show-detail"));

  /* ---------- metrics ---------- */

  const metricsContent = document.getElementById("metrics-content");
  const metricsScope = document.getElementById("metrics-scope");
  let metricsLoaded = false;

  async function loadMetrics() {
    if (metricsLoaded) return;
    metricsContent.innerHTML = '<p class="muted">Loading…</p>';
    try {
      const res = await fetch("/api/metrics");
      const data = await res.json();
      if (!res.ok) {
        metricsContent.innerHTML = '<p class="muted">' + escapeHtml(data.detail || "Metrics unavailable.") + "</p>";
        return;
      }
      renderMetrics(data);
      metricsLoaded = true;
    } catch (err) {
      metricsContent.innerHTML = '<p class="muted">Could not load metrics: ' + escapeHtml(err.message) + "</p>";
    }
  }

  function perfScaleRowsHtml(o) {
    const items = [
      { label: "Precision", value: o.precision },
      { label: "Recall", value: o.recall },
      { label: "F1", value: o.f1 },
    ];
    let html = '<div class="perf-scale-rows">';
    for (const it of items) {
      html += '<div class="perf-scale-row">' +
        '<span class="perf-scale-label">' + it.label + "</span>" +
        '<span class="perf-scale-value tabular">' + pct(it.value) + "</span>" +
        '<span class="perf-scale-track"><span class="perf-scale-fill" style="width:' + (it.value * 100) + '%"></span>' +
        '<span class="perf-scale-dot" style="left:' + (it.value * 100) + '%"></span></span>' +
        "</div>";
    }
    html += "</div>";
    return html;
  }

  function profilePlotHtml(o) {
    const items = [
      { label: "Precision", value: o.precision, color: cssVar("--info") },
      { label: "Recall", value: o.recall, color: cssVar("--positive") },
      { label: "F1", value: o.f1, color: cssVar("--text") },
    ];

    // Assign each label a vertical tier so labels for close-together values
    // (F1 always sits between precision and recall) don't collide. Sorting
    // by value and alternating tiers guarantees neighbors never share one,
    // with no risk of the assignment never settling.
    const sorted = items.map((it, i) => ({ ...it, i })).sort((a, b) => a.value - b.value);
    sorted.forEach((it, rank) => {
      items[it.i].tier = rank % 2;
    });

    let nodes = "";
    let labels = "";
    for (const it of items) {
      const leftPct = it.value * 100;
      const labelTop = it.tier * 32;
      const connectorHeight = 10 + it.tier * 32;
      nodes += '<span class="profile-node" style="left:' + leftPct + "%;background:" + it.color + '"></span>' +
        '<span class="profile-connector" style="left:' + leftPct + "%;height:" + connectorHeight + "px;background:" + it.color + '"></span>';
      labels += '<span class="profile-label" style="left:' + leftPct + "%;top:" + labelTop + 'px">' + it.label +
        '<span class="val">' + pct(it.value) + "</span></span>";
    }
    return '<div class="profile-plot">' +
      '<div class="profile-axis-line">' + nodes + "</div>" +
      '<div class="profile-labels">' + labels + "</div>" +
      '<div class="profile-scale-caption"><span>0%</span><span>100%</span></div>' +
      "</div>";
  }

  function ruleMatrixHtml(perRule) {
    let html = '<table class="rule-matrix"><thead><tr>' +
      "<th>Rule</th><th>TP</th><th>FP</th><th>FN</th><th>Precision</th><th>Recall</th>" +
      "</tr></thead><tbody>";
    for (const r of perRule) {
      const imperfect = r.fp > 0 || r.fn > 0;
      html += '<tr class="' + (imperfect ? "imperfect" : "") + '">' +
        '<td class="rule-cell">' + r.rule.replace(/_/g, " ") + "</td>" +
        "<td>" + r.tp + "</td>" +
        "<td>" + r.fp + "</td>" +
        "<td>" + r.fn + "</td>" +
        "<td>" + pct(r.precision) + "</td>" +
        "<td>" + pct(r.recall) + "</td>" +
        "</tr>";
    }
    html += "</tbody></table>";
    return html;
  }

  function renderMetrics(data) {
    const o = data.overall;
    const totalTp = data.per_rule.reduce((a, r) => a + r.tp, 0);
    const totalFp = data.per_rule.reduce((a, r) => a + r.fp, 0);
    const totalFn = data.per_rule.reduce((a, r) => a + r.fn, 0);

    metricsScope.textContent = "Held-out evaluation · " + data.fixture_count + " fixtures";

    let html = "";

    html += '<div class="metrics-section">' + perfScaleRowsHtml(o) + "</div>";

    html += '<hr class="rule"><div class="metrics-section"><div class="section-label">Detection profile</div>' +
      profilePlotHtml(o) + "</div>";

    html += '<hr class="rule"><div class="metrics-section"><div class="section-label">Finding distribution</div>' +
      '<div class="severity-dist">' + severityDistHtml(data.findings_by_severity || {}) + "</div></div>";

    html += '<hr class="rule"><div class="metrics-section"><div class="section-label">Rule performance</div>' +
      ruleMatrixHtml(data.per_rule) + "</div>";

    html += '<hr class="rule"><div class="metrics-section"><div class="section-label">Evaluation methodology</div>' +
      '<div class="methodology-row"><p class="methodology-text">Results are calculated against a held-out fixture ' +
      "set that was not used to tune the detection rules. This distinction matters: a scanner tuned against its own " +
      "test cases can look far more accurate than it actually is on code it has never seen.</p>" +
      '<div class="fact-column">' +
      factRow(data.fixture_count, "Fixtures") +
      factRow(totalTp, "True positives") +
      factRow(totalFp, "False positives") +
      factRow(totalFn, "False negatives") +
      "</div></div></div>";

    html += '<hr class="rule"><div class="metrics-section"><div class="section-label">Estimated cost model</div>' +
      '<div class="cost-row"><div class="cost-value tabular">$' + Math.round(data.cost.net_savings_usd).toLocaleString() + "</div>" +
      '<div class="cost-caption">estimated avoided review and exposure cost versus catching nothing</div></div>' +
      '<div class="cost-assumptions">' +
      "$" + data.cost.false_positive_cost_usd + " assumed per false positive (developer time to triage and dismiss it) · " +
      "$" + data.cost.false_negative_cost_usd + " assumed per false negative (downstream fraud exposure from an unnoticed bug). " +
      "Both figures are stated assumptions, not measured business results." +
      "</div></div>";

    metricsContent.innerHTML = html;
  }

  function factRow(value, label) {
    return '<div class="fact-row"><span class="n tabular">' + value + '</span><span class="l">' + label + "</span></div>";
  }

})();
