"""
Groq LLM Reasoning Engine Client.

Interacts with Llama 3.1 70B via the OpenAI-compatible Groq API,
featuring Tenacity retries on HTTP 429/5xx, JSON mode enforcement,
and mock support for offline testing.
"""

import logging
import json
import httpx
import time
import asyncio
from typing import Dict, Any
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception,
    before_sleep_log,
)

from src.config import settings
from src.observability.tracer import tracer
from src.observability.metrics import (
    llm_reasoning_latency_seconds,
    llm_token_usage_total,
)

logger = logging.getLogger(__name__)


def is_retryable(exception: BaseException) -> bool:
    """Checks if the exception is retryable (429, 5xx, or network issues)."""
    if isinstance(exception, httpx.HTTPStatusError):
        status_code = exception.response.status_code
        return status_code == 429 or (status_code >= 500 and status_code < 600)
    if isinstance(
        exception, (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError)
    ):
        return True
    return False


class GroqClient:
    """
    Client for interacting with Groq Chat Completion API.
    """

    def __init__(self, api_key: str = settings.GROQ_API_KEY) -> None:
        self.api_key = api_key
        self.base_url = "https://api.groq.com/openai/v1/chat/completions"
        self._clients: Dict[asyncio.AbstractEventLoop, httpx.AsyncClient] = {}
        self._semaphores: Dict[asyncio.AbstractEventLoop, asyncio.Semaphore] = {}

    @property
    def client(self) -> httpx.AsyncClient:
        """Returns an httpx.AsyncClient bound to the currently running event loop."""
        loop = asyncio.get_running_loop()
        if loop not in self._clients:
            self._clients[loop] = httpx.AsyncClient(timeout=10.0)
        return self._clients[loop]

    @property
    def semaphore(self) -> asyncio.Semaphore:
        """Returns an asyncio.Semaphore bound to the currently running event loop."""
        loop = asyncio.get_running_loop()
        if loop not in self._semaphores:
            self._semaphores[loop] = asyncio.Semaphore(10)
        return self._semaphores[loop]

    @retry(
        retry=retry_if_exception(is_retryable),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=16),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    async def _post_chat_completion(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Performs the POST request to the Groq Chat Completion API.
        Protected by tenacity retry logic.
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        logger.info("Sending request to Groq API using model: %s", payload.get("model"))
        async with self.semaphore:
            response = await self.client.post(
                self.base_url, headers=headers, json=payload
            )
            response.raise_for_status()
            return response.json()

    async def get_reasoning(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str = "llama-3.3-70b-versatile",
        temperature: float = 0.1,
    ) -> str:
        """
        Assembles prompts, calls the chat completion endpoint, and returns the response string.
        Supports mock return if key is "mock_key".
        """
        with tracer.start_as_current_span("groq.get_reasoning") as span:
            span.set_attribute("llm.model", model)
            span.set_attribute("llm.temperature", temperature)

            start_time = time.time()

            # 1. Mock SRE support for local testing
            if self.api_key == "mock_key":
                logger.info("Mock Groq Client triggered. Bypassing HTTP call.")

                # Default mock JSON object that matches the expected SRE output
                mock_data = {
                    "hypotheses": [
                        {
                            "rank": 1,
                            "hypothesis": "Database connection pool exhaustion on target service database due to spikes.",
                            "confidence_score": 0.88,
                            "evidence": [
                                "HTTP 5xx rate high",
                                "Pool timeout logs in Loki client query",
                            ],
                            "recommended_action": "Verify database pool configs or cycle microservice pods.",
                        },
                        {
                            "rank": 2,
                            "hypothesis": "Upstream route latency propagation due to network gateway timeouts",
                            "confidence_score": 0.65,
                            "evidence": [
                                "p99 Latency spikes reported in Prometheus metrics"
                            ],
                            "recommended_action": "Check gateway routes and network configurations.",
                        },
                        {
                            "rank": 3,
                            "hypothesis": "Transient system microservice load spikes",
                            "confidence_score": 0.35,
                            "evidence": [
                                "CPU metrics reached capacity limit during alert startsAt"
                            ],
                            "recommended_action": "Increase service CPU limits in deployments configurations.",
                        },
                    ]
                }
                latency = time.time() - start_time
                llm_reasoning_latency_seconds.labels(
                    attempt_count="1", status="success"
                ).observe(latency)
                llm_token_usage_total.labels(type="prompt_tokens").inc(120)
                llm_token_usage_total.labels(type="completion_tokens").inc(85)
                return json.dumps(mock_data)

            # 2. Build HTTP request payload
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": temperature,
                "response_format": {"type": "json_object"},
            }

            try:
                res_json = await self._post_chat_completion(payload)
                content = res_json["choices"][0]["message"]["content"]

                # Extract and record token usage metrics from Groq API response metadata
                usage = res_json.get("usage", {})
                prompt_tokens = usage.get("prompt_tokens", 0)
                completion_tokens = usage.get("completion_tokens", 0)
                llm_token_usage_total.labels(type="prompt_tokens").inc(prompt_tokens)
                llm_token_usage_total.labels(type="completion_tokens").inc(
                    completion_tokens
                )

                latency = time.time() - start_time
                llm_reasoning_latency_seconds.labels(
                    attempt_count="1", status="success"
                ).observe(latency)

                logger.debug("Received raw response from Groq: %s", content)
                return content
            except httpx.HTTPStatusError as e:
                latency = time.time() - start_time
                llm_reasoning_latency_seconds.labels(
                    attempt_count="1", status="failed"
                ).observe(latency)
                logger.error(
                    "Groq API error (status code %d): %s",
                    e.response.status_code,
                    e.response.text,
                )
                span.record_exception(e)
                raise e
            except Exception as e:
                latency = time.time() - start_time
                llm_reasoning_latency_seconds.labels(
                    attempt_count="1", status="failed"
                ).observe(latency)
                logger.error("Failed to query Groq API: %s", str(e))
                span.record_exception(e)
                raise e

    async def close(self) -> None:
        """Closes all underlying HTTP clients."""
        for client in self._clients.values():
            await client.aclose()
        self._clients.clear()


# Singleton instance
groq_client = GroqClient()
