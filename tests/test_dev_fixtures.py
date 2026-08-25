"""Runs the scanner against every fixture in fixtures/dev and checks that
each one is judged correctly for the rule it was built to test. This is the
dev-set test suite: it is what the rules were tuned against while building
them. fixtures/heldout is never referenced from here.
"""

import json
import os

import pytest

from backend.scan_orchestrator import scan_directory

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEV_ROOT = os.path.join(REPO_ROOT, "fixtures", "dev")

with open(os.path.join(DEV_ROOT, "manifest.json")) as f:
    MANIFEST = json.load(f)


@pytest.mark.parametrize("entry", MANIFEST, ids=lambda e: e["dir"])
def test_fixture_matches_expectation(entry):
    report = scan_directory(os.path.join(DEV_ROOT, entry["dir"]))
    rule_hits = [f for f in report.findings if f.rule == entry["rule"]]

    if entry["bug"]:
        assert rule_hits, f"expected a {entry['rule']} finding in {entry['dir']}, got none"
    else:
        assert not rule_hits, (
            f"expected no {entry['rule']} finding in {entry['dir']}, got {rule_hits}"
        )
