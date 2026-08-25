"""Rule: webhook/callback routes that don't verify a signature header
before trusting the payload."""

from backend.config import CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, SEVERITY_HIGH
from backend.detectors.patterns import SIGNATURE_HEADER_RE, VERIFICATION_CALL_RE, WEBHOOK_RE
from backend.models import Finding
from backend.parsers.base import CodeBlock, SourceFile

RULE = "missing_webhook_signature"


def run(blocks: list[CodeBlock], files: dict[str, SourceFile]) -> list[Finding]:
    findings: list[Finding] = []

    for block in blocks:
        if block.kind != "route":
            continue
        header = block.header_text
        if not WEBHOOK_RE.search(header):
            continue

        has_verification_call = bool(VERIFICATION_CALL_RE.search(block.body_text))
        has_signature_header = bool(SIGNATURE_HEADER_RE.search(block.body_text))

        if has_verification_call:
            continue

        confidence = CONFIDENCE_HIGH if has_signature_header else CONFIDENCE_MEDIUM
        detail = (
            "reads a signature header but never verifies it"
            if has_signature_header
            else "never references a signature header at all"
        )
        findings.append(
            Finding(
                rule=RULE,
                severity=SEVERITY_HIGH,
                confidence=confidence,
                file=block.file,
                line=block.start_line,
                description=f"Webhook handler '{block.route_path or block.name}' {detail} before trusting the payload.",
                fix="Verify the webhook signature header against the payload before processing it.",
            )
        )

    return findings
