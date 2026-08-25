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

  dropzone.addEventListener("click", () => fileInput.click());
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

  function renderFindings(report) {
    findingsBody.innerHTML = "";

    if (!report.findings.length) {
      findingsEmpty.style.display = "block";
      findingsEmpty.textContent = "No issues found in " + report.files_scanned + " file(s) scanned.";
      findingsWrap.style.display = "none";
      findingsMeta.textContent = "";
      return;
    }

    findingsEmpty.style.display = "none";
    findingsWrap.style.display = "block";
    findingsMeta.textContent =
      report.findings.length + " finding(s) · " + report.files_scanned + " file(s) scanned" +
      (report.frameworks_detected.length ? " · " + report.frameworks_detected.join(", ") : "");

    for (const f of report.findings) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td><span class="tag ' + f.severity + '">' + severityIcon(f.severity) + f.severity + "</span></td>" +
        '<td><span class="confidence">' + f.confidence + "</span></td>" +
        "<td>" + f.rule.replace(/_/g, " ") + "</td>" +
        '<td class="location">' + escapeHtml(f.file) + ":" + f.line + "</td>" +
        "<td>" + escapeHtml(f.description) + "</td>" +
        '<td class="fix">' + escapeHtml(f.fix) + "</td>";
      findingsBody.appendChild(tr);
    }
  }

  const SEVERITY_ICONS = {
    critical: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    high: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    medium: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    low: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };

  function severityIcon(severity) {
    return SEVERITY_ICONS[severity] || "";
  }

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

  function donutChartHtml(bySeverity) {
    const order = ["critical", "high", "medium", "low"];
    const colors = { critical: cssVar("--critical"), high: cssVar("--high"), medium: cssVar("--medium"), low: cssVar("--low") };
    const values = order.map((k) => bySeverity[k] || 0);
    const total = values.reduce((a, b) => a + b, 0);

    const r = 52, cx = 64, cy = 64, sw = 16;
    const circumference = 2 * Math.PI * r;
    let offset = 0;
    let circles = "";

    if (total === 0) {
      circles = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' +
        cssVar("--border") + '" stroke-width="' + sw + '"/>';
    } else {
      for (const key of order) {
        const v = bySeverity[key] || 0;
        if (v === 0) continue;
        const frac = v / total;
        const len = frac * circumference;
        circles += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + colors[key] +
          '" stroke-width="' + sw + '" stroke-dasharray="' + len + ' ' + circumference +
          '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')">' +
          "<title>" + key + ": " + v + " (" + (frac * 100).toFixed(0) + "%)</title></circle>";
        offset += len;
      }
    }

    const svg = '<svg viewBox="0 0 128 128" width="128" height="128">' + circles +
      '<text x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle" class="donut-total-label" fill="' + cssVar("--text") + '">' + total + '</text>' +
      '<text x="' + cx + '" y="' + (cy + 14) + '" text-anchor="middle" class="donut-total-sub" fill="' + cssVar("--text-muted") + '">FINDINGS</text>' +
      '</svg>';

    let legend = '<ul class="legend">';
    for (const key of order) {
      const v = bySeverity[key] || 0;
      const pctVal = total ? Math.round((v / total) * 100) : 0;
      legend += '<li><span class="legend-dot" style="background:' + colors[key] + '"></span>' +
        '<span class="legend-label">' + key + '</span>' +
        '<span class="legend-value">' + v + " (" + pctVal + "%)</span></li>";
    }
    legend += "</ul>";

    return '<div class="donut-wrap">' + svg + legend + "</div>";
  }

  function gaugeSvg(value, color) {
    const r = 34, cx = 40, cy = 40, sw = 8;
    const circumference = 2 * Math.PI * r;
    const len = value * circumference;
    return '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + cssVar("--bg-sunken") + '" stroke-width="' + sw + '"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + sw +
      '" stroke-linecap="round" stroke-dasharray="' + len + " " + circumference +
      '" transform="rotate(-90 ' + cx + " " + cy + ')"/>' +
      "</svg>";
  }

  function gaugesRowHtml(o) {
    const items = [
      { label: "Precision", value: o.precision, color: cssVar("--accent") },
      { label: "Recall", value: o.recall, color: cssVar("--pastel-mint-text") },
      { label: "F1", value: o.f1, color: cssVar("--pastel-purple-text") },
    ];
    let html = '<div class="gauges-row">';
    for (const it of items) {
      html += '<div class="gauge">' +
        '<div style="position:relative">' + gaugeSvg(it.value, it.color) +
        '<div class="gauge-value" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">' +
        pct(it.value) + "</div></div>" +
        '<div class="gauge-label">' + it.label + "</div></div>";
    }
    html += "</div>";
    return html;
  }

  function barsHtml(perRule) {
    const maxCount = Math.max(1, ...perRule.flatMap((r) => [r.tp, r.fp, r.fn]));
    let html = '<div class="bar-rows">';
    for (const r of perRule) {
      html += '<div><div class="bar-row-label">' + r.rule.replace(/_/g, " ") + '</div><div class="bar-group">';
      html += barLine("TP", r.tp, maxCount, "tp");
      html += barLine("FP", r.fp, maxCount, "fp");
      html += barLine("FN", r.fn, maxCount, "fn");
      html += "</div></div>";
    }
    html += "</div>";
    return html;
  }

  function barLine(label, value, maxCount, cls) {
    const widthPct = Math.max(2, (value / maxCount) * 100);
    return '<div class="bar-line"><span class="bar-line-tag">' + label + '</span>' +
      '<span class="bar-track"><span class="bar-fill ' + cls + '" style="width:' + widthPct + '%"></span></span>' +
      '<span class="bar-line-count">' + value + "</span></div>";
  }

  function renderMetrics(data) {
    const o = data.overall;
    let html = "";

    html += '<div class="charts-row">';
    html += '<div class="chart-card"><h2>Findings by severity</h2>' + donutChartHtml(data.findings_by_severity || {}) + "</div>";
    html += '<div class="chart-card"><h2>Precision · recall · F1</h2>' + gaugesRowHtml(o) + "</div>";
    html += "</div>";

    html += '<div class="chart-card"><h2>Per-rule breakdown</h2>' + barsHtml(data.per_rule) + "</div>";

    html += '<div class="metrics-grid">';
    html += statTile("Precision", pct(o.precision));
    html += statTile("Recall", pct(o.recall));
    html += statTile("F1", pct(o.f1));
    html += statTile("Held-out fixtures", data.fixture_count);
    html += statTile("Estimated value saved", "$" + Math.round(data.cost.net_savings_usd).toLocaleString());
    html += "</div>";

    html += "<table class=\"metrics-table\"><thead><tr>" +
      "<th>Rule</th><th>TP</th><th>FP</th><th>FN</th><th>Precision</th><th>Recall</th><th>F1</th>" +
      "</tr></thead><tbody>";
    for (const r of data.per_rule) {
      html += "<tr>" +
        "<td>" + r.rule.replace(/_/g, " ") + "</td>" +
        "<td>" + r.tp + "</td>" +
        "<td>" + r.fp + "</td>" +
        "<td>" + r.fn + "</td>" +
        "<td>" + pct(r.precision) + "</td>" +
        "<td>" + pct(r.recall) + "</td>" +
        "<td>" + pct(r.f1) + "</td>" +
        "</tr>";
    }
    html += "</tbody></table>";

    html += '<div class="cost-note">' +
      "Cost model: each false positive is costed at $" + data.cost.false_positive_cost_usd +
      " (assumed developer time to triage and dismiss it), each false negative at $" +
      data.cost.false_negative_cost_usd + " (assumed downstream fraud loss from an unnoticed bug). " +
      "Both are stated placeholder assumptions, not measured figures. Across " + data.fixture_count +
      " held-out fixtures, the tool's net estimated value versus catching nothing is $" +
      Math.round(data.cost.net_savings_usd).toLocaleString() + "." +
      "</div>";

    metricsContent.innerHTML = html;
  }

  function statTile(label, value) {
    return '<div class="stat-tile"><div class="stat-label">' + label +
      '</div><div class="stat-value">' + value + "</div></div>";
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
