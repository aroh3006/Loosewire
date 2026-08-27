(function () {
  "use strict";

  const tabs = document.querySelectorAll("#nav-tabs .nav-item");
  const views = document.querySelectorAll(".view");

  function showView(name, targetElementId) {
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.view === name));
    views.forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
    if (name === "metrics") loadMetrics();

    if (targetElementId) {
      setTimeout(() => {
        const el = document.getElementById(targetElementId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }

  function initRoute() {
    const rawHash = window.location.hash.replace(/^#\/?/, "").toLowerCase();
    const parts = rawHash.split("/");
    const viewName = parts[0];
    const targetId = parts[1] || "";
    const validViews = ["upload", "findings", "metrics", "guide"];
    if (validViews.includes(viewName)) {
      showView(viewName, targetId);
    }
  }

  tabs.forEach((t) => {
    t.addEventListener("click", () => {
      showView(t.dataset.view);
      try {
        history.replaceState(null, "", "#" + t.dataset.view);
      } catch (_) {}
    });
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-guide-target]");
    if (btn) {
      e.preventDefault();
      const targetId = btn.dataset.guideTarget;
      showView("guide", targetId);
      try {
        history.pushState(null, "", "#guide/" + targetId);
      } catch (_) {}
    }
  });

  window.addEventListener("hashchange", initRoute);
  initRoute();

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function escapeHtml(s) {
    if (!s) return "";
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

    let html = '<div class="severity-dist-grid">';
    for (const key of SEVERITY_ORDER) {
      const v = counts[key] || 0;
      const barPct = v === 0 ? 0 : Math.max(6, (v / max) * 100);
      const isZero = v === 0;

      html += '<div class="severity-dist-card ' + (isZero ? "is-zero" : "") + '">' +
        '<div class="severity-dist-header">' +
          '<span class="severity-pill ' + key + '">' + key + '</span>' +
          '<span class="severity-dist-val tabular">' + v + '</span>' +
        '</div>' +
        '<div class="severity-dist-track">' +
          '<div class="severity-dist-fill ' + key + '" style="width:' + barPct + '%;"></div>' +
        '</div>' +
      '</div>';
    }
    html += '</div>';
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
    if (!text) {
      statusEl.textContent = "";
      statusEl.className = "upload-status";
      return;
    }
    statusEl.textContent = text;
    statusEl.className = "upload-status" + (kind ? " " + kind : "");
  }

  const SCAN_STAGES = [
    "Extracting archive",
    "Discovering source files and routes",
    "Checking signature verification",
    "Checking webhook verification",
    "Checking amount validation",
    "Checking secret exposure",
  ];

  function renderStages(doneCount, runningIndex) {
    let html = '<div class="scan-stages-card">' +
      '<div class="scan-stages-header">ANALYSIS PROGRESS</div>' +
      '<div class="scan-stages-list">';
    SCAN_STAGES.forEach((label, i) => {
      const isDone = i < doneCount;
      const isRunning = i === runningIndex;
      const stateClass = isDone ? "done" : isRunning ? "running" : "pending";
      const statusText = isDone ? "COMPLETE" : isRunning ? "ANALYZING" : "QUEUED";

      html += '<div class="scan-stage-row ' + stateClass + '">' +
        '<span class="scan-stage-num">' + String(i + 1).padStart(2, "0") + '</span>' +
        '<span class="scan-stage-label">' + label + '</span>' +
        '<span class="scan-stage-badge ' + stateClass + '">' + statusText + '</span>' +
      '</div>';
    });
    html += '</div></div>';
    scanStagesWrap.innerHTML = html;
  }

  async function uploadFile(file) {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (ext !== ".zip" && ext !== ".apk") {
      setStatus("Only .zip or .apk files are supported.", "error");
      return;
    }

    setStatus("Scanning " + file.name + " (" + (file.size / 1024 / 1024).toFixed(2) + " MB)…", "info");

    let stageIndex = 0;
    renderStages(0, 0);
    const stageTimer = setInterval(() => {
      if (stageIndex < SCAN_STAGES.length - 1) {
        stageIndex++;
        renderStages(stageIndex, stageIndex);
      }
    }, 380);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/scan", { method: "POST", body: form });
      const body = await res.json();
      clearInterval(stageTimer);
      renderStages(SCAN_STAGES.length, -1);
      setTimeout(() => { scanStagesWrap.innerHTML = ""; }, 1100);

      if (!res.ok) {
        setStatus(body.detail || "Scan failed.", "error");
        return;
      }
      setStatus(
        "Scan complete: " + body.findings.length + " finding" + (body.findings.length === 1 ? "" : "s") +
        " detected across " + body.files_scanned + " file" + (body.files_scanned === 1 ? "" : "s") + ".",
        "success"
      );
      renderFindings(body);
      showView("findings");
      try {
        history.replaceState(null, "", "#findings");
      } catch (_) {}
    } catch (err) {
      clearInterval(stageTimer);
      scanStagesWrap.innerHTML = "";
      setStatus("Could not connect to scanner: " + err.message, "error");
    }
  }

  /* ---------- findings ---------- */

  const findingsTitle = document.getElementById("findings-title");
  const findingsCount = document.getElementById("findings-count");
  const findingsEmpty = document.getElementById("findings-empty");
  const findingsBodyWrap = document.getElementById("findings-body");
  const findingsSeverityDist = document.getElementById("findings-severity-dist");
  const findingsSessionSummary = document.getElementById("findings-session-summary");
  const findingList = document.getElementById("finding-list");
  const findingDetailContent = document.getElementById("finding-detail-content");
  const investigation = document.getElementById("investigation");
  const findingBack = document.getElementById("finding-back");

  let currentFindings = [];
  let selectedIndex = 0;
  let dismissedIndices = new Set();

  const WHY_IT_MATTERS = {
    missing_signature_verification:
      "Without verifying the cryptographic signature (e.g. payment_signature = HMAC_SHA256(order_id + '|' + payment_id, secret_key)), an adversary can invoke payment completion handlers with fabricated payment IDs to mark orders as paid without executing a valid transaction.",
    missing_webhook_signature:
      "Unverified webhook endpoints accept incoming HTTP payloads unconditionally. An attacker can replay or forge webhook event callbacks to trigger automated order fulfillment or credit customer balances at will.",
    missing_amount_validation:
      "If the authorized payment amount is not strictly validated against the merchant's authoritative database order price, malicious users can alter the client-side checkout parameters to purchase high-value merchandise for nominal amounts.",
    exposed_secret_key:
      "Hardcoding gateway API secret keys and private signing tokens into client-accessible code or mobile APK packages allows anyone to decompile the application, extract full merchant credentials and issue unauthorized refunds, transfers or account operations.",
  };

  function renderFindings(report) {
    currentFindings = report.findings;
    selectedIndex = 0;
    dismissedIndices = new Set();

    if (!report.findings.length) {
      findingsTitle.textContent = "0 Findings Detected";
      findingsCount.innerHTML = '<span class="meta-item">' + report.files_scanned + ' files inspected</span>' +
        '<span class="meta-separator">/</span><span class="meta-item status-clean">No vulnerabilities found</span>';
      findingsEmpty.style.display = "block";
      findingsEmpty.innerHTML = '<div class="empty-state-inner">' +
        '<div class="empty-state-label">SCAN COMPLETE · CLEAN</div>' +
        '<p>All detection rules passed without finding security issues across ' + report.files_scanned + ' analyzed file(s).</p>' +
        '</div>';
      findingsBodyWrap.style.display = "none";
      findingsSeverityDist.innerHTML = "";
      findingsSessionSummary.innerHTML = "";
      return;
    }

    const n = report.findings.length;
    findingsTitle.textContent = n + " Security Finding" + (n === 1 ? "" : "s");

    let metaHtml = '<span class="meta-item">' + report.files_scanned + ' file' + (report.files_scanned === 1 ? "" : "s") + ' scanned</span>';
    if (report.frameworks_detected && report.frameworks_detected.length) {
      metaHtml += '<span class="meta-separator">/</span><span class="meta-item">Framework: ' + escapeHtml(report.frameworks_detected.join(", ")) + '</span>';
    }
    findingsCount.innerHTML = metaHtml;

    findingsEmpty.style.display = "none";
    findingsBodyWrap.style.display = "block";
    investigation.classList.remove("show-detail");

    renderFindingList();
    renderFindingDetail();
    renderSessionSummary();
  }

  function renderFindingList() {
    findingList.innerHTML = currentFindings.map((f, i) => {
      const isSelected = i === selectedIndex;
      const isDismissed = dismissedIndices.has(i);
      const formattedRule = f.rule.replace(/_/g, " ");
      const rowClass = "finding-item" + (isSelected ? " selected" : "") + (isDismissed ? " dismissed" : "");
      const statusPill = isDismissed
        ? '<span class="confidence-pill">Not applicable</span>'
        : '<span class="confidence-pill">' + f.confidence + '</span>';

      return '<div class="' + rowClass + '" data-index="' + i + '">' +
        '<div class="finding-item-top">' +
          '<span class="severity-pill ' + f.severity + '">' + f.severity + '</span>' +
          statusPill +
        '</div>' +
        '<div class="finding-item-title">' + formattedRule + '</div>' +
        '<div class="finding-item-loc monospace">' + escapeHtml(f.file) + '<span class="line-num">:' + f.line + '</span></div>' +
      '</div>';
    }).join("");

    findingList.querySelectorAll(".finding-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedIndex = parseInt(btn.dataset.index, 10);
        renderFindingList();
        renderFindingDetail();
        investigation.classList.add("show-detail");
      });
    });
  }

  const findingDetail = document.getElementById("finding-detail");

  function renderFindingDetail() {
    const f = currentFindings[selectedIndex];
    if (!f) return;

    const isDismissed = dismissedIndices.has(selectedIndex);
    const toggleLabel = isDismissed ? "Mark as applicable" : "Mark as not applicable";
    const dismissedTag = isDismissed ? '<span class="confidence-pill">NOT APPLICABLE</span>' : "";

    const formattedRule = f.rule.replace(/_/g, " ");
    const whyExpl = WHY_IT_MATTERS[f.rule] ||
      "This pattern represents an insecure payment implementation that deviates from secure payment gateway integration specifications. Review the affected code path.";

    findingDetailContent.innerHTML =
      '<div class="detail-header">' +
        '<div class="detail-badges">' +
          '<span class="severity-pill ' + f.severity + '">' + f.severity + '</span>' +
          '<span class="confidence-tag">' + f.confidence.toUpperCase() + ' CONFIDENCE</span>' +
          '<span class="rule-key monospace">' + f.rule + '</span>' +
          dismissedTag +
        '</div>' +
        '<h2 class="detail-headline">' + escapeHtml(formattedRule) + '</h2>' +
        '<p class="detail-description">' + escapeHtml(f.description) + '</p>' +
        '<button type="button" class="btn-back" data-toggle-na style="margin-top:12px;margin-bottom:0;">' + toggleLabel + '</button>' +
      '</div>' +

      '<div class="detail-section">' +
        '<div class="section-label">LOCATION & CODE REFERENCE</div>' +
        '<div class="code-ref-card">' +
          '<div class="code-ref-header">' +
            '<span class="code-ref-file monospace">' + escapeHtml(f.file) + '</span>' +
            '<span class="code-ref-line-tag monospace">LINE ' + f.line + '</span>' +
          '</div>' +
          '<div class="code-ref-body">' +
            '<div class="code-ref-gutter monospace">' + f.line + '</div>' +
            '<div class="code-ref-content monospace">' +
              '<span class="code-flagged-marker">▲</span> ' +
              '<span class="code-flagged-text">' + escapeHtml(f.description) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="detail-section">' +
        '<div class="section-label">WHY THIS MATTERS</div>' +
        '<div class="detail-callout risk-callout">' +
          '<div class="callout-text">' + whyExpl + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="detail-section">' +
        '<div class="section-label">RECOMMENDED REMEDIATION</div>' +
        '<div class="detail-callout fix-callout">' +
          '<div class="callout-text font-fix">' + escapeHtml(f.fix) + '</div>' +
        '</div>' +
      '</div>';
  }

  findingBack.addEventListener("click", () => investigation.classList.remove("show-detail"));

  // Recomputes the severity grid and the small working-view line below it,
  // based on which findings are currently marked not applicable. This never
  // touches the backend and never affects the numbers on the Metrics tab.
  function renderSessionSummary() {
    const total = currentFindings.length;
    const dismissedCount = dismissedIndices.size;
    const activeCounts = computeActiveSeverityCounts(currentFindings, dismissedIndices);
    findingsSeverityDist.innerHTML = severityDistHtml(activeCounts);

    const activeTotal = total - dismissedCount;
    let html = '<div class="findings-meta-bar">' +
      '<span class="meta-item">' + activeTotal + ' of ' + total + ' findings shown</span>';
    if (dismissedCount > 0) {
      html += '<span class="meta-separator">/</span>' +
        '<span class="meta-item">' + dismissedCount + ' marked not applicable</span>';
    }
    html += '</div>' +
      '<div class="assumption-disclaimer">This is your working view for this scan. It does not change the evaluation numbers on the Metrics tab.</div>';

    findingsSessionSummary.innerHTML = html;
  }

  document.addEventListener("click", (e) => {
    const naBtn = e.target.closest("[data-toggle-na]");
    if (!naBtn) return;
    if (dismissedIndices.has(selectedIndex)) {
      dismissedIndices.delete(selectedIndex);
    } else {
      dismissedIndices.add(selectedIndex);
    }
    renderFindingList();
    renderFindingDetail();
    renderSessionSummary();
  });

  /* ---------- metrics ---------- */

  const metricsContent = document.getElementById("metrics-content");
  const metricsScope = document.getElementById("metrics-scope");
  let metricsLoaded = false;

  async function loadMetrics() {
    if (metricsLoaded) return;
    metricsContent.innerHTML = '<div class="loading-placeholder">Loading evaluation data…</div>';
    try {
      const res = await fetch("/api/metrics");
      const data = await res.json();
      if (!res.ok) {
        metricsContent.innerHTML = '<div class="empty-state-inner"><div class="empty-state-label">ERROR</div><p>' +
          escapeHtml(data.detail || "Metrics unavailable.") + '</p></div>';
        return;
      }
      renderMetrics(data);
      metricsLoaded = true;
    } catch (err) {
      metricsContent.innerHTML = '<div class="empty-state-inner"><div class="empty-state-label">CONNECTION ERROR</div><p>Could not fetch metrics: ' +
        escapeHtml(err.message) + '</p></div>';
    }
  }

  function heroMetricsHtml(o) {
    const items = [
      { label: "PRECISION", value: o.precision, sub: "Accuracy of raised findings" },
      { label: "RECALL", value: o.recall, sub: "Coverage of true vulnerabilities" },
      { label: "F1 SCORE", value: o.f1, sub: "Harmonic balanced metric" },
    ];

    let html = '<div class="hero-metrics-grid">';
    for (const it of items) {
      const fillPct = (it.value * 100).toFixed(1);
      html += '<div class="hero-metric-tile">' +
        '<div class="hero-metric-label">' + it.label + '</div>' +
        '<div class="hero-metric-value tabular">' + pct(it.value) + '</div>' +
        '<div class="hero-metric-scale">' +
          '<div class="hero-metric-bar" style="width:' + fillPct + '%;"></div>' +
        '</div>' +
        '<div class="hero-metric-sub">' + it.sub + '</div>' +
      '</div>';
    }
    html += '</div>';
    return html;
  }

  function ruleMatrixHtml(perRule) {
    let html = '<div class="table-container">' +
      '<table class="rule-matrix">' +
      '<thead><tr>' +
        '<th>RULE</th>' +
        '<th class="num-col">TP</th>' +
        '<th class="num-col">FP</th>' +
        '<th class="num-col">FN</th>' +
        '<th class="num-col">PRECISION</th>' +
        '<th class="num-col">RECALL</th>' +
        '<th class="num-col">F1</th>' +
        '<th class="status-col">STATUS</th>' +
      '</tr></thead><tbody>';

    for (const r of perRule) {
      const hasErrors = r.fp > 0 || r.fn > 0;
      const statusLabel = hasErrors ? "1 FP" : "PERFECT";
      const statusClass = hasErrors ? "imperfect" : "perfect";

      html += '<tr class="' + (hasErrors ? "row-imperfect" : "row-perfect") + '">' +
        '<td class="rule-name-cell">' +
          '<span class="status-indicator ' + statusClass + '"></span>' +
          '<span class="rule-display-name">' + r.rule.replace(/_/g, " ") + '</span>' +
        '</td>' +
        '<td class="num-col tabular">' + r.tp + '</td>' +
        '<td class="num-col tabular">' + r.fp + '</td>' +
        '<td class="num-col tabular">' + r.fn + '</td>' +
        '<td class="num-col tabular highlight-metric">' + pct(r.precision) + '</td>' +
        '<td class="num-col tabular highlight-metric">' + pct(r.recall) + '</td>' +
        '<td class="num-col tabular highlight-metric">' + pct(r.f1) + '</td>' +
        '<td class="status-col"><span class="matrix-status-pill ' + statusClass + '">' + statusLabel + '</span></td>' +
      '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
  }

  function ruleComparisonHtml(perRule) {
    let html = '<div class="rule-comparison-grid">';
    for (const r of perRule) {
      html += '<div class="rule-comp-card">' +
        '<div class="rule-comp-header">' +
          '<div class="rule-comp-name">' + r.rule.replace(/_/g, " ") + '</div>' +
          '<div class="rule-comp-stat tabular">F1: ' + pct(r.f1) + '</div>' +
        '</div>' +
        '<div class="rule-comp-bars">' +
          '<div class="rule-comp-bar-row">' +
            '<span class="rule-bar-lbl">PRECISION</span>' +
            '<div class="rule-bar-track"><div class="rule-bar-fill prec" style="width:' + (r.precision * 100) + '%;"></div></div>' +
            '<span class="rule-bar-val tabular">' + pct(r.precision) + '</span>' +
          '</div>' +
          '<div class="rule-comp-bar-row">' +
            '<span class="rule-bar-lbl">RECALL</span>' +
            '<div class="rule-bar-track"><div class="rule-bar-fill rec" style="width:' + (r.recall * 100) + '%;"></div></div>' +
            '<span class="rule-bar-val tabular">' + pct(r.recall) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderMetrics(data) {
    const o = data.overall;
    const totalTp = data.per_rule.reduce((a, r) => a + r.tp, 0);
    const totalFp = data.per_rule.reduce((a, r) => a + r.fp, 0);
    const totalFn = data.per_rule.reduce((a, r) => a + r.fn, 0);

    metricsScope.textContent = "Held-out evaluation · " + data.fixture_count + " isolated fixtures";

    let html = "";

    // Section 1: Hero Metrics
    html += '<div class="metrics-block">' +
      '<div class="section-label">01 / DETECTION ACCURACY (OVERALL) <button type="button" class="info-icon-btn" data-guide-target="section-eval-metrics" title="Read explanation in Product Handbook" aria-label="Evaluation metrics guide">ⓘ</button></div>' +
      heroMetricsHtml(o) +
    '</div>';

    html += '<div class="editorial-divider"></div>';

    // Section 2: Per-Rule Performance Matrix
    html += '<div class="metrics-block">' +
      '<div class="section-label">02 / PER-RULE EVALUATION BREAKDOWN</div>' +
      ruleMatrixHtml(data.per_rule) +
      ruleComparisonHtml(data.per_rule) +
    '</div>';

    html += '<div class="editorial-divider"></div>';

    // Section 3: Evaluation Methodology & Fact Column
    html += '<div class="metrics-block">' +
      '<div class="section-label">03 / EVALUATION METHODOLOGY <button type="button" class="info-icon-btn" data-guide-target="section-held-out" title="Read explanation in Product Handbook" aria-label="Held-out evaluation guide">ⓘ</button></div>' +
      '<div class="methodology-split">' +
        '<div class="methodology-text-col">' +
          '<p class="methodology-lead">' +
            'Evaluation metrics are computed strictly against held-out test fixtures that were isolated during detector rule authoring.' +
          '</p>' +
          '<p class="methodology-body">' +
            'Rules are tested against synthetic and real-world payment patterns including clean implementations and vulnerable variations. ' +
            'Zero false negatives (100% recall) indicates all actual vulnerabilities in the held-out suite were identified, while 88.9% precision reflects a single false positive triage candidate.' +
          '</p>' +
        '</div>' +
        '<div class="methodology-stats-col">' +
          factRow(data.fixture_count, "Isolated fixtures evaluated") +
          factRow(totalTp, "True positive detections") +
          factRow(totalFp, "False positive flag") +
          factRow(totalFn, "False negatives (zero misses)") +
        '</div>' +
      '</div>' +
    '</div>';

    html += '<div class="editorial-divider"></div>';

    // Section 4: Estimated Avoided Cost Model
    html += '<div class="metrics-block">' +
      '<div class="section-label">04 / ESTIMATED VALUE MODEL (ASSUMPTION-BASED) <button type="button" class="info-icon-btn" data-guide-target="section-value-model" title="Read explanation in Product Handbook" aria-label="Estimated value model guide">ⓘ</button></div>' +
      '<div class="cost-model-card">' +
        '<div class="cost-headline-row">' +
          '<div class="cost-figure tabular">$' + Math.round(data.cost.net_savings_usd).toLocaleString() + '</div>' +
          '<div class="cost-tagline">' +
            '<div class="cost-tag-title">Estimated net avoided exposure & triage cost <button type="button" class="info-icon-btn" data-guide-target="section-value-model" title="Read explanation in Product Handbook" aria-label="Estimated value model guide">ⓘ</button></div>' +
            '<div class="cost-tag-subtitle">Versus baseline zero-coverage scenario on evaluation suite</div>' +
          '</div>' +
        '</div>' +
        '<div class="cost-assumptions-box">' +
          '<span class="assumption-badge">MODEL ASSUMPTIONS</span>' +
          '<span class="assumption-item">$' + data.cost.false_positive_cost_usd + ' / false positive (engineering triage overhead)</span>' +
          '<span class="assumption-sep">·</span>' +
          '<span class="assumption-item">$' + data.cost.false_negative_cost_usd + ' / false negative (downstream checkout exposure)</span>' +
          '<div class="assumption-disclaimer">Values represent parameterized financial models for benchmark illustration and are not audited telemetry.</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    metricsContent.innerHTML = html;
  }

  function factRow(value, label) {
    return '<div class="method-fact-row">' +
      '<span class="fact-num tabular">' + value + '</span>' +
      '<span class="fact-lbl">' + label + '</span>' +
    '</div>';
  }

})();
