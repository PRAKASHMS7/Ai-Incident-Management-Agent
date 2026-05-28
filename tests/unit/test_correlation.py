"""
Unit Tests for Alert Correlation Engine.
"""

from datetime import datetime, timedelta
from unittest.mock import patch
import pytest

from src.api.schemas import StandardizedAlert, IncidentStateModel, TimelineItem
from src.core.correlation import CorrelationEngine


@pytest.fixture
def base_alert():
    """Returns a baseline mock alert."""
    return StandardizedAlert(
        id="alert-111",
        name="Http5xxRateHigh",
        service="payment-service",
        severity="critical",
        description="Payment processing failing",
        starts_at=datetime(2026, 5, 26, 12, 0, 0),
    )


@pytest.fixture
def active_incident(base_alert):
    """Returns an active incident containing the base alert."""
    return IncidentStateModel(
        id="incident-999",
        state="open",
        severity="critical",
        services_affected=["payment-service"],
        primary_incident_alert_id="alert-111",
        alerts=[base_alert],
        timeline=[
            TimelineItem(
                timestamp=base_alert.starts_at,
                event_type="alert_triggered",
                source="prometheus",
                message="Primary alert payment-service",
                severity="critical",
            )
        ],
        created_at=base_alert.starts_at,
        updated_at=base_alert.starts_at,
    )


@patch("src.core.correlation.redis_manager")
@patch("src.core.correlation.neo4j_manager")
def test_correlate_no_active_incidents(mock_neo4j, mock_redis, base_alert):
    """
    Verifies that a new incident is created and saved if there are no active incidents.
    """
    mock_redis.get_active_incidents.return_value = []

    incident_id = CorrelationEngine.correlate_alert(base_alert)

    assert incident_id is not None
    mock_redis.save_incident.assert_called_once()
    saved_incident: IncidentStateModel = mock_redis.save_incident.call_args[0][0]

    assert saved_incident.id == incident_id
    assert saved_incident.primary_incident_alert_id == base_alert.id
    assert saved_incident.services_affected == ["payment-service"]
    assert len(saved_incident.alerts) == 1
    assert saved_incident.alerts[0].id == base_alert.id


@patch("src.core.correlation.redis_manager")
@patch("src.core.correlation.neo4j_manager")
def test_correlate_merge_same_service(
    mock_neo4j, mock_redis, base_alert, active_incident
):
    """
    Verifies that a new alert for the same service within the time window merges
    into the existing active incident.
    """
    mock_redis.get_active_incidents.return_value = [active_incident]

    new_alert = StandardizedAlert(
        id="alert-222",
        name="DBConnectionFailed",
        service="payment-service",
        severity="critical",
        description="Cannot connect to DB",
        starts_at=base_alert.starts_at + timedelta(seconds=30),
    )

    incident_id = CorrelationEngine.correlate_alert(new_alert)

    assert incident_id == active_incident.id
    mock_redis.save_incident.assert_called_once_with(active_incident)

    assert len(active_incident.alerts) == 2
    assert active_incident.alerts[1].id == "alert-222"
    assert active_incident.services_affected == ["payment-service"]


@patch("src.core.correlation.redis_manager")
@patch("src.core.correlation.neo4j_manager")
def test_correlate_merge_dependency_graph(
    mock_neo4j, mock_redis, base_alert, active_incident
):
    """
    Verifies that a new alert on a dependent service within the time window merges
    into the active incident when Neo4j path check passes.
    """
    mock_redis.get_active_incidents.return_value = [active_incident]
    mock_neo4j.check_dependency_path.return_value = True  # Path exists

    dependent_alert = StandardizedAlert(
        id="alert-333",
        name="GatewayTimeout",
        service="api-gateway",
        severity="warning",
        description="Gateway timeouts to payment service",
        starts_at=base_alert.starts_at + timedelta(seconds=45),
    )

    incident_id = CorrelationEngine.correlate_alert(dependent_alert)

    assert incident_id == active_incident.id
    mock_neo4j.check_dependency_path.assert_called_once_with(
        "api-gateway", ["payment-service"]
    )

    assert len(active_incident.alerts) == 2
    assert "api-gateway" in active_incident.services_affected
    assert active_incident.alerts[1].id == "alert-333"


@patch("src.core.correlation.redis_manager")
@patch("src.core.correlation.neo4j_manager")
def test_correlate_time_window_expiration(
    mock_neo4j, mock_redis, base_alert, active_incident
):
    """
    Verifies that an alert outside the 300-second window creates a new incident
    instead of merging, even if it is for the same service.
    """
    mock_redis.get_active_incidents.return_value = [active_incident]

    late_alert = StandardizedAlert(
        id="alert-444",
        name="DBConnectionFailed",
        service="payment-service",
        severity="critical",
        description="Timeout",
        starts_at=base_alert.starts_at + timedelta(seconds=301),  # Window is 300s
    )

    incident_id = CorrelationEngine.correlate_alert(late_alert)

    assert incident_id != active_incident.id
    # Should have saved the new incident + active_incident remains unmodified
    assert mock_redis.save_incident.call_count == 1


@patch("src.core.correlation.redis_manager")
@patch("src.core.correlation.neo4j_manager")
def test_correlate_bridge_and_merge_incidents(mock_neo4j, mock_redis, base_alert):
    """
    Verifies that when an alert matches two active incidents, the incidents are
    merged together into the oldest incident, and the bridging alert is appended.
    """
    # Incident 1 (Older: 12:00:00)
    incident_1 = IncidentStateModel(
        id="inc-1",
        state="open",
        severity="warning",
        services_affected=["auth-service"],
        primary_incident_alert_id="alert-auth",
        alerts=[],
        timeline=[],
        created_at=datetime(2026, 5, 26, 12, 0, 0),
        updated_at=datetime(2026, 5, 26, 12, 0, 0),
    )

    # Incident 2 (Newer: 12:01:00)
    incident_2 = IncidentStateModel(
        id="inc-2",
        state="open",
        severity="warning",
        services_affected=["billing-service"],
        primary_incident_alert_id="alert-billing",
        alerts=[],
        timeline=[],
        created_at=datetime(2026, 5, 26, 12, 1, 0),
        updated_at=datetime(2026, 5, 26, 12, 1, 0),
    )

    mock_redis.get_active_incidents.return_value = [incident_1, incident_2]

    # Alert that relates to both services
    bridging_alert = StandardizedAlert(
        id="alert-bridge",
        name="NetworkPartition",
        service="network-switch",
        severity="critical",
        description="Switch failed",
        starts_at=datetime(2026, 5, 26, 12, 1, 30),
    )

    # Mock Neo4j path check to return True for both incident sets
    mock_neo4j.check_dependency_path.side_effect = lambda s, lst: True

    primary_id = CorrelationEngine.correlate_alert(bridging_alert)

    # Oldest (incident_1) is the primary target
    assert primary_id == "inc-1"

    # Verify secondary (inc-2) got marked as merged
    assert incident_2.state == "merged"
    assert incident_2.merged_into == "inc-1"

    # Verify primary (inc-1) gathered billing-service and alerts
    assert "billing-service" in incident_1.services_affected
    assert "network-switch" in incident_1.services_affected
    assert any(a.id == "alert-bridge" for a in incident_1.alerts)
