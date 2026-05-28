"""
Integration Tests for LangGraph Workflow execution and Checkpoint Recovery.
"""

import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch

from src.graph.workflow import compiled_workflow
from src.api.schemas import IncidentStateModel, StandardizedAlert, TimelineItem
from src.database.redis_client import redis_manager


@pytest.fixture
def mock_redis_db():
    """Returns a mock Redis connection tracking serialized state."""
    saved_incidents = {}
    saved_keys = {}

    def mock_save(incident: IncidentStateModel):
        saved_incidents[incident.id] = incident

    def mock_get(incident_id: str):
        return saved_incidents.get(incident_id)

    def mock_get_active():
        return [
            i
            for i in saved_incidents.values()
            if i.state in ["open", "analyzing", "awaiting_approval"]
        ]

    def mock_redis_set(key: str, val: str, ex=None, nx=None):
        saved_keys[key] = val
        return True

    def mock_redis_get(key: str):
        return saved_keys.get(key)

    # Patch the redis client get/set operations
    with patch(
        "src.database.redis_client.RedisClientManager.get_client"
    ) as mock_get_client, patch(
        "src.database.redis_client.RedisClientManager.save_incident",
        side_effect=mock_save,
    ), patch(
        "src.database.redis_client.RedisClientManager.get_incident",
        side_effect=mock_get,
    ), patch(
        "src.database.redis_client.RedisClientManager.get_active_incidents",
        side_effect=mock_get_active,
    ):

        redis_mock = MagicMock()
        redis_mock.get.side_effect = mock_redis_get
        redis_mock.set.side_effect = mock_redis_set
        mock_get_client.return_value = redis_mock
        yield redis_mock


@pytest.fixture
def mock_neo4j():
    """Mocks Neo4j up/down dependency lookups."""
    with patch(
        "src.database.neo4j_client.Neo4jClientManager.get_upstreams"
    ) as mock_up, patch(
        "src.database.neo4j_client.Neo4jClientManager.get_downstreams"
    ) as mock_down:
        mock_up.return_value = ["api-gateway"]
        mock_down.return_value = [{"type": "Database", "name": "payment-db"}]
        yield


@pytest.fixture
def mock_telemetry():
    """Mocks Prometheus and Loki client requests."""
    with patch(
        "src.services.prom_client.PrometheusClient.get_metrics"
    ) as mock_prom, patch("src.services.loki_client.LokiClient.get_logs") as mock_loki:
        mock_prom.return_value = "=== Mock Metrics ==="
        mock_loki.return_value = "=== Mock Logs ==="
        yield


@pytest.fixture
def create_incident():
    """Helper method to register a mock incident in the mocked DB."""

    def _create(
        incident_id: str, alert_name: str = "Http5xxRateHigh"
    ) -> IncidentStateModel:
        alert = StandardizedAlert(
            id="alert-123",
            name=alert_name,
            service="payment-service",
            severity="critical",
            description="High error rate",
            starts_at=datetime(2026, 5, 26, 12, 0, 0),
        )
        incident = IncidentStateModel(
            id=incident_id,
            state="open",
            severity="critical",
            services_affected=["payment-service"],
            primary_incident_alert_id="alert-123",
            alerts=[alert],
            timeline=[
                TimelineItem(
                    timestamp=alert.starts_at,
                    event_type="alert_triggered",
                    source="prometheus",
                    message="Alert payment-service",
                    severity="critical",
                )
            ],
            created_at=alert.starts_at,
            updated_at=alert.starts_at,
        )
        redis_manager.save_incident(incident)
        return incident

    return _create


@pytest.mark.asyncio
async def test_workflow_e2e_success_path(
    mock_redis_db, mock_neo4j, mock_telemetry, create_incident
):
    """
    Verifies that the compiled workflow executes E2E, transitions states successfully,
    and finalizes the incident in Redis as escalated.
    """
    create_incident("inc-e2e-ok")

    config = {"configurable": {"thread_id": "inc-e2e-ok"}}
    result = await compiled_workflow.ainvoke(
        {"incident_id": "inc-e2e-ok"}, config=config
    )

    assert result["state"] == "completed"
    assert len(result["hypotheses"]) == 3
    assert result["retry_count"] == 0

    # Verify finalized Redis state
    updated_inc = redis_manager.get_incident("inc-e2e-ok")
    assert updated_inc is not None
    assert updated_inc.state == "escalated"
    assert len(updated_inc.hypotheses) == 3
    assert any(item.event_type == "agent_milestone" for item in updated_inc.timeline)


@pytest.mark.asyncio
async def test_workflow_retry_path(
    mock_redis_db, mock_neo4j, mock_telemetry, create_incident
):
    """
    Verifies that formatting errors trigger the retry loop in the workflow.
    """
    create_incident("inc-retry", alert_name="TestRetryLoopAlert")

    config = {"configurable": {"thread_id": "inc-retry"}}
    result = await compiled_workflow.ainvoke(
        {"incident_id": "inc-retry"}, config=config
    )

    assert result["state"] == "completed"
    assert result["retry_count"] == 1
    assert len(result["hypotheses"]) == 3


@pytest.mark.asyncio
async def test_workflow_fallback_path(
    mock_redis_db, mock_neo4j, mock_telemetry, create_incident
):
    """
    Verifies that if formatting errors persist, the workflow triggers the safety fallback
    path after max retries are exceeded.
    """
    create_incident("inc-fallback", alert_name="TestFallbackAlert")

    config = {"configurable": {"thread_id": "inc-fallback"}}
    result = await compiled_workflow.ainvoke(
        {"incident_id": "inc-fallback"}, config=config
    )

    assert result["state"] == "completed"
    assert result["retry_count"] == 3
    assert len(result["hypotheses"]) == 1
    assert "Safety Fallback" in result["hypotheses"][0].hypothesis


@pytest.mark.asyncio
async def test_workflow_checkpoint_recovery_and_resume(
    mock_redis_db, mock_neo4j, mock_telemetry, create_incident
):
    """
    Simulates a database execution crash inside the LLM reasoning step,
    verifies that state checkpoints are captured, and resumes from the crash
    point successfully to complete E2E.
    """
    create_incident("inc-crash-recover", alert_name="TestCrashAlert")
    config = {"configurable": {"thread_id": "inc-crash-recover"}}

    # 1. First run throws exception (Crashes inside reasoning node)
    with pytest.raises(ValueError, match="Database error!"):
        await compiled_workflow.ainvoke(
            {"incident_id": "inc-crash-recover"}, config=config
        )

    # Check that Redis created checkpoint records up to the crash point
    checkpoint_keys = [
        k
        for k in mock_redis_db.set.call_args_list
        if k[0][0].startswith("checkpoint:inc-crash-recover")
    ]
    assert len(checkpoint_keys) > 0

    # 2. Resume execution from the saved checkpoint (Pass a value of None to resume)
    # The reasoning node should now execute successfully
    resume_result = await compiled_workflow.ainvoke(None, config=config)

    assert resume_result["state"] == "completed"
    assert len(resume_result["hypotheses"]) == 3

    # Verify finalized incident in db
    updated_inc = redis_manager.get_incident("inc-crash-recover")
    assert updated_inc.state == "escalated"
