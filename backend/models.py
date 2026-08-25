from pydantic import BaseModel


class Finding(BaseModel):
    rule: str
    severity: str
    confidence: str
    file: str
    line: int
    description: str
    fix: str


class ScanReport(BaseModel):
    findings: list[Finding]
    files_scanned: int
    frameworks_detected: list[str]
    errors: list[str] = []
