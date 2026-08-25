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
        '<td><span class="tag ' + f.severity + '">' + f.severity + "</span></td>" +
        '<td><span class="confidence">' + f.confidence + "</span></td>" +
        "<td>" + f.rule.replace(/_/g, " ") + "</td>" +
        '<td class="location">' + escapeHtml(f.file) + ":" + f.line + "</td>" +
        "<td>" + escapeHtml(f.description) + "</td>" +
        '<td class="fix">' + escapeHtml(f.fix) + "</td>";
      findingsBody.appendChild(tr);
    }
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

  function renderMetrics(data) {
    const o = data.overall;
    let html = "";

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
})();
