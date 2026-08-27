// Tests for the not applicable counting logic used on the findings page.
// Plain node, no framework, no build step. Run with:
//   node tests/frontend/test_severity_summary.js
"use strict";

const assert = require("assert");
const { computeActiveSeverityCounts } = require("../../frontend/severity-summary.js");

const findings = [
  { severity: "critical" },
  { severity: "high" },
  { severity: "high" },
  { severity: "medium" },
  { severity: "low" },
];

// no findings dismissed, counts should match the raw list
{
  const counts = computeActiveSeverityCounts(findings, new Set());
  assert.deepStrictEqual(counts, { critical: 1, high: 2, medium: 1, low: 1 });
}

// dismiss one high finding, it should drop out of the count
{
  const counts = computeActiveSeverityCounts(findings, new Set([1]));
  assert.deepStrictEqual(counts, { critical: 1, high: 1, medium: 1, low: 1 });
}

// dismiss everything, every count should be zero
{
  const allIndexes = new Set(findings.map((_, i) => i));
  const counts = computeActiveSeverityCounts(findings, allIndexes);
  assert.deepStrictEqual(counts, { critical: 0, high: 0, medium: 0, low: 0 });
}

// dismissing an out of range index should not throw or affect real counts
{
  const counts = computeActiveSeverityCounts(findings, new Set([99]));
  assert.deepStrictEqual(counts, { critical: 1, high: 2, medium: 1, low: 1 });
}

// empty findings list, counts should all be zero regardless of dismissed set
{
  const counts = computeActiveSeverityCounts([], new Set());
  assert.deepStrictEqual(counts, { critical: 0, high: 0, medium: 0, low: 0 });
}

console.log("all severity summary tests passed");
