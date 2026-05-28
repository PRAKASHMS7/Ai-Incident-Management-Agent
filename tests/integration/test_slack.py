"""
Integration tests for the Slack Escalation callback endpoints, retries, and fallbacks.
"""

import pytest
import json
import asyncio
import httpx
from datetime import datetime
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
import slack_sdk.signature

from src.main import app
from src.database.redis_client import redis_manager
from src.api.schemas import IncidentStateModel, StandardizedAlert, TimelineItem
from src.services.slack_client import slack_client

class MockSlackResponse(dict):
    def __init__(self, data: dict, headers: dict = None):
        super().__init__(data)
        self.headers = headers or {}
        self.data = data

@pytest.fixture(autouse=True)
def mock_slack_token():
    with patch("src.services.slack_client.settings.SLACK_BOT_TOKEN", "xoxb-real-token"):
        yield

@pytest.fixture
def mock_redis_db():
    """Mock Redis connection to track serialized incident state."""
    saved_incidents = {}
    
    def mock_save(incident: IncidentStateModel):
        saved_incidents[incident.id] = incident
        
    def mock_get(incident_id: str):
        return saved_incidents.get(incident_id)
        
    with patch("src.database.redis_client.RedisClientManager.save_incident", side_effect=mock_save), \
         patch("src.database.redis_client.RedisClientManager.get_incident", side_effect=mock_get):
         yield saved_incidents


@pytest.fixture
def create_incident(mock_redis_db):
    """Helper to initialize an incident in mock Redis."""
    def _create(incident_id: str, state: str = "open", severity: str = "critical") -> IncidentStateModel:
        alert = StandardizedAlert(
            id="alert-123",
            name="Http5xxRateHigh",
            service="payment-service",
            severity=severity,
            description="High error rate",
            starts_at=datetime.now()
        )
        incident = IncidentStateModel(
            id=incident_id,
            state=state,
            severity=severity,
            services_affected=["payment-service"],
            primary_incident_alert_id="alert-123",
            alerts=[alert],
            timeline=[],
            hypotheses=[],
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        redis_manager.save_incident(incident)
        return incident
    return _create


@pytest.fixture
def client():
    """Returns a test client for FastAPI app."""
    return TestClient(app)


@pytest.mark.asyncio
async def test_slack_interactive_acknowledge_endpoint(mock_redis_db, create_incident):
    """
    Simulates the Slack callback for the Acknowledge button.
    Asserts Redis state transitions to 'analyzing', updates timeline, and updates blocks in-place.
    """
    create_incident("inc-ack", state="open")
    
    payload = {
        "type": "block_actions",
        "user": {
            "id": "U12345",
            "name": "alice",
            "team_id": "T12345"
        },
        "team": {
            "id": "T12345",
            "domain": "workspace-domain"
        },
        "container": {
            "type": "message",
            "message_ts": "1716720000.000000",
            "channel_id": "C99999"
        },
        "message": {
            "blocks": [
                {"type": "header", "block_id": "b1"},
                {"type": "actions", "block_id": "incident_action_buttons"}
            ]
        },
        "actions": [
            {
                "action_id": "slack_ack_incident",
                "value": "inc-ack",
                "type": "button"
            }
        ]
    }
    
    mock_auth_test = MockSlackResponse({
        "ok": True,
        "bot_id": "B12345",
        "user_id": "U12345",
        "team_id": "T12345"
    })
    
    # Post to FastAPI /slack/events path with mocked signature verification and auth_test
    with patch("slack_sdk.signature.SignatureVerifier.is_valid", return_value=True), \
         patch("slack_sdk.web.async_client.AsyncWebClient.auth_test", return_value=mock_auth_test), \
         patch("slack_sdk.web.async_client.AsyncWebClient.chat_update") as mock_update:
          
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post(
                "/slack/events",
                data={"payload": json.dumps(payload)},
                headers={"X-Slack-Signature": "mock", "X-Slack-Request-Timestamp": "123"}
            )
            
            assert response.status_code == 200
            for _ in range(20):
                if mock_update.call_count > 0:
                    break
                await asyncio.sleep(0.05)
            mock_update.assert_called_once()
            
            # Verify Redis state changed to 'analyzing'
            updated = redis_manager.get_incident("inc-ack")
            assert updated is not None
            assert updated.state == "analyzing"
            
            # Verify timeline updated
            assert any(item.event_type == "operator_action" for item in updated.timeline)
            assert any("alice" in item.message for item in updated.timeline)


@pytest.mark.asyncio
async def test_slack_interactive_resolve_endpoint(mock_redis_db, create_incident):
    """
    Simulates the Slack callback for the Resolve button.
    Asserts Redis state transitions to 'resolved'.
    """
    create_incident("inc-resolve", state="open")
    
    payload = {
        "type": "block_actions",
        "user": {
            "id": "U12345",
            "name": "alice",
            "team_id": "T12345"
        },
        "team": {
            "id": "T12345",
            "domain": "workspace-domain"
        },
        "container": {
            "type": "message",
            "message_ts": "1716720000.000000",
            "channel_id": "C99999"
        },
        "message": {
            "blocks": [
                {"type": "header", "block_id": "b1"},
                {"type": "actions", "block_id": "incident_action_buttons"}
            ]
        },
        "actions": [
            {
                "action_id": "slack_resolve_incident",
                "value": "inc-resolve",
                "type": "button"
            }
        ]
    }
    
    mock_auth_test = MockSlackResponse({
        "ok": True,
        "bot_id": "B12345",
        "user_id": "U12345",
        "team_id": "T12345"
    })
    
    with patch("slack_sdk.signature.SignatureVerifier.is_valid", return_value=True), \
         patch("slack_sdk.web.async_client.AsyncWebClient.auth_test", return_value=mock_auth_test), \
         patch("slack_sdk.web.async_client.AsyncWebClient.chat_update") as mock_update:
          
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post(
                "/slack/events",
                data={"payload": json.dumps(payload)},
                headers={"X-Slack-Signature": "mock", "X-Slack-Request-Timestamp": "123"}
            )
            
            assert response.status_code == 200
            for _ in range(20):
                if mock_update.call_count > 0:
                    break
                await asyncio.sleep(0.05)
            mock_update.assert_called_once()
            
            # Verify Redis state changed to 'resolved'
            updated = redis_manager.get_incident("inc-resolve")
            assert updated.state == "resolved"
            assert any(item.event_type == "operator_action" for item in updated.timeline)


@pytest.mark.asyncio
async def test_slack_post_escalation_failure_fallback(mock_redis_db, create_incident):
    """
    Simulates a Slack outage (chat.postMessage raises error after retries).
    Asserts that the system degrades gracefully and logs an 'escalation_failed' timeline event in Redis.
    """
    create_incident("inc-fail", state="open")
    
    import slack_sdk.errors
    # Setup mock exception that is raised after retries
    mock_err = slack_sdk.errors.SlackApiError(
        message="Fatal API Outage",
        response={"ok": False, "error": "fatal_outage"}
    )
    
    with patch("slack_sdk.web.async_client.AsyncWebClient.chat_postMessage", side_effect=mock_err) as mock_post:
        # Patch sleep to zero to speed up tenacity retries
        with patch("tenacity.nap.time.sleep", return_value=None):
            res = await slack_client.post_escalation_card("inc-fail")
            
            assert res is None
            assert mock_post.call_count == 3
            
            # Check that escalation_failed timeline event was registered in Redis
            updated = redis_manager.get_incident("inc-fail")
            assert updated is not None
            assert any(item.event_type == "escalation_failed" for item in updated.timeline)
