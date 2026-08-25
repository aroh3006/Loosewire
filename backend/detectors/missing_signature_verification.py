"""Rule: order completion paths that never check a signature.

Looks at every function/route whose name or path reads like "this is where
we mark an order paid", and flags it if nothing in its body resembles a
signature or HMAC check. Also flags frontend code that marks a payment as
successful with no corresponding server-side handler anywhere in the
project.
"""

from backend.config import CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, SEVERITY_HIGH
from backend.detectors.patterns import (
    ORDER_COMPLETION_RE,
    VERIFICATION_CALL_RE,
    is_frontend_path,
)
from backend.models import Finding
from backend.parsers.base import CodeBlock, SourceFile

RULE = "missing_signature_verification"

FRONTEND_SUCCESS_RE = ORDER_COMPLETION_RE  # same vocabulary, applied to frontend JS


def run(blocks: list[CodeBlock], files: dict[str, SourceFile]) -> list[Finding]:
    findings: list[Finding] = []
    backend_completion_seen = False

    for block in blocks:
        if is_frontend_path(block.file):
            continue
        header = block.header_text
        if not ORDER_COMPLETION_RE.search(header):
            continue
        backend_completion_seen = True
        if VERIFICATION_CALL_RE.search(block.body_text):
            continue
        confidence = CONFIDENCE_HIGH if block.kind == "route" else CONFIDENCE_MEDIUM
        findings.append(
            Finding(
                rule=RULE,
                severity=SEVERITY_HIGH,
                confidence=confidence,
                file=block.file,
                line=block.start_line,
                description=(
                    f"'{block.name or block.route_path}' looks like it finalizes an order "
                    "but no signature or HMAC verification call appears in its body."
                ),
                fix="Verify the gateway's signature (HMAC/checksum) before marking the order paid.",
            )
        )

    for path, source in files.items():
        if not is_frontend_path(path):
            continue
        if not (path.endswith(".js") or path.endswith(".jsx") or path.endswith(".ts") or path.endswith(".tsx")):
            continue
        for lineno, line in enumerate(source.lines, start=1):
            if FRONTEND_SUCCESS_RE.search(line) and not VERIFICATION_CALL_RE.search(line):
                # only worth flagging if we didn't already find a real backend
                # completion path doing the verification for this project
                if backend_completion_seen:
                    continue
                findings.append(
                    Finding(
                        rule=RULE,
                        severity=SEVERITY_HIGH,
                        confidence=CONFIDENCE_MEDIUM,
                        file=path,
                        line=lineno,
                        description=(
                            "Payment success is handled in frontend code with no matching "
                            "server-side completion path found in this project."
                        ),
                        fix="Confirm payment completion on the server after verifying the gateway signature, not in the browser.",
                    )
                )
                break  # one finding per file is enough signal

    return findings
