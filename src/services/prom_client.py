"""
Prometheus Telemetry Service Client.

Queries Prometheus metrics (CPU, Memory, request throughput, error rates, p99 latency)
using connection pooling, rate-limiting semaphores, and 60-second Redis caching.
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any
import httpx

from src.config import settings
from src.database.redis_client import redis_manager
from src.api.schemas import MetricPoint, MetricSeries
from src.observability.tracer import tracer

logger = logging.getLogger(__name__)

# Throttling semaphore to restrict parallel connections
prom_semaphore = asyncio.Semaphore(5)


class PrometheusClient:
    """
    Asynchronous client for querying metric telemetry from Prometheus.
    """

    def __init__(self, base_url: str = settings.PROMETHEUS_URL) -> None:
        self.base_url = base_url.rstrip("/")
        # Initialize connection pool parameters
        limits = httpx.Limits(max_keepalive_connections=5, max_connections=20)
        self.client = httpx.AsyncClient(limits=limits, timeout=5.0)

    async def get_metrics(
        self, service_name: str, starts_at: datetime, ends_at: datetime
    ) -> str:
        """
        Gathers system telemetry (golden signals) for a service.
        Checks Redis cache first. Returns a formatted summary string.
        """
        with tracer.start_as_current_span("prometheus.get_metrics") as span:
            span.set_attribute("service.name", service_name)
            span.set_attribute("starts_at", starts_at.isoformat())
            span.set_attribute("ends_at", ends_at.isoformat())

            # 1. Round timestamps to nearest 30 seconds for caching groups
            rounded_start = int(starts_at.timestamp() // 30) * 30
            rounded_end = int(ends_at.timestamp() // 30) * 30
            cache_key = f"telemetry:cache:prometheus:{service_name}:{rounded_start}:{rounded_end}"

            # 2. Redis Cache Lookup
            try:
                r_client = redis_manager.get_client()
                cached_val = r_client.get(cache_key)
                if cached_val is not None:
                    logger.info("Prometheus telemetry CACHE HIT for %s", service_name)
                    span.set_attribute("redis.cache_hit", True)
                    return cached_val
                span.set_attribute("redis.cache_hit", False)
                logger.info("Prometheus telemetry CACHE MISS for %s", service_name)
            except Exception as e:
                logger.warning(
                    "Failed to query Redis cache for Prometheus telemetry: %s", str(e)
                )

            # 3. Cache Miss: Execute Queries in Parallel
            start_unix = int(starts_at.timestamp())
            end_unix = int(ends_at.timestamp())

            # Determine step interval (e.g. 15s step)
            step = "15s"

            queries = {
                "CPU_Utilization": f"sum(rate(container_cpu_usage_seconds_total{{container=~'{service_name}'}}[2m])) by (pod)",
                "Memory_Usage_Bytes": f"sum(container_memory_working_set_bytes{{container=~'{service_name}'}}) by (pod)",
                "Request_Volume_Rate": f"sum(rate(http_requests_total{{service=~'{service_name}'}}[2m])) by (status)",
                "Http_5xx_Error_Rate": f"sum(rate(http_requests_total{{service=~'{service_name}', status=~'5..'}}[2m]))",
                "p99_Latency_Seconds": f"histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{{service=~'{service_name}'}}[5m])) by (le))",
            }

            tasks = []
            for name, query in queries.items():
                tasks.append(
                    self._query_range_with_semaphore(
                        name, query, start_unix, end_unix, step
                    )
                )

            results = await asyncio.gather(*tasks)

            # 4. Process and Format Telemetry Summary
            telemetry_lines = [
                f"=== Prometheus Telemetry Summary for service: {service_name} ===",
                f"Query Window: {starts_at.isoformat()} to {ends_at.isoformat()}",
            ]

            has_data = False
            series_list = []

            for name, data in results:
                if "error" in data:
                    telemetry_lines.append(
                        f"- {name}: Telemetry query failed ({data['error']})"
                    )
                    continue

                metrics_data = data.get("data", {}).get("result", [])
                if not metrics_data:
                    telemetry_lines.append(f"- {name}: No metrics data found.")
                    continue

                has_data = True
                telemetry_lines.append(
                    f"- {name}: {len(metrics_data)} timeseries returned."
                )

                # Standardize for models representation
                for result_item in metrics_data:
                    labels = result_item.get("metric", {})
                    values = [
                        MetricPoint(timestamp=float(p[0]), value=float(p[1]))
                        for p in result_item.get("values", [])
                    ]
                    series_list.append(
                        MetricSeries(metric_name=name, labels=labels, values=values)
                    )

                    # Append sample values for context formatting
                    sample_vals = [
                        f"{v.value:.4f}@{datetime.fromtimestamp(v.timestamp).strftime('%H:%M:%S')}"
                        for v in values[-3:]
                    ]
                    telemetry_lines.append(
                        f"  * Labels: {labels} | Recent Points: {', '.join(sample_vals)}"
                    )

            if not has_data:
                summary = (
                    "\n".join(telemetry_lines)
                    + "\nNo telemetry indicators collected (observability gaps or silent period)."
                )
            else:
                summary = "\n".join(telemetry_lines)

            # 5. Write to Redis Cache (60s TTL)
            try:
                r_client = redis_manager.get_client()
                r_client.set(cache_key, summary, ex=60)
            except Exception as e:
                logger.warning(
                    "Failed to cache Prometheus query range results: %s", str(e)
                )

            return summary

    async def _query_range_with_semaphore(
        self, name: str, query: str, start: int, end: int, step: str
    ) -> tuple[str, Dict[str, Any]]:
        """
        Executes a range query with concurrency throttling.
        """
        with tracer.start_as_current_span("prometheus.query_range") as span:
            span.set_attribute("prometheus.query", query)
            span.set_attribute("prometheus.metric_name", name)
            async with prom_semaphore:
                url = f"{self.base_url}/api/v1/query_range"
                params: dict[str, Any] = {
                    "query": query,
                    "start": start,
                    "end": end,
                    "step": step,
                }
                try:
                    response = await self.client.get(url, params=params)
                    span.set_attribute("http.status_code", response.status_code)
                    if response.status_code == 200:
                        return name, response.json()
                    return name, {
                        "error": f"HTTP {response.status_code}: {response.text}"
                    }
                except Exception as e:
                    logger.error(
                        "Prometheus range query failed for %s: %s", name, str(e)
                    )
                    span.record_exception(e)
                    return name, {"error": str(e)}

    async def close(self) -> None:
        """
        Closes the underlying async client.
        """
        await self.client.aclose()


# Global singleton client
prom_client = PrometheusClient()
