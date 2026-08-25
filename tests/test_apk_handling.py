import io

from fastapi.testclient import TestClient

from backend import apk
from backend.main import app

client = TestClient(app)


def test_decompile_apk_raises_when_jadx_missing(monkeypatch):
    monkeypatch.setattr(apk.shutil, "which", lambda name: None)
    try:
        apk.decompile_apk("whatever.apk", "out")
    except apk.JadxNotAvailable:
        pass
    else:
        raise AssertionError("expected JadxNotAvailable")


def test_scan_endpoint_reports_missing_jadx_instead_of_crashing(monkeypatch):
    monkeypatch.setattr(apk.shutil, "which", lambda name: None)
    fake_apk = io.BytesIO(b"not a real apk, just bytes for the upload path")
    response = client.post(
        "/api/scan",
        files={"file": ("app.apk", fake_apk, "application/vnd.android.package-archive")},
    )
    assert response.status_code == 503
    assert "jadx" in response.json()["detail"].lower()


def test_scan_endpoint_rejects_unsupported_extension():
    fake = io.BytesIO(b"hello")
    response = client.post("/api/scan", files={"file": ("notes.txt", fake, "text/plain")})
    assert response.status_code == 400
