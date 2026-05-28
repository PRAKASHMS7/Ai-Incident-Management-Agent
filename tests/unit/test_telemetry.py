"""
Unit and Mock Integration Tests for Prometheus and Loki Telemetry Clients.
"""

import json
from datetime import datetime
from unittest.mock import MagicMock, patch
import pytest

from src.services.prom_client import PrometheusClient
from src.services.loki_client import LokiClient

@pytest.fixture
def mock_redis():
    """Patches the RedisClientManager.get_client call."""
    with patch("src.database.redis_client.RedisClientManager.get_client") as mock_get:
        redis_mock = MagicMock()
        mock_get.return_value = redis_mock
        yield redis_mock

@pytest.mark.asyncio
async def test_prom_client_cache_hit(mock_redis):
    """
    Verifies that get_metrics reads from Redis cache and bypasses HTTP queries on hit.
    """
    client = PrometheusClient()
    
    # 1. Setup Redis mock to return cached data (Cache Hit)
    mock_redis.get.return_value = "=== Cached Prometheus Telemetry Summary ==="
    
    # Patch httpx client to assert it's never called
    with patch.object(client.client, "get") as mock_http_get:
        res = await client.get_metrics(
            service_name="payment-service",
            starts_at=datetime(2026, 5, 26, 12, 0, 0),
            ends_at=datetime(2026, 5, 26, 12, 5, 0)
        )
        
        assert "Cached Prometheus Telemetry Summary" in res
        mock_redis.get.assert_called_once()
        mock_http_get.assert_not_called()
        
    await client.close()

@pytest.mark.asyncio
async def test_prom_client_cache_miss_success(mock_redis):
    """
    Verifies that get_metrics queries Prometheus on cache miss,
    caches the results in Redis, and returns the formatted response.
    """
    client = PrometheusClient()
    
    # 1. Cache Miss (Redis returns None)
    mock_redis.get.return_value = None
    
    # 2. Mock HTTP responses for 5 queries (CPU, RAM, rate, errors, latency)
    mock_prom_response = {
        "status": "success",
        "data": {
            "resultType": "matrix",
            "result": [
                {
                    "metric": {"pod": "payment-service-pod-xyz"},
                    "values": [
                        [1780000000.0, "0.15"],
                        [1780000015.0, "0.18"]
                    ]
                }
            ]
        }
    }
    
    mock_response_obj = MagicMock()
    mock_response_obj.status_code = 200
    mock_response_obj.json.return_value = mock_prom_response
    
    with patch.object(client.client, "get", return_value=mock_response_obj) as mock_http_get:
        res = await client.get_metrics(
            service_name="payment-service",
            starts_at=datetime(2026, 5, 26, 12, 0, 0),
            ends_at=datetime(2026, 5, 26, 12, 5, 0)
        )
        
        # Check HTTP get calls (5 queries executed in parallel)
        assert mock_http_get.call_count == 5
        assert "Prometheus Telemetry Summary" in res
        assert "payment-service-pod-xyz" in res
        
        # Verify Redis write was called with 60s TTL
        mock_redis.set.assert_called_once()
        assert mock_redis.set.call_args[0][1] == res
        assert mock_redis.set.call_args[1]["ex"] == 60
        
    await client.close()

@pytest.mark.asyncio
async def test_prom_client_error_fallback(mock_redis):
    """
    Verifies that Prometheus queries return error descriptions gracefully
    on connection failures, demonstrating the degradation model.
    """
    client = PrometheusClient()
    mock_redis.get.return_value = None
    
    # Mock HTTP get raising exception
    with patch.object(client.client, "get", side_effect=Exception("Connection Refused")) as mock_http_get:
        res = await client.get_metrics(
            service_name="payment-service",
            starts_at=datetime(2026, 5, 26, 12, 0, 0),
            ends_at=datetime(2026, 5, 26, 12, 5, 0)
        )
        
        assert "Telemetry query failed (Connection Refused)" in res
        assert mock_http_get.call_count == 5
        
    await client.close()

@pytest.mark.asyncio
async def test_loki_client_cache_hit(mock_redis):
    """
    Verifies that get_logs reads from Redis cache and bypasses HTTP queries on hit.
    """
    client = LokiClient()
    mock_redis.get.return_value = "=== Cached Loki Logs Summary ==="
    
    with patch.object(client.client, "get") as mock_http_get:
        res = await client.get_logs(
            service_name="payment-service",
            starts_at=datetime(2026, 5, 26, 12, 0, 0),
            ends_at=datetime(2026, 5, 26, 12, 5, 0)
        )
        
        assert "Cached Loki Logs Summary" in res
        mock_redis.get.assert_called_once()
        mock_http_get.assert_not_called()
        
    await client.close()

@pytest.mark.asyncio
async def test_loki_client_cache_miss_success(mock_redis):
    """
    Verifies that get_logs queries Loki, parses stream response values,
    caches results, and formats chronological log streams.
    """
    client = LokiClient()
    mock_redis.get.return_value = None
    
    # Mock Loki query response structure
    mock_loki_response = {
        "status": "success",
        "data": {
            "resultType": "streams",
            "result": [
                {
                    "stream": {"container": "payment-service"},
                    "values": [
                        ["1780000000000000000", "Critical error connecting to database"],
                        ["1780000010000000000", "NullPointerException: payment failed"]
                    ]
                }
            ]
        }
    }
    
    mock_response_obj = MagicMock()
    mock_response_obj.status_code = 200
    mock_response_obj.json.return_value = mock_loki_response
    
    with patch.object(client.client, "get", return_value=mock_response_obj) as mock_http_get:
        res = await client.get_logs(
            service_name="payment-service",
            starts_at=datetime(2026, 5, 26, 12, 0, 0),
            ends_at=datetime(2026, 5, 26, 12, 5, 0)
        )
        
        mock_http_get.assert_called_once()
        assert "Loki Log Telemetry Summary" in res
        assert "Critical error connecting to database" in res
        assert "NullPointerException" in res
        
        mock_redis.set.assert_called_once()
        
    await client.close()

@pytest.mark.asyncio
async def test_loki_client_truncation(mock_redis):
    """
    Verifies that get_logs truncates outputs when cumulative message
    length exceeds context limits (5,000 characters).
    """
    client = LokiClient()
    mock_redis.get.return_value = None
    
    # Create a very long log line (6,000 chars)
    long_log_line = "A" * 6000
    mock_loki_response = {
        "status": "success",
        "data": {
            "resultType": "streams",
            "result": [
                {
                    "stream": {"container": "payment-service"},
                    "values": [
                        ["1780000000000000000", long_log_line]
                    ]
                }
            ]
        }
    }
    
    mock_response_obj = MagicMock()
    mock_response_obj.status_code = 200
    mock_response_obj.json.return_value = mock_loki_response
    
    with patch.object(client.client, "get", return_value=mock_response_obj):
        res = await client.get_logs(
            service_name="payment-service",
            starts_at=datetime(2026, 5, 26, 12, 0, 0),
            ends_at=datetime(2026, 5, 26, 12, 5, 0)
        )
        
        # Output should report the truncation message
        assert "Log trace truncated to protect LLM context windows" in res
        assert "A" * 6000 not in res  # String should have been dropped due to truncation cap
        
    await client.close()
