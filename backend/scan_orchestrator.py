"""Ties parsers and rules together. scan_directory() is the single entry
point used by both the upload endpoint and the evaluation script, so a scan
run during grading is exercising the exact same code path as a scan run
through the API.
"""

import os

from backend.detectors import (
    exposed_secret_key,
    missing_amount_validation,
    missing_signature_verification,
    missing_webhook_signature,
)
from backend.models import Finding, ScanReport
from backend.parsers import node_parser, python_parser
from backend.parsers.base import CodeBlock, SourceFile

PYTHON_EXTENSIONS = {".py"}
NODE_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx"}
TEXT_SCAN_EXTENSIONS = PYTHON_EXTENSIONS | NODE_EXTENSIONS | {".html", ".htm", ".json", ".env", ".xml"}

SKIP_DIR_NAMES = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build"}

RULES = [
    missing_signature_verification,
    missing_webhook_signature,
    missing_amount_validation,
    exposed_secret_key,
]


def _read_text(path: str) -> str | None:
    for encoding in ("utf-8", "latin-1"):
        try:
            with open(path, "r", encoding=encoding) as f:
                return f.read()
        except (UnicodeDecodeError, OSError):
            continue
    return None


def _walk_source_files(root: str) -> list[tuple[str, str]]:
    """Returns (relative_path, absolute_path) for every text file worth
    scanning under root, skipping dependency/build directories."""
    results = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIR_NAMES]
        for filename in filenames:
            ext = os.path.splitext(filename)[1].lower()
            if ext not in TEXT_SCAN_EXTENSIONS:
                continue
            abs_path = os.path.join(dirpath, filename)
            rel_path = os.path.relpath(abs_path, root).replace(os.sep, "/")
            results.append((rel_path, abs_path))
    return results


def scan_directory(root: str) -> ScanReport:
    files: dict[str, SourceFile] = {}
    blocks: list[CodeBlock] = []
    frameworks_detected: set[str] = set()
    errors: list[str] = []

    for rel_path, abs_path in _walk_source_files(root):
        text = _read_text(abs_path)
        if text is None:
            errors.append(f"could not read {rel_path}")
            continue
        ext = os.path.splitext(rel_path)[1].lower()
        if ext in PYTHON_EXTENSIONS:
            framework = "python"
        elif ext in NODE_EXTENSIONS:
            framework = "node"
        else:
            framework = "unknown"

        source = SourceFile(path=rel_path, lines=text.splitlines(), framework=framework)
        files[rel_path] = source

        if framework == "python":
            blocks.extend(python_parser.parse(source))
            frameworks_detected.add("python")
        elif framework == "node":
            blocks.extend(node_parser.parse(source))
            frameworks_detected.add("node")

    findings: list[Finding] = []
    for rule_module in RULES:
        findings.extend(rule_module.run(blocks, files))

    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    findings.sort(key=lambda f: (severity_order.get(f.severity, 9), f.file, f.line))

    return ScanReport(
        findings=findings,
        files_scanned=len(files),
        frameworks_detected=sorted(frameworks_detected),
        errors=errors,
    )
