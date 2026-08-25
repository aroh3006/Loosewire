"""Rule: order completion logic that never compares the amount being
confirmed against the amount stored when the order was created."""

from backend.config import CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, SEVERITY_HIGH
from backend.detectors.patterns import (
    AMOUNT_COMPARISON_RE,
    AMOUNT_REFERENCE_RE,
    ORDER_COMPLETION_RE,
    ORDER_LOOKUP_RE,
    is_frontend_path,
)
from backend.models import Finding
from backend.parsers.base import CodeBlock, SourceFile

RULE = "missing_amount_validation"


def run(blocks: list[CodeBlock], files: dict[str, SourceFile]) -> list[Finding]:
    findings: list[Finding] = []

    for block in blocks:
        if is_frontend_path(block.file):
            continue
        if not ORDER_COMPLETION_RE.search(block.header_text):
            continue

        body = block.body_text
        has_comparison = bool(AMOUNT_COMPARISON_RE.search(body))
        if has_comparison:
            continue

        has_order_lookup = bool(ORDER_LOOKUP_RE.search(body))
        mentions_amount = bool(AMOUNT_REFERENCE_RE.search(body))

        # if the function never even mentions "amount", it's ambiguous whether
        # amount validation belongs here at all, so confidence drops
        if not mentions_amount and not has_order_lookup:
            confidence = CONFIDENCE_MEDIUM
        else:
            confidence = CONFIDENCE_HIGH

        findings.append(
            Finding(
                rule=RULE,
                severity=SEVERITY_HIGH,
                confidence=confidence,
                file=block.file,
                line=block.start_line,
                description=(
                    f"'{block.name or block.route_path}' completes an order without comparing "
                    "the confirmed amount to the amount stored at order creation."
                ),
                fix="Compare the incoming amount to the stored order amount before marking it paid.",
            )
        )

    return findings
