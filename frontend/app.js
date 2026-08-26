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

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const statusEl = document.getElementById("upload-status");
  const chooseFileBtn = document.getElementById("choose-file-btn");

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

  async function uploadFile(file) {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (ext !== ".zip" && ext !== ".apk") {
      setStatus("Only .zip or .apk files are accepted.", "error");
      return;
    }

    setStatus("Scanning " + file.name + " …", "info");

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/scan", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        setStatus(body.detail || "Scan failed.", "error");
        return;
      }
      setStatus(
        "Scan complete: " + body.findings.length + " finding(s) across " + body.files_scanned + " file(s).",
        "success"
      );
      renderFindings(body);
      showView("findings");
    } catch (err) {
      setStatus("Could not reach the scanner: " + err.message, "error");
    }
  }

  const findingsEmpty = document.getElementById("findings-empty");
  const findingsWrap = document.getElementById("findings-table-wrap");
  const findingsBody = document.getElementById("findings-tbody");
  const findingsMeta = document.getElementById("findings-meta");
  const severitySummary = document.getElementById("severity-summary");

  const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

  function renderFindings(report) {
    findingsBody.innerHTML = "";

    if (!report.findings.length) {
      findingsEmpty.style.display = "block";
      findingsEmpty.textContent = "No issues found in " + report.files_scanned + " file(s) scanned.";
      findingsWrap.style.display = "none";
      findingsMeta.textContent = "";
      severitySummary.style.display = "none";
      return;
    }

    findingsEmpty.style.display = "none";
    findingsWrap.style.display = "block";
    findingsMeta.textContent =
      report.findings.length + " finding(s) · " + report.files_scanned + " file(s) scanned" +
      (report.frameworks_detected.length ? " · " + report.frameworks_detected.join(", ") : "");

    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of report.findings) if (f.severity in counts) counts[f.severity]++;
    severitySummary.style.display = "flex";
    severitySummary.innerHTML = SEVERITY_ORDER.map((s) =>
      '<span class="severity-summary-item"><span class="dot" style="background:' + cssVar("--" + s) + '"></span>' +
      s.charAt(0).toUpperCase() + s.slice(1) + ' <span class="count">' + counts[s] + "</span></span>"
    ).join("");

    report.findings.forEach((f, i) => {
      const tr = document.createElement("tr");
      tr.dataset.index = i;
      tr.innerHTML =
        '<td><span class="tag ' + f.severity + '"><span class="dot"></span>' + f.severity + "</span></td>" +
        '<td><span class="confidence">' + f.confidence + "</span></td>" +
        '<td class="rule-cell">' + f.rule.replace(/_/g, " ") + "</td>" +
        '<td class="location">' + escapeHtml(f.file) + ":" + f.line + "</td>" +
        '<td class="description">' + escapeHtml(f.description) + "</td>" +
        '<td class="fix">' + escapeHtml(f.fix) + "</td>";
      tr.addEventListener("click", () => openDetail(f));
      findingsBody.appendChild(tr);
    });
  }

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

  const detailOverlay = document.getElementById("detail-overlay");
  const detailPanel = document.getElementById("detail-panel");
  const detailClose = document.getElementById("detail-close");
  const detailSeverityTag = document.getElementById("detail-severity-tag");
  const detailTitle = document.getElementById("detail-title");
  const detailLocation = document.getElementById("detail-location");
  const detailWhy = document.getElementById("detail-why");
  const detailFix = document.getElementById("detail-fix");
  const detailConfidence = document.getElementById("detail-confidence");

  function openDetail(f) {
    detailSeverityTag.className = "tag " + f.severity;
    detailSeverityTag.innerHTML = '<span class="dot"></span>' + f.severity;
    detailTitle.textContent = f.description;
    detailLocation.textContent = f.file + ":" + f.line;
    detailWhy.textContent = WHY_IT_MATTERS[f.rule] || "This pattern was flagged based on how the code path is structured; review it in context before dismissing or fixing it.";
    detailFix.textContent = f.fix;
    detailConfidence.textContent =
      f.confidence.charAt(0).toUpperCase() + f.confidence.slice(1) +
      " confidence — " + (f.rule || "").replace(/_/g, " ");
    detailOverlay.classList.add("open");
    detailPanel.classList.add("open");
  }

  function closeDetail() {
    detailOverlay.classList.remove("open");
    detailPanel.classList.remove("open");
  }

  detailClose.addEventListener("click", closeDetail);
  detailOverlay.addEventListener("click", closeDetail);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDetail();
  });

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  const metricsContent = document.getElementById("metrics-content");
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

  function pct(x) {
    return (x * 100).toFixed(1) + "%";
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function metricHeroRowHtml(o) {
    const items = [
      { label: "Precision", value: o.precision },
      { label: "Recall", value: o.recall },
      { label: "F1 score", value: o.f1 },
    ];
    let html = '<div class="metric-hero-row">';
    for (const it of items) {
      html += '<div class="metric-hero">' +
        '<div class="metric-hero-value">' + pct(it.value) + "</div>" +
        '<div class="metric-hero-bar"><div class="metric-hero-bar-fill" style="width:' + (it.value * 100) + '%"></div></div>' +
        '<div class="metric-hero-label">' + it.label + "</div></div>";
    }
    html += "</div>";
    return html;
  }

  function severityBarsHtml(bySeverity) {
    const order = ["critical", "high", "medium", "low"];
    const colors = { critical: cssVar("--critical"), high: cssVar("--high"), medium: cssVar("--medium"), low: cssVar("--low") };
    const values = order.map((k) => bySeverity[k] || 0);
    const max = Math.max(1, ...values);

    let html = '<div class="severity-bars">';
    for (const key of order) {
      const v = bySeverity[key] || 0;
      const widthPct = v === 0 ? 0 : Math.max(3, (v / max) * 100);
      html += '<div class="severity-bar-row">' +
        '<span class="severity-bar-label">' + key.charAt(0).toUpperCase() + key.slice(1) + "</span>" +
        '<span class="severity-bar-track"><span class="severity-bar-fill" style="width:' + widthPct + "%;background:" + colors[key] + '"></span></span>' +
        '<span class="severity-bar-count">' + v + "</span></div>";
    }
    html += "</div>";
    return html;
  }

  function ruleTableHtml(perRule) {
    let html = '<table class="rule-table"><thead><tr>' +
      "<th>Rule</th><th>TP</th><th>FP</th><th>FN</th><th>Precision</th><th>Recall</th>" +
      "</tr></thead><tbody>";
    for (const r of perRule) {
      const imperfect = r.fp > 0 || r.fn > 0;
      html += '<tr class="' + (imperfect ? "imperfect" : "") + '">' +
        '<td class="rule-cell">' + r.rule.replace(/_/g, " ") + "</td>" +
        "<td>" + r.tp + "</td>" +
        "<td>" + r.fp + "</td>" +
        "<td>" + r.fn + "</td>" +
        '<td><span class="perf-cell"><span class="perf-dot' + (imperfect ? " imperfect" : "") + '"></span>' + pct(r.precision) + "</span></td>" +
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

    let html = "";

    html += '<div class="metrics-scope">Held-out evaluation set &middot; ' + data.fixture_count + " fixtures</div>";

    html += '<div class="metrics-section">' + metricHeroRowHtml(o) + "</div>";

    html += '<div class="metrics-section"><div class="section-title">Findings by severity</div>' +
      severityBarsHtml(data.findings_by_severity || {}) + "</div>";

    html += '<div class="metrics-section"><div class="section-title">Per-rule breakdown</div>' +
      ruleTableHtml(data.per_rule) + "</div>";

    html += '<div class="metrics-section"><div class="section-title">Evaluation methodology</div>' +
      '<div class="methodology-box"><p>Results are calculated against a held-out fixture set that was not used ' +
      "to tune the detection rules. This distinction matters: a scanner tuned against its own test cases can look " +
      "far more accurate than it actually is on code it has never seen.</p>" +
      '<div class="fact-list">' +
      factItem(data.fixture_count, "Fixtures") +
      factItem(totalTp, "True positives") +
      factItem(totalFp, "False positives") +
      factItem(totalFn, "False negatives") +
      "</div></div></div>";

    html += '<div class="metrics-section cost-block">' +
      '<div class="cost-label">Illustrative cost model &middot; estimate, not a measured result</div>' +
      '<div class="cost-value">$' + Math.round(data.cost.net_savings_usd).toLocaleString() + "</div>" +
      '<div class="cost-caption">Estimated avoided review and exposure cost versus catching nothing, under the assumptions below.</div>' +
      '<div class="cost-assumptions">' +
      "$" + data.cost.false_positive_cost_usd + " assumed per false positive (developer time to triage and dismiss it) &middot; " +
      "$" + data.cost.false_negative_cost_usd + " assumed per false negative (downstream fraud exposure from an unnoticed bug). " +
      "Both figures are stated assumptions, not measured business results." +
      "</div></div>";

    metricsContent.innerHTML = html;
  }

  function factItem(value, label) {
    return '<div class="fact-item"><div class="fact-value">' + value + '</div><div class="fact-label">' + label + "</div></div>";
  }

  const themeToggle = document.getElementById("theme-toggle");
  const themeToggleLabel = document.getElementById("theme-toggle-label");

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function applyThemeLabel() {
    themeToggleLabel.textContent = currentTheme() === "dark" ? "Light mode" : "Dark mode";
  }

  function setTheme(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    document.cookie = "theme=" + theme + "; path=/; max-age=31536000; samesite=lax";
    applyThemeLabel();
    if (metricsLoaded) {
      metricsLoaded = false;
      loadMetrics();
    }
  }

  themeToggle.addEventListener("click", () => setTheme(currentTheme() === "dark" ? "light" : "dark"));
  applyThemeLabel();
})();
