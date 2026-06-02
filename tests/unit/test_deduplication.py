"""
Unit Tests for Alert Deduplication.
"""

from unittest.mock import MagicMock
from src.database.redis_client import RedisClientManager


def test_deduplication_first_unique_then_duplicate():
    """
    Verifies that the deduplicator permits a new alert, but flags
    a matching alert within the 60-second window as a duplicate.
    """
    manager = RedisClientManager()

    # Mock Redis client
    mock_redis = MagicMock()
    manager.get_client = MagicMock(return_value=mock_redis)

    # Case 1: First time alert is seen (Bits are 0)
    mock_pipe = MagicMock()
    mock_pipe.execute.return_value = [0, 0, 0, 0, 0, 0]
    mock_redis.pipeline.return_value = mock_pipe
    is_dup = manager.check_deduplicate(
        alertname="Http5xxRateHigh",
        service="payment-service",
        severity="critical",
        instance="prod-pod-1",
    )

    assert is_dup is False
    mock_redis.pipeline.assert_called()

    # Case 2: Alert is seen again within 60s (Bits are 1)
    mock_redis.pipeline.reset_mock()
    mock_pipe.execute.return_value = [1, 1, 1, 0, 0, 0]
    is_dup_again = manager.check_deduplicate(
        alertname="Http5xxRateHigh",
        service="payment-service",
        severity="critical",
        instance="prod-pod-1",
    )

    assert is_dup_again is True
    mock_redis.pipeline.assert_called_once()
