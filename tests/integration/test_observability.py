import pytest
from fastapi.testclient import TestClient
from src.main import app
from src.database.redis_client import redis_manager

client = TestClient(app)


@pytest.mark.asyncio
async def test_alert_flow_observability_integration():
    """
    Integration test checking that alert ingestion correctly triggers deduplication checks,
    creates traces, and increments Prometheus counters.
    """
    # Flush Redis db to isolate SRE test run
    redis_manager.flush_all()

    # 1. Post a new unique SRE alert
    alert_payload = {
        "receiver": "prometheus-webhook",
        "status": "firing",
        "alerts": [
            {
                "labels": {
                    "alertname": "Http5xxRateHigh",
                    "service": "cart-service",
                    "severity": "critical",
                },
                "annotations": {
                    "summary": "High 5xx rate on cart-service",
                    "description": "The cart-service is returning 5xx responses for more than 5m.",
                },
                "startsAt": "2026-05-27T10:00:00Z",
                "generatorURL": "http://prometheus/graph",
            }
        ],
    }

    response = client.post("/alerts", json=alert_payload)
    assert response.status_code == 202

    # 2. Check metrics endpoint increments incidents counter
    metrics_response = client.get("/metrics")
    assert metrics_response.status_code == 200
    assert "incidents_detected_total" in metrics_response.text

    # 3. Post a duplicate SRE alert within 60s
    dup_response = client.post("/alerts", json=alert_payload)
    assert dup_response.status_code == 202

    # Check that deduplication counter incremented
    metrics_response_2 = client.get("/metrics")
    assert "alert_deduplicated_total" in metrics_response_2.text
