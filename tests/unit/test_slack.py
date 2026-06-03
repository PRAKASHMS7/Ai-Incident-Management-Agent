"""
Unit tests for the Slack Escalation System templates and channel routing.
"""

import pytest
from unittest.mock import MagicMock, patch

from src.services.slack_client import SlackClient
from src.api.schemas import Hypothesis


def test_slack_block_builders():
    """
    Verifies that the Block Kit templates render into correctly structured dictionaries.
    """
    client = SlackClient()

    # 1. Header block
    header = client.header_block("inc-123", "critical")
    assert header["type"] == "header"
    assert "CRITICAL" in header["text"]["text"]

    header_warning = client.header_block("inc-123", "warning")
    assert "INCIDENT" in header_warning["text"]["text"]

    # 2. Context block
    from datetime import datetime

    dt = datetime(2026, 5, 26, 12, 0, 0)
    ctx = client.context_block("inc-123", dt, ["billing-service", "auth-service"])
    assert ctx["type"] == "context"
    assert "inc-123" in ctx["elements"][0]["text"]
    assert "billing-service, auth-service" in ctx["elements"][0]["text"]

    # 3. Hypotheses block
    hyps = [
        Hypothesis(
            rank=1,
            hypothesis="H1",
            confidence_score=0.85,
            evidence=["E1"],
            recommended_action="A1",
        ),
        Hypothesis(
            rank=2,
            hypothesis="H2",
            confidence_score=0.45,
            evidence=["E2"],
            recommended_action="A2",
        ),
    ]
    hyp_block = client.hypotheses_block(hyps)
    assert hyp_block["type"] == "section"
    assert "H1" in hyp_block["text"]["text"]
    assert "🟩🟩🟩🟩🟩🟩🟩🟩⬜⬜" in hyp_block["text"]["text"]  # 85% rounds to 8 blocks
    assert "H2" in hyp_block["text"]["text"]
    assert "🟩🟩🟩🟩⬜⬜⬜⬜⬜⬜" in hyp_block["text"]["text"]  # 45% rounds to 4 blocks

    # 4. Actions block
    act = client.actions_block("inc-123")
    assert act["type"] == "actions"
    assert act["block_id"] == "incident_action_buttons"
    assert len(act["elements"]) == 2
    assert act["elements"][0]["action_id"] == "slack_ack_incident"
    assert act["elements"][1]["action_id"] == "slack_resolve_incident"


@pytest.mark.asyncio
async def test_slack_channel_routing():
    """
    Verifies dynamic routing: queries Redis dynamic hashes first, falling back to defaults.
    """
    client = SlackClient()

    # 1. No mapping in Redis: falls back to default setting channel
    with patch("src.database.redis_client.redis_manager.get_client") as mock_get_redis:
        mock_r = MagicMock()
        mock_r.hget.return_value = None
        mock_get_redis.return_value = mock_r

        from src.config import settings

        target = await client.get_routing_channel("unknown-service")
        assert target == settings.SLACK_CHANNEL  # default settings.SLACK_CHANNEL

    # 2. Mapping exists in Redis: returns service specific channel
    with patch("src.database.redis_client.redis_manager.get_client") as mock_get_redis:
        mock_r = MagicMock()
        mock_r.hget.return_value = "#payment-alerts-team"
        mock_get_redis.return_value = mock_r

        target = await client.get_routing_channel("payment-service")
        assert target == "#payment-alerts-team"
        mock_r.hget.assert_called_once_with("slack:channel_routing", "payment-service")
