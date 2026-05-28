"""
Loki Logging Service Client.

Queries Grafana Loki log traces (filtering exceptions, errors, failures)
using connection pooling, rate-limiting semaphores, and 60-second Redis caching.
"""

import asyncio
import logging
from datetime import datetime
from typing import List, Any
import httpx

from src.config import settings
from src.database.redis_client import redis_manager
from src.api.schemas import LogLine
from src.observability.tracer import tracer

logger = logging.getLogger(__name__)

# Throttling semaphore to restrict parallel connections
loki_semaphore = asyncio.Semaphore(5)


class LokiClient:
    """
    Asynchronous client for querying error log traces from Grafana Loki.
    """

    def __init__(self, base_url: str = settings.LOKI_URL) -> None:
        self.base_url = base_url.rstrip("/")
        limits = httpx.Limits(max_keepalive_connections=5, max_connections=20)
        self.client = httpx.AsyncClient(limits=limits, timeout=5.0)

    async def get_logs(
        self, service_name: str, starts_at: datetime, ends_at: datetime, limit: int = 50
    ) -> str:
        """
        Gathers error and exception logs for a microservice.
        Checks Redis cache first. Returns a formatted summary text block.
        """
        with tracer.start_as_current_span("loki.get_logs") as span:
            span.set_attribute("service.name", service_name)
            span.set_attribute("starts_at", starts_at.isoformat())
            span.set_attribute("ends_at", ends_at.isoformat())

            # 1. Round timestamps to nearest 30 seconds for cache mapping
            rounded_start = int(starts_at.timestamp() // 30) * 30
            rounded_end = int(ends_at.timestamp() // 30) * 30
            cache_key = (
                f"telemetry:cache:loki:{service_name}:{rounded_start}:{rounded_end}"
            )

            # 2. Redis Cache Lookup
            try:
                r_client = redis_manager.get_client()
                cached_val = r_client.get(cache_key)
                if cached_val is not None:
                    logger.info("Loki log telemetry CACHE HIT for %s", service_name)
                    span.set_attribute("redis.cache_hit", True)
                    return cached_val
                span.set_attribute("redis.cache_hit", False)
                logger.info("Loki log telemetry CACHE MISS for %s", service_name)
            except Exception as e:
                logger.warning("Failed to query Redis cache for Loki logs: %s", str(e))

            # 3. Cache Miss: Execute Query
            # Convert datetime timestamps to nanoseconds for Loki
            start_ns = int(starts_at.timestamp() * 1_000_000_000)
            end_ns = int(ends_at.timestamp() * 1_000_000_000)

            logql_query = f'{{container=~"{service_name}.*"}} |~ "(?i)error|exception|fail|panic|stacktrace"'

            data = None
            async with loki_semaphore:
                url = f"{self.base_url}/loki/api/v1/query_range"
                params: dict[str, Any] = {
                    "query": logql_query,
                    "start": start_ns,
                    "end": end_ns,
                    "limit": limit,
                }
                with tracer.start_as_current_span("loki.query_range") as query_span:
                    query_span.set_attribute("loki.query", logql_query)
                    try:
                        response = await self.client.get(url, params=params)
                        query_span.set_attribute(
                            "http.status_code", response.status_code
                        )
                        if response.status_code == 200:
                            data = response.json()
                        else:
                            data = {
                                "error": f"HTTP {response.status_code}: {response.text}"
                            }
                    except Exception as e:
                        logger.error(
                            "Loki query range failed for %s: %s", service_name, str(e)
                        )
                        query_span.record_exception(e)
                        data = {"error": str(e)}

        # 4. Parse response streams
        log_lines: List[LogLine] = []
        telemetry_lines = [
            f"=== Loki Log Telemetry Summary for service: {service_name} ===",
            f"Query Window: {starts_at.isoformat()} to {ends_at.isoformat()}",
        ]

        if "error" in data:
            telemetry_lines.append(f"Logs query failed: {data['error']}")
            summary = "\n".join(telemetry_lines)
        else:
            streams = data.get("data", {}).get("result", [])
            for stream_item in streams:
                stream_labels = stream_item.get("stream", {})
                for val_pair in stream_item.get("values", []):
                    # val_pair format: [timestamp_ns_string, line_string]
                    ts_ns = int(val_pair[0])
                    ts_sec = ts_ns / 1_000_000_000
                    ts_dt = datetime.fromtimestamp(ts_sec)
                    log_lines.append(
                        LogLine(
                            timestamp=ts_dt.isoformat(),
                            stream=stream_labels,
                            message=val_pair[1],
                        )
                    )

            # Sort log lines chronologically
            log_lines.sort(key=lambda x: x.timestamp)

            # Truncate to limit
            log_lines = log_lines[:limit]

            if not log_lines:
                telemetry_lines.append("No matching error or exception logs found.")
                summary = "\n".join(telemetry_lines)
            else:
                telemetry_lines.append(
                    f"Retrieved {len(log_lines)} relevant error log lines:"
                )

                # Check character truncation constraints (e.g. 5,000 characters total for log messages)
                total_chars = 0
                max_chars = 5000
                is_truncated = False

                for line in log_lines:
                    log_entry = f"[{line.timestamp}] {line.message.strip()}"
                    if total_chars + len(log_entry) > max_chars:
                        is_truncated = True
                        break
                    telemetry_lines.append(log_entry)
                    total_chars += len(log_entry)

                if is_truncated:
                    telemetry_lines.append(
                        "[... Log trace truncated to protect LLM context windows ...]"
                    )

                summary = "\n".join(telemetry_lines)

        # 5. Write to Redis Cache (60s TTL)
        try:
            r_client = redis_manager.get_client()
            r_client.set(cache_key, summary, ex=60)
        except Exception as e:
            logger.warning("Failed to cache Loki query range results: %s", str(e))

        return summary

    async def close(self) -> None:
        """
        Closes the underlying async client.
        """
        await self.client.aclose()


# Global singleton client
loki_client = LokiClient()
