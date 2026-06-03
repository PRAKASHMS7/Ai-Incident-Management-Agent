"""
Unit tests for the Groq Root Cause Analysis Engine Client.
"""

import pytest
import json
import httpx
from unittest.mock import MagicMock, patch
from pydantic import ValidationError

from src.services.groq_client import GroqClient, is_retryable
from src.api.schemas import ReasoningOutput


def test_is_retryable():
    """Verifies that only HTTP 429, 5xx, and generic connection issues trigger retries."""
    # 1. Retryable status codes
    resp_429 = httpx.Response(429, request=MagicMock())
    err_429 = httpx.HTTPStatusError(
        "Too Many Requests", request=MagicMock(), response=resp_429
    )
    assert is_retryable(err_429) is True

    resp_503 = httpx.Response(503, request=MagicMock())
    err_503 = httpx.HTTPStatusError(
        "Service Unavailable", request=MagicMock(), response=resp_503
    )
    assert is_retryable(err_503) is True

    # 2. Non-retryable status codes
    resp_400 = httpx.Response(400, request=MagicMock())
    err_400 = httpx.HTTPStatusError(
        "Bad Request", request=MagicMock(), response=resp_400
    )
    assert is_retryable(err_400) is False

    # 3. Connection and timeout errors
    assert is_retryable(httpx.ConnectError("Connection failed")) is True
    assert is_retryable(httpx.TimeoutException("Timeout")) is True


@pytest.mark.asyncio
async def test_groq_client_mock_mode():
    """Verifies that the client returns standard mock JSON if the API key is 'mock_key'."""
    client = GroqClient(api_key="mock_key")
    res = await client.get_reasoning("sys", "user")

    parsed = json.loads(res)
    assert "hypotheses" in parsed
    assert len(parsed["hypotheses"]) == 3

    # Enforce Pydantic validation on the result
    validated = ReasoningOutput.model_validate(parsed)
    assert len(validated.hypotheses) == 3
    assert validated.hypotheses[0].rank == 1


def test_reasoning_output_validation():
    """Verifies that ReasoningOutput enforces exactly 3 hypotheses."""
    # 1. Exactly 3 hypotheses: should validate successfully
    valid_data = {
        "hypotheses": [
            {
                "rank": 1,
                "hypothesis": "H1",
                "confidence_score": 0.9,
                "evidence": ["E1"],
                "recommended_action": "A1",
            },
            {
                "rank": 2,
                "hypothesis": "H2",
                "confidence_score": 0.7,
                "evidence": ["E2"],
                "recommended_action": "A2",
            },
            {
                "rank": 3,
                "hypothesis": "H3",
                "confidence_score": 0.5,
                "evidence": ["E3"],
                "recommended_action": "A3",
            },
        ]
    }
    obj = ReasoningOutput.model_validate(valid_data)
    assert len(obj.hypotheses) == 3

    # 2. 2 hypotheses: should raise ValidationError
    invalid_data_2 = {
        "hypotheses": [
            {
                "rank": 1,
                "hypothesis": "H1",
                "confidence_score": 0.9,
                "evidence": ["E1"],
                "recommended_action": "A1",
            },
            {
                "rank": 2,
                "hypothesis": "H2",
                "confidence_score": 0.7,
                "evidence": ["E2"],
                "recommended_action": "A2",
            },
        ]
    }
    with pytest.raises(ValidationError):
        ReasoningOutput.model_validate(invalid_data_2)

    # 3. 4 hypotheses: should raise ValidationError
    invalid_data_4 = {
        "hypotheses": [
            {
                "rank": 1,
                "hypothesis": "H1",
                "confidence_score": 0.9,
                "evidence": ["E1"],
                "recommended_action": "A1",
            },
            {
                "rank": 2,
                "hypothesis": "H2",
                "confidence_score": 0.7,
                "evidence": ["E2"],
                "recommended_action": "A2",
            },
            {
                "rank": 3,
                "hypothesis": "H3",
                "confidence_score": 0.5,
                "evidence": ["E3"],
                "recommended_action": "A3",
            },
            {
                "rank": 4,
                "hypothesis": "H4",
                "confidence_score": 0.3,
                "evidence": ["E4"],
                "recommended_action": "A4",
            },
        ]
    }
    with pytest.raises(ValidationError):
        ReasoningOutput.model_validate(invalid_data_4)


@pytest.mark.asyncio
async def test_groq_client_retry_logic():
    """Simulates HTTP 429 rate limiting followed by 200 OK to verify tenacity retry execution."""
    client = GroqClient(api_key="real_key")

    mock_response_429 = MagicMock()
    mock_response_429.status_code = 429
    mock_response_429.raise_for_status.side_effect = httpx.HTTPStatusError(
        "Too Many Requests", request=MagicMock(), response=mock_response_429
    )

    mock_response_200 = MagicMock()
    mock_response_200.status_code = 200
    mock_response_200.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {
                            "hypotheses": [
                                {
                                    "rank": 1,
                                    "hypothesis": "H1",
                                    "confidence_score": 0.9,
                                    "evidence": ["E1"],
                                    "recommended_action": "A1",
                                },
                                {
                                    "rank": 2,
                                    "hypothesis": "H2",
                                    "confidence_score": 0.7,
                                    "evidence": ["E2"],
                                    "recommended_action": "A2",
                                },
                                {
                                    "rank": 3,
                                    "hypothesis": "H3",
                                    "confidence_score": 0.5,
                                    "evidence": ["E3"],
                                    "recommended_action": "A3",
                                },
                            ]
                        }
                    )
                }
            }
        ]
    }

    # Patch post to fail twice with 429, then succeed with 200
    with patch.object(
        client.client,
        "post",
        side_effect=[mock_response_429, mock_response_429, mock_response_200],
    ) as mock_post:
        # Patch the wait time sleep function to finish immediately during the test run
        with patch("tenacity.nap.time.sleep", return_value=None):
            result = await client.get_reasoning("sys", "user")

            assert mock_post.call_count == 3
            parsed = json.loads(result)
            assert len(parsed["hypotheses"]) == 3


@pytest.mark.asyncio
async def test_groq_client_concurrency_limit():
    """Verifies that the GroqClient limits concurrent HTTP requests to a maximum of 10."""
    import asyncio

    client = GroqClient(api_key="real_key")

    active_calls = 0
    max_observed_concurrency = 0
    lock = asyncio.Lock()

    async def mock_post(*args, **kwargs):
        nonlocal active_calls, max_observed_concurrency
        async with lock:
            active_calls += 1
            if active_calls > max_observed_concurrency:
                max_observed_concurrency = active_calls
        # Simulate network latency
        await asyncio.sleep(0.05)
        async with lock:
            active_calls -= 1

        # Return mock response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "hypotheses": [
                                    {
                                        "rank": 1,
                                        "hypothesis": "H1",
                                        "confidence_score": 0.9,
                                        "evidence": ["E1"],
                                        "recommended_action": "A1",
                                    },
                                    {
                                        "rank": 2,
                                        "hypothesis": "H2",
                                        "confidence_score": 0.7,
                                        "evidence": ["E2"],
                                        "recommended_action": "A2",
                                    },
                                    {
                                        "rank": 3,
                                        "hypothesis": "H3",
                                        "confidence_score": 0.5,
                                        "evidence": ["E3"],
                                        "recommended_action": "A3",
                                    },
                                ]
                            }
                        )
                    }
                }
            ]
        }
        return mock_response

    # Patch the post method to record active calls
    with patch.object(client.client, "post", side_effect=mock_post):
        # Fire 15 concurrent requests
        tasks = [client.get_reasoning("sys", f"user-{i}") for i in range(15)]
        await asyncio.gather(*tasks)

        # Verify that max concurrency observed was at most 10
        assert max_observed_concurrency <= 10
        assert max_observed_concurrency > 0
