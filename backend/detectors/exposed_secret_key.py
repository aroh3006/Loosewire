"""Rule: secret-looking values hardcoded into source, especially anything
that ships to a browser or gets bundled into a mobile app.

This one works on raw file text rather than CodeBlocks, since a hardcoded
key can appear anywhere, not just inside a function.
"""

import re

from backend.config import CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, SEVERITY_CRITICAL, SEVERITY_MEDIUM
from backend.detectors.patterns import (
    ENV_LOOKUP_RE,
    SECRET_NAME_RE,
    is_frontend_path,
    looks_like_placeholder,
    looks_random,
)
from backend.models import Finding
from backend.parsers.base import CodeBlock, SourceFile

RULE = "exposed_secret_key"

ASSIGNMENT_RE = re.compile(
    r"""(?P<name>[A-Za-z_][A-Za-z0-9_.]*)\s*[:=]\s*['"](?P<value>[^'"]+)['"]"""
)


def run(blocks: list[CodeBlock], files: dict[str, SourceFile]) -> list[Finding]:
    findings: list[Finding] = []

    for path, source in files.items():
        for lineno, line in enumerate(source.lines, start=1):
            if ENV_LOOKUP_RE.search(line):
                continue  # value is pulled from the environment, not hardcoded
            for m in ASSIGNMENT_RE.finditer(line):
                name = m.group("name")
                value = m.group("value")
                if not SECRET_NAME_RE.search(name):
                    continue
                if looks_like_placeholder(value):
                    continue
                if not looks_random(value):
                    continue

                frontend = is_frontend_path(path) or path.startswith("decompiled/")
                severity = SEVERITY_CRITICAL if frontend else SEVERITY_MEDIUM
                confidence = CONFIDENCE_HIGH if frontend else CONFIDENCE_MEDIUM
                where = "code that ships to the client" if frontend else "backend source"
                findings.append(
                    Finding(
                        rule=RULE,
                        severity=severity,
                        confidence=confidence,
                        file=path,
                        line=lineno,
                        description=(
                            f"'{name}' looks like a secret key hardcoded into {where}."
                        ),
                        fix="Move the value to a server-side environment variable and rotate the key.",
                    )
                )

    return findings
