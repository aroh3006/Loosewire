from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_metrics_endpoint_returns_expected_shape():
    response = client.get("/api/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "overall" in data
    assert "per_rule" in data
    assert "cost" in data
    assert len(data["per_rule"]) == 4
    for r in data["per_rule"]:
        assert 0.0 <= r["precision"] <= 1.0
        assert 0.0 <= r["recall"] <= 1.0
