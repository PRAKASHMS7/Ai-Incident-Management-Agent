from src.core.chaos import ChaosFaultManager, ChaosScenarioRunner, RCAValidator
from src.observability.metrics import fallback_diagnostics_total


def test_chaos_fault_manager_mock():
    """
    Verifies that ChaosFaultManager runs commands in mock mode.
    """
    manager = ChaosFaultManager(mock_mode=True)
    assert manager.mock_mode is True
    # Should run without throwing errors
    manager.inject_latency("test-container")
    manager.remove_latency("test-container")
    manager.inject_packet_loss("test-container")
    manager.remove_packet_loss("test-container")
    manager.pause_container("test-container")
    manager.unpause_container("test-container")


def test_chaos_scenario_runner():
    """
    Verifies that the runner executes all 5 chaos failure scenarios.
    """
    manager = ChaosFaultManager(mock_mode=True)
    runner = ChaosScenarioRunner(manager)

    # 1. CF-01 Latency Spike
    res1 = runner.run_cf01_latency_spike("cart-service")
    assert res1["scenario"] == "CF-01"
    assert res1["status"] == "passed"
    assert "latency" in res1["injected_fault"]

    # 2. CF-02 Error Burst
    res2 = runner.run_cf02_http_500_burst("payment-service")
    assert res2["scenario"] == "CF-02"
    assert res2["status"] == "passed"
    assert "packet loss" in res2["injected_fault"]

    # 3. CF-03 Redis Outage
    initial_fallback = fallback_diagnostics_total._value.get()
    res3 = runner.run_cf03_redis_outage()
    assert res3["scenario"] == "CF-03"
    assert res3["status"] == "passed"
    assert fallback_diagnostics_total._value.get() == initial_fallback + 1.0

    # 4. CF-04 Neo4j Outage
    res4 = runner.run_cf04_neo4j_outage()
    assert res4["scenario"] == "CF-04"
    assert res4["status"] == "passed"

    # 5. CF-05 Telemetry Degradation
    res5 = runner.run_cf05_telemetry_degradation()
    assert res5["scenario"] == "CF-05"
    assert res5["status"] == "passed"


def test_rca_accuracy_validator():
    """
    Verifies that RCAValidator accurately asserts generated hypotheses.
    """
    valid_rca = {
        "hypotheses": [
            {
                "rank": 1,
                "hypothesis": "Database connection pool exhaustion on payment-service-db.",
                "confidence_score": 0.85,
                "evidence": ["Connection pool timeouts in Loki exceptions logs"],
                "recommended_action": "Check connection parameters",
            }
        ]
    }

    # Pass case
    res = RCAValidator.validate_rca_accuracy(
        generated_rca=valid_rca,
        expected_root_cause="pool exhaustion",
        min_confidence=0.80,
    )
    assert res["valid"] is True
    assert res["details"]["cause_matched"] is True
    assert res["details"]["confidence_passed"] is True
    assert res["details"]["evidence_validated"] is True

    # Fail case - low confidence
    res_low_conf = RCAValidator.validate_rca_accuracy(
        generated_rca=valid_rca,
        expected_root_cause="pool exhaustion",
        min_confidence=0.90,
    )
    assert res_low_conf["valid"] is False
    assert res_low_conf["details"]["confidence_passed"] is False

    # Fail case - mismatched root cause
    res_mismatch = RCAValidator.validate_rca_accuracy(
        generated_rca=valid_rca,
        expected_root_cause="cpu saturation",
        min_confidence=0.80,
    )
    assert res_mismatch["valid"] is False
    assert res_mismatch["details"]["cause_matched"] is False
