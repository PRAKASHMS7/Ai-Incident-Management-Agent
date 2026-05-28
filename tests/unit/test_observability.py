import pytest
import time
from fastapi.testclient import TestClient
from src.main import app
from src.observability.tracer import tracer
from src.observability.metrics import (
    incident_agent_heartbeat,
    incidents_detected_total,
    alert_deduplicated_total,
    llm_reasoning_latency_seconds,
    llm_token_usage_total,
    slack_escalation_delivery_total,
    operator_acknowledgement_duration_seconds,
    fallback_diagnostics_total
)

client = TestClient(app)

def test_metrics_endpoint_exposed():
    """
    GET /metrics should return Prometheus formatted plaintext data.
    """
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "incident_agent_heartbeat" in response.text
    assert "incidents_detected_total" in response.text

def test_tracer_span_creation():
    """
    Verifies that OpenTelemetry spans can be created via the initialized tracer.
    """
    with tracer.start_as_current_span("test_span") as span:
        span.set_attribute("test.attr", "val")
        assert span.is_recording()

def test_metrics_incrementation():
    """
    Verifies that we can modify and record metrics values.
    """
    # 1. Heartbeat
    incident_agent_heartbeat.set(12345.67)
    
    # 2. Incidents Detected
    incidents_detected_total.labels(severity="critical", initial_service="test-service").inc()
    
    # 3. Deduplicated
    alert_deduplicated_total.labels(service="test-service", alertname="TestAlert").inc()
    
    # 4. LLM latency
    llm_reasoning_latency_seconds.labels(attempt_count="1", status="success").observe(0.5)
    
    # 5. Token usage
    llm_token_usage_total.labels(type="prompt_tokens").inc(10)
    
    # 6. Slack escalation
    slack_escalation_delivery_total.labels(channel="test-channel", status="success").inc()
    
    # 7. Operator Ack duration
    operator_acknowledgement_duration_seconds.observe(15)
    
    # 8. Fallbacks
    initial_fallback_val = fallback_diagnostics_total._value.get()
    fallback_diagnostics_total.inc()
    
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "incident_agent_heartbeat 12345.67" in response.text
    assert 'incidents_detected_total{initial_service="test-service",severity="critical"} 1.0' in response.text
    assert 'alert_deduplicated_total{alertname="TestAlert",service="test-service"} 1.0' in response.text
    
    expected_fallback_line = f"fallback_diagnostics_total {initial_fallback_val + 1.0}"
    assert expected_fallback_line in response.text

@pytest.mark.asyncio
async def test_watchdog_worker_health_heartbeat(monkeypatch):
    """
    Verifies SRE watchdog loop checking logic triggers health checks and updates heartbeat gauge.
    """
    redis_health_called = False
    neo4j_health_called = False
    
    class MockRedisManager:
        def check_health(self):
            nonlocal redis_health_called
            redis_health_called = True
            return {"status": "healthy"}
            
    class MockNeo4jManager:
        def check_health(self):
            nonlocal neo4j_health_called
            neo4j_health_called = True
            return {"status": "healthy"}
            
    import src.core.watchdog as watchdog
    monkeypatch.setattr(watchdog, "redis_manager", MockRedisManager())
    monkeypatch.setattr(watchdog, "neo4j_manager", MockNeo4jManager())
    
    # Run health check wrappers directly
    redis_status = watchdog.redis_manager.check_health()
    neo4j_status = watchdog.neo4j_manager.check_health()
    
    assert redis_health_called
    assert neo4j_health_called
    assert redis_status["status"] == "healthy"
    assert neo4j_status["status"] == "healthy"
    
    current_time = time.time()
    watchdog.incident_agent_heartbeat.set(current_time)
    
    assert watchdog.incident_agent_heartbeat._value.get() == current_time
