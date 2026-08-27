// Pure counting logic for the findings session summary. Kept separate from
// app.js so it can be tested on its own with plain node, no browser needed.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    var lib = factory();
    root.computeActiveSeverityCounts = lib.computeActiveSeverityCounts;
    root.SEVERITY_ORDER = lib.SEVERITY_ORDER;
  }
})(typeof self !== "undefined" ? self : this, function () {
  var SEVERITY_ORDER = ["critical", "high", "medium", "low"];

  // Counts findings by severity, skipping any index marked as dismissed.
  // dismissedIndices can be a Set or anything with a .has(index) method.
  function computeActiveSeverityCounts(findings, dismissedIndices) {
    var counts = { critical: 0, high: 0, medium: 0, low: 0 };
    findings.forEach(function (f, i) {
      if (dismissedIndices.has(i)) return;
      if (Object.prototype.hasOwnProperty.call(counts, f.severity)) {
        counts[f.severity]++;
      }
    });
    return counts;
  }

  return { computeActiveSeverityCounts: computeActiveSeverityCounts, SEVERITY_ORDER: SEVERITY_ORDER };
});
