"""Computes precision/recall/F1 per rule, and combined, by running the
scanner against fixtures/heldout only. This fixture set is never used while
tuning the detection rules, so the numbers here reflect how the rules
generalize rather than how well they were fit to their own test cases.

For a given rule R:
  - a "positive" fixture is one whose manifest entry is tagged bug=true
    for rule R
  - every other fixture (a different rule's bug, or a clean project) is a
    "negative" for rule R

TP = positive fixture where the scanner raised >=1 finding for rule R
FN = positive fixture where the scanner raised none
FP = negative fixture where the scanner raised >=1 finding for rule R anyway
"""

import json
import os

from backend.config import FALSE_NEGATIVE_COST_USD, FALSE_POSITIVE_COST_USD
from backend.scan_orchestrator import RULES, scan_directory

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HELDOUT_ROOT = os.path.join(REPO_ROOT, "fixtures", "heldout")

ALL_RULE_NAMES = [m.RULE for m in RULES]


def _load_manifest() -> list[dict]:
    with open(os.path.join(HELDOUT_ROOT, "manifest.json")) as f:
        return json.load(f)


def _prf(tp: int, fp: int, fn: int) -> dict:
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return {"tp": tp, "fp": fp, "fn": fn, "precision": precision, "recall": recall, "f1": f1}


def compute_metrics() -> dict:
    manifest = _load_manifest()

    scan_results: dict[str, set[str]] = {}
    for entry in manifest:
        report = scan_directory(os.path.join(HELDOUT_ROOT, entry["dir"]))
        scan_results[entry["dir"]] = {f.rule for f in report.findings}

    per_rule = {}
    for rule_name in ALL_RULE_NAMES:
        tp = fp = fn = 0
        for entry in manifest:
            found = rule_name in scan_results[entry["dir"]]
            is_positive_for_rule = entry["rule"] == rule_name and entry["bug"]
            if is_positive_for_rule:
                tp += 1 if found else 0
                fn += 0 if found else 1
            else:
                fp += 1 if found else 0
        per_rule[rule_name] = _prf(tp, fp, fn)

    total_tp = sum(r["tp"] for r in per_rule.values())
    total_fp = sum(r["fp"] for r in per_rule.values())
    total_fn = sum(r["fn"] for r in per_rule.values())
    overall = _prf(total_tp, total_fp, total_fn)

    net_savings = total_tp * FALSE_NEGATIVE_COST_USD - total_fp * FALSE_POSITIVE_COST_USD

    return {
        "fixture_count": len(manifest),
        "per_rule": [{"rule": name, **per_rule[name]} for name in ALL_RULE_NAMES],
        "overall": overall,
        "cost": {
            "false_positive_cost_usd": FALSE_POSITIVE_COST_USD,
            "false_negative_cost_usd": FALSE_NEGATIVE_COST_USD,
            "net_savings_usd": net_savings,
        },
    }
