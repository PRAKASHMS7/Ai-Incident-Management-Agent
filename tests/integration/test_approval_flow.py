"""
Integration Tests for Escalation Approval Flow REST endpoints.
"""

import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from src.main import app
from src.api.schemas import IncidentStateModel, StandardizedAlert, TimelineItem


@pytest.fixture
def client():
    """Returns a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def mock_incident():
    """Creates a mock incident in pending_approval state."""
    alert = StandardizedAlert(
        id="alert-approval-test",
        name="Http5xxRateHigh",
        service="payment-service",
        severity="critical",
        description="High 5xx error rates",
        starts_at=datetime(2026, 5, 26, 12, 0, 0),
    )
    return IncidentStateModel(
        id="inc-approval-test",
        state="pending_approval",
        severity="critical",
        services_affected=["payment-service"],
        primary_incident_alert_id="alert-approval-test",
        alerts=[alert],
        timeline=[
            TimelineItem(
                timestamp=datetime(2026, 5, 26, 12, 0, 0),
                event_type="alert_triggered",
                source="prometheus",
                message="Incident opened.",
                severity="critical",
            )
        ],
        hypotheses=[],
        created_at=datetime(2026, 5, 26, 12, 0, 0),
        updated_at=datetime(2026, 5, 26, 12, 0, 0),
    )


@patch("src.database.redis_client.RedisClientManager.get_client")
def test_get_channels(mock_redis_get, client):
    """Verifies that available channels can be fetched (dynamic list from Redis routing)."""
    mock_redis = MagicMock()
    mock_redis.hvals.return_value = [b"#sre-critical-alerts", b"#sre-warnings"]
    mock_redis_get.return_value = mock_redis

    response = client.get("/incidents/inc-approval-test/channels")
    assert response.status_code == 200
    channels = response.json()
    assert isinstance(channels, list)
    assert "#sre-critical-alerts" in channels
    assert "#sre-warnings" in channels


@patch("src.database.redis_client.RedisClientManager.get_client")
def test_get_channels_fallback(mock_redis_get, client):
    """Verifies that channels fetch falls back to settings.SLACK_CHANNEL when Redis routing is empty."""
    mock_redis = MagicMock()
    mock_redis.hvals.return_value = []
    mock_redis_get.return_value = mock_redis

    response = client.get("/incidents/inc-approval-test/channels")
    assert response.status_code == 200
    channels = response.json()
    assert isinstance(channels, list)

    from src.config import settings

    assert settings.SLACK_CHANNEL in channels


@patch("src.services.slack_client.SlackClient.post_escalation_card")
@patch("src.database.redis_client.RedisClientManager.save_incident")
@patch("src.database.redis_client.RedisClientManager.get_incident")
def test_approve_escalation_success(
    mock_get, mock_save, mock_post_card, mock_incident, client
):
    """Verifies successful escalation approval."""
    mock_get.return_value = mock_incident

    payload = {
        "channel": "#sre-critical-alerts",
        "notes": "Escalating payment service latency to critical channel",
    }

    response = client.post(
        "/incidents/inc-approval-test/approve?operator_name=Prakash", json=payload
    )
    assert response.status_code == 200
    res_data = response.json()

    # Check status transitions
    assert res_data["state"] == "escalated"
    assert res_data["approved_by"] == "Prakash"
    assert res_data["approved_at"] is not None

    # Verify timeline entry
    timeline = res_data["timeline"]
    assert len(timeline) == 2
    operator_event = timeline[-1]
    assert operator_event["event_type"] == "operator_action"
    assert "approved by @Prakash" in operator_event["message"]
    assert operator_event["metadata"]["notes"] == payload["notes"]
    assert operator_event["metadata"]["channel"] == payload["channel"]

    # Verify slack post was triggered
    mock_post_card.assert_called_once_with(
        incident_id="inc-approval-test",
        channel="#sre-critical-alerts",
        operator_notes="Escalating payment service latency to critical channel",
    )
    mock_save.assert_called_once()


@patch("src.services.slack_client.SlackClient.post_escalation_card")
@patch("src.database.redis_client.RedisClientManager.save_incident")
@patch("src.database.redis_client.RedisClientManager.get_incident")
def test_reject_escalation_success(
    mock_get, mock_save, mock_post_card, mock_incident, client
):
    """Verifies successful escalation rejection."""
    mock_get.return_value = mock_incident

    response = client.post("/incidents/inc-approval-test/reject?operator_name=Prakash")
    assert response.status_code == 200
    res_data = response.json()

    # Check status transitions
    assert res_data["state"] == "approval_rejected"
    assert res_data["rejected_by"] == "Prakash"
    assert res_data["rejected_at"] is not None

    # Verify timeline entry
    timeline = res_data["timeline"]
    assert len(timeline) == 2
    operator_event = timeline[-1]
    assert operator_event["event_type"] == "operator_action"
    assert "rejected by @Prakash" in operator_event["message"]

    # Verify slack post was NOT triggered
    mock_post_card.assert_not_called()
    mock_save.assert_called_once()


@patch("src.database.redis_client.RedisClientManager.get_incident")
def test_approve_conflict_state(mock_get, mock_incident, client):
    """Verifies error response when trying to approve an incident not in pending_approval."""
    mock_incident.state = "open"
    mock_get.return_value = mock_incident

    payload = {"channel": "#sre-critical-alerts", "notes": "Should fail"}

    response = client.post(
        "/incidents/inc-approval-test/approve?operator_name=Prakash", json=payload
    )
    assert response.status_code == 409
    assert "expected 'pending_approval'" in response.json()["detail"]
