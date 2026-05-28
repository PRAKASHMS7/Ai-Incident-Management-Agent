"""
Unit Tests for Alert Deduplication.
"""

from unittest.mock import MagicMock
import pytest
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
    
    # Case 1: First time alert is seen (SET returns True/Success)
    mock_redis.set.return_value = True
    is_dup = manager.check_deduplicate(
        alertname="Http5xxRateHigh",
        service="payment-service",
        severity="critical",
        instance="prod-pod-1"
    )
    
    assert is_dup is False
    mock_redis.set.assert_called_once()
    
    # Case 2: Alert is seen again within 60s (SET returns None/False because key exists)
    mock_redis.set.reset_mock()
    mock_redis.set.return_value = None
    is_dup_again = manager.check_deduplicate(
        alertname="Http5xxRateHigh",
        service="payment-service",
        severity="critical",
        instance="prod-pod-1"
    )
    
    assert is_dup_again is True
    mock_redis.set.assert_called_once()
