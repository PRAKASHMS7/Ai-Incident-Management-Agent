"""
Integration tests for Phase 8 Timeline and RCA API endpoints, storage, and fallbacks.
"""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from pathlib import Path

from src.main import app
from src.database.redis_client import redis_manager
from src.api.schemas import (
    IncidentStateModel,
    StandardizedAlert,
    TimelineItem,
    Hypothesis,
)


@pytest.fixture
def mock_redis_db():
    """Mock Redis client and state persistence handlers."""
    saved_incidents = {}
    saved_keys = {}

    def mock_save(incident: IncidentStateModel):
        saved_incidents[incident.id] = incident

    def mock_get(incident_id: str):
        return saved_incidents.get(incident_id)

    def mock_redis_set(key: str, val: str, ex=None, nx=None):
        saved_keys[key] = val
        return True

    def mock_redis_get(key: str):
        return saved_keys.get(key)

    with patch(
        "src.database.redis_client.RedisClientManager.save_incident",
        side_effect=mock_save,
    ), patch(
        "src.database.redis_client.RedisClientManager.get_incident",
        side_effect=mock_get,
    ), patch(
        "src.database.redis_client.RedisClientManager.get_client"
    ) as mock_get_client:

        redis_mock = MagicMock()
        redis_mock.get.side_effect = mock_redis_get
        redis_mock.set.side_effect = mock_redis_set
        redis_mock.setex.side_effect = lambda k, ttl, v: mock_redis_set(k, v, ex=ttl)
        mock_get_client.return_value = redis_mock
        yield saved_incidents


@pytest.fixture
def create_incident(mock_redis_db):
    """Helper fixture to insert baseline incidents into mock Redis."""

    def _create(incident_id: str, state: str = "open") -> IncidentStateModel:
        alert = StandardizedAlert(
            id="alert-123",
            name="Http5xxRateHigh",
            service="payment-service",
            severity="critical",
            description="High error rate",
            starts_at=datetime.now(timezone.utc) - timedelta(minutes=10),
        )
        incident = IncidentStateModel(
            id=incident_id,
            state=state,
            severity="critical",
            services_affected=["payment-service"],
            primary_incident_alert_id="alert-123",
            alerts=[alert],
            timeline=[
                TimelineItem(
                    timestamp=alert.starts_at,
                    event_type="alert_triggered",
                    source="prometheus",
                    message="Fired",
                    severity="critical",
                )
            ],
            hypotheses=[
                Hypothesis(
                    rank=1,
                    hypothesis="Hyp1",
                    confidence_score=0.8,
                    evidence=["E1"],
                    recommended_action="A1",
                )
            ],
            created_at=alert.starts_at,
            updated_at=alert.starts_at,
        )
        redis_manager.save_incident(incident)
        return incident

    return _create


@pytest.fixture
def client():
    """FastAPI TestClient wrapper."""
    return TestClient(app)


def test_resolve_incident_endpoint(mock_redis_db, create_incident, client):
    """
    POST /incidents/{id}/resolve transitions incident to resolved,
    adds timeline item, compiles markdown report, and writes to local disk.
    """
    create_incident("inc-res-test")

    response = client.post("/incidents/inc-res-test/resolve?operator_name=bob")
    assert response.status_code == 200

    # Assert state transitions
    updated = redis_manager.get_incident("inc-res-test")
    assert updated is not None
    assert updated.state == "resolved"
    assert updated.rca_document_url == "/rca/inc-res-test"

    # Assert timeline operator resolved event exists
    assert any(t.event_type == "operator_action" for t in updated.timeline)
    assert any("bob" in t.message for t in updated.timeline)

    # Assert local disk markdown exists
    local_path = Path("storage/rcas") / "inc-res-test.md"
    assert local_path.exists()

    # Cleanup
    if local_path.exists():
        local_path.unlink()


def test_get_timeline_endpoint(mock_redis_db, create_incident, client):
    """
    GET /timeline/{id} retrieves incident timeline logs chronologically.
    """
    create_incident("inc-time-test")
    response = client.get("/timeline/inc-time-test")
    assert response.status_code == 200
    data = response.json()
    assert data["incident_id"] == "inc-time-test"
    assert len(data["timeline"]) == 1


def test_rca_endpoints_success(mock_redis_db, create_incident, client):
    """
    GET /rca/{id}, GET /rca/{id}/json, and GET /rca/{id}/export
    retrieve raw Markdown, JSON metadata, and download files respectively.
    """
    create_incident("inc-rca-test")

    # Resolve first to generate reports
    res = client.post("/incidents/inc-rca-test/resolve")
    assert res.status_code == 200

    # 1. GET /rca/{id}
    response_md = client.get("/rca/inc-rca-test")
    assert response_md.status_code == 200
    assert "# Incident Post-Mortem Report" in response_md.text

    # 2. GET /rca/{id}/json
    response_json = client.get("/rca/inc-rca-test/json")
    assert response_json.status_code == 200
    data = response_json.json()
    assert data["incident_id"] == "inc-rca-test"
    assert "markdown_content" in data

    # 3. GET /rca/{id}/export
    response_exp = client.get("/rca/inc-rca-test/export")
    assert response_exp.status_code == 200
    assert "attachment" in response_exp.headers["content-disposition"]

    # Cleanup
    local_path = Path("storage/rcas") / "inc-rca-test.md"
    if local_path.exists():
        local_path.unlink()


def test_resolve_incident_groq_fallback(mock_redis_db, create_incident, client):
    """
    Verifies that if Groq fails or throws exceptions, the resolution flow
    completes successfully using a programmatic fallback summary.
    """
    create_incident("inc-groq-fail")

    # Mock settings GROQ_API_KEY to bypass mock mode and force client to make the call, and stub get_reasoning to raise exception
    with patch(
        "src.services.rca_generator.settings.GROQ_API_KEY", "xoxb-groq-key"
    ), patch(
        "src.services.groq_client.groq_client.get_reasoning",
        side_effect=Exception("Groq API Outage"),
    ):

        response = client.post("/incidents/inc-groq-fail/resolve")
        assert response.status_code == 200

        updated = redis_manager.get_incident("inc-groq-fail")
        assert updated.state == "resolved"

        # Retrieve MD and verify fallback summary is present
        response_md = client.get("/rca/inc-groq-fail")
        assert response_md.status_code == 200
        assert "Incident inc-groq-fail affected the service(s)" in response_md.text

        local_path = Path("storage/rcas") / "inc-groq-fail.md"
        if local_path.exists():
            local_path.unlink()


def test_update_rca_report(mock_redis_db, create_incident, client):
    """
    PUT /rca/{id} updates the Markdown content in Redis and on disk.
    """
    create_incident("inc-update-test")
    # Resolve first to generate reports
    res = client.post("/incidents/inc-update-test/resolve")
    assert res.status_code == 200

    new_content = "# Updated Incident Post-Mortem Report\nModified content by operator."
    response = client.put(
        "/rca/inc-update-test", json={"markdown_content": new_content}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # Verify disk persistence
    local_path = Path("storage/rcas") / "inc-update-test.md"
    assert local_path.exists()
    assert local_path.read_text(encoding="utf-8") == new_content

    # Verify Redis cache update
    response_md = client.get("/rca/inc-update-test")
    assert response_md.status_code == 200
    assert response_md.text == new_content

    # Cleanup
    if local_path.exists():
        local_path.unlink()
