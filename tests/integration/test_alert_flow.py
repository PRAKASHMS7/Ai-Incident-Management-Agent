"""
Integration Tests for Alert Ingestion and Correlation REST Flow.
"""

import json
from pathlib import Path
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from src.main import app
from src.api.schemas import IncidentStateModel


@pytest.fixture
def client():
    """Returns a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def test_payloads():
    """Loads alert payloads from the mock_data directory."""
    payload_file = (
        Path(__file__).resolve().parent.parent / "mock_data" / "alert_payloads.json"
    )
    with open(payload_file, "r") as f:
        return json.load(f)


@patch("src.database.neo4j_client.Neo4jClientManager.check_dependency_path")
@patch("src.database.redis_client.RedisClientManager.get_active_incidents")
@patch("src.database.redis_client.RedisClientManager.get_incident")
@patch("src.database.redis_client.RedisClientManager.save_incident")
@patch("src.database.redis_client.RedisClientManager.check_deduplicate")
def test_alert_ingest_e2e_flow(
    mock_dedup,
    mock_save,
    mock_get,
    mock_get_active,
    mock_check_path,
    client,
    test_payloads,
):
    """
    Simulates the E2E ingestion flow:
    1. First alert is unique, accepted, and triggers a new incident.
    2. Identical alert is flagged as a duplicate and dropped.
    3. Second unique alert on the same service is merged.
    """
    # Load raw payloads
    p_single = test_payloads["single_firing_alert"]
    p_dup = test_payloads["duplicate_firing_alert"]
    p_merge = test_payloads["second_alert_same_service"]

    # Track saved incidents to verify state updates
    saved_incidents = {}

    def mock_save_impl(incident: IncidentStateModel):
        saved_incidents[incident.id] = incident

    def mock_get_impl(incident_id: str):
        return saved_incidents.get(incident_id)

    def mock_get_active_impl():
        return [
            i
            for i in saved_incidents.values()
            if i.state in ["open", "analyzing", "awaiting_approval"]
        ]

    # Configure mocks
    mock_save.side_effect = mock_save_impl
    mock_get.side_effect = mock_get_impl
    mock_get_active.side_effect = mock_get_active_impl
    mock_check_path.return_value = False

    # ----------------------------------------------------
    # TEST STEP 1: First unique alert (New incident created)
    # ----------------------------------------------------
    mock_dedup.return_value = False  # Not a duplicate

    response = client.post("/alerts", json=p_single)

    assert response.status_code == 202
    res_data = response.json()
    assert res_data["status"] == "accepted"
    assert res_data["processed_alerts_count"] == 1
    assert len(res_data["incidents_mapped"]) == 1

    mapped_item = res_data["incidents_mapped"][0]
    incident_id_1 = mapped_item["incident_id"]
    assert mapped_item["action"] == "created"

    # Verify incident was saved in repository
    assert incident_id_1 in saved_incidents
    incident_obj = saved_incidents[incident_id_1]
    assert incident_obj.state == "open"
    assert incident_obj.services_affected == ["payment-service"]
    assert len(incident_obj.alerts) == 1
    assert incident_obj.alerts[0].name == "Http5xxRateHigh"

    # ----------------------------------------------------
    # TEST STEP 2: Duplicate alert (Dropped)
    # ----------------------------------------------------
    mock_dedup.return_value = True  # Duplicate!

    response_dup = client.post("/alerts", json=p_dup)

    assert response_dup.status_code == 202
    res_dup_data = response_dup.json()
    assert res_dup_data["status"] == "accepted"
    assert res_dup_data["processed_alerts_count"] == 0
    assert len(res_dup_data["incidents_mapped"]) == 0

    # ----------------------------------------------------
    # TEST STEP 3: Merging alert (Merged into existing incident)
    # ----------------------------------------------------
    mock_dedup.return_value = False  # Unique alert

    response_merge = client.post("/alerts", json=p_merge)

    assert response_merge.status_code == 202
    res_merge_data = response_merge.json()
    assert res_merge_data["status"] == "accepted"
    assert res_merge_data["processed_alerts_count"] == 1
    assert len(res_merge_data["incidents_mapped"]) == 1

    merge_mapped_item = res_merge_data["incidents_mapped"][0]
    assert merge_mapped_item["incident_id"] == incident_id_1
    assert merge_mapped_item["action"] == "merged"

    # Verify the saved incident has 2 alerts now
    updated_incident = saved_incidents[incident_id_1]
    assert len(updated_incident.alerts) == 2
    assert updated_incident.alerts[1].name == "DBConnectionPoolExhausted"
    assert len(updated_incident.timeline) == 2
