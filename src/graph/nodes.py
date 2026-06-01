"""
LangGraph Workflow Nodes Module.

Defines the individual execution steps (nodes) for the incident reasoning pipeline.
"""

import json
import logging
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, cast

from src.api.schemas import (
    TimelineItem,
    Hypothesis,
)
from src.database.redis_client import redis_manager
from src.database.neo4j_client import neo4j_manager
from src.services import prom_client, loki_client, groq_client
from src.observability.metrics import fallback_diagnostics_total

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a Senior Staff Site Reliability Engineer (SRE) and AI Systems Diagnostic Specialist.
Your objective is to diagnose system incidents by evaluating:
1. Alert events (Triggering conditions, service scopes, and severities).
2. Service topology (Upstream and downstream dependencies, database backends).
3. Prometheus metrics (CPU, Memory, HTTP rates, latencies, error rates).
4. Loki logs (Exception stack traces, warning patterns, connection timeouts).

---
DIAGNOSTIC METHODOLOGY & SRE PRINCIPLES:
- Cascade Failure Tracing: Analyze if errors originate in downstream components (e.g. database, auth service) and propagate upstream to client-facing services (e.g. gateway).
- Saturation Analysis: Look for resource bottlenecks (e.g., CPU exhaustion, database connection pool exhaustion, memory leak limits).
- Evidence Alignment: Every hypothesis must be backed by specific data points from the provided telemetry. Never speculate without citing logs or metrics.

---
OUTPUT FORMAT CONSTRAINTS:
- You must output exactly 3 ranked hypotheses, ordered from highest confidence to lowest confidence.
- You must return ONLY a raw JSON object matching the schema below.
- Do NOT wrap your output in markdown code fence blocks (e.g., do not use ```json ... ```).
- Do NOT include any intro, outro, conversational filler, or explanations outside the JSON object.

---
JSON OUTPUT SCHEMA:
{
  "hypotheses": [
    {
      "rank": 1,
      "hypothesis": "Detailed explanation of the proposed root cause (e.g., Database connection pool exhaustion on payment-db due to sudden write spikes)",
      "confidence_score": 0.95,
      "evidence": [
        "Loki error: 'ConnectionAcquisitionTimeoutException' on payment-service at 12:01:05",
        "Prometheus http_requests_total showing HTTP 500 error rate at 85% on payment-service"
      ],
      "recommended_action": "Remediation steps for SRE operators (e.g., Check database active connections, increase pool size configuration, or restart payment-service pods)"
    },
    ...
  ]
}"""


class WorkflowNodes:
    """
    Implements the execution methods for each node in the LangGraph workflow.
    """

    @staticmethod
    async def initialize_state(state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Reads the triggering incident details from Redis and sets up the initial state.
        """
        incident_id = cast(str, state.get("incident_id"))
        logger.info("Node [InitializeState] starting for incident: %s", incident_id)

        incident = await asyncio.to_thread(redis_manager.get_incident, incident_id)
        if not incident:
            logger.error("Incident %s not found in Redis state. Halting.", incident_id)
            return {"state": "failed"}

        return {
            "incident_id": incident.id,
            "state": "analyzing",
            "services_affected": list(incident.services_affected),
            "raw_alerts": incident.alerts,
            "collected_metrics": {},
            "collected_logs": {},
            "retry_count": 0,
            "validation_error_message": None,
            "timeline": incident.timeline,
            "hypotheses": [],
        }

    @staticmethod
    async def fetch_topology(state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Traverses the Neo4j dependency graph to find direct upstreams/downstreams
        for all affected services, creating an expanded list for metrics/logs collection.
        """
        logger.info(
            "Node [FetchTopology] executing for incident: %s", state.get("incident_id")
        )
        services = state.get("services_affected", [])
        expanded = set(services)

        # Traverse neighbors (depth = 1) for each service using asyncio.to_thread
        for svc in services:
            try:
                upstreams = await asyncio.to_thread(neo4j_manager.get_upstreams, svc)
                downstreams_raw = await asyncio.to_thread(
                    neo4j_manager.get_downstreams, svc
                )
                downstreams = [
                    d["name"] for d in downstreams_raw if d["type"] == "Service"
                ]

                expanded.update(upstreams)
                expanded.update(downstreams)
            except Exception as e:
                logger.warning(
                    "Could not fetch dependency neighbors for %s: %s", svc, str(e)
                )

        logger.info("Expanded analysis scope services: %s", list(expanded))
        return {"expanded_topology_services": list(expanded)}

    @staticmethod
    async def gather_telemetry(state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Queries Prometheus and Loki concurrently for all expanded services.
        """
        logger.info(
            "Node [GatherTelemetry] executing for incident: %s",
            state.get("incident_id"),
        )
        services = state.get("expanded_topology_services", [])
        raw_alerts = state.get("raw_alerts", [])

        # Find time boundary around the earliest alert trigger time
        if raw_alerts:
            earliest_time = min([a.starts_at for a in raw_alerts])
        else:
            earliest_time = datetime.now()

        starts_at = earliest_time - timedelta(minutes=5)
        ends_at = earliest_time + timedelta(minutes=5)

        all_tasks = []
        # Concurrently query Prometheus and Loki in parallel
        for svc in services:
            all_tasks.append(prom_client.get_metrics(svc, starts_at, ends_at))
        for svc in services:
            all_tasks.append(loki_client.get_logs(svc, starts_at, ends_at))

        results = await asyncio.gather(*all_tasks)

        n_svc = len(services)
        collected_metrics = {services[i]: results[i] for i in range(n_svc)}
        collected_logs = {services[i]: results[n_svc + i] for i in range(n_svc)}

        return {
            "collected_metrics": collected_metrics,
            "collected_logs": collected_logs,
        }

    @staticmethod
    async def llm_reasoning(state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sends aggregated context to Llama 3.1 70B via Groq API.
        Handles context assembly, JSON parsing, Pydantic schema validation, and fallback modes.
        """
        incident_id = state.get("incident_id")
        retry_count = state.get("retry_count", 0)
        logger.info(
            "Node [LLMReasoning] starting (attempt %d) for incident: %s",
            retry_count + 1,
            incident_id,
        )

        # Check primary alert name for mock/testing triggers
        trigger_alert_name = ""
        raw_alerts = state.get("raw_alerts", [])
        if raw_alerts:
            trigger_alert_name = raw_alerts[0].name

        # ----------------------------------------------------
        # TEST LOOP TRIGGERS (Self-Correction/Fallback Testing)
        # ----------------------------------------------------
        if trigger_alert_name == "TestCrashAlert":
            client = redis_manager.get_client()
            crash_key = f"test:crashed:{incident_id}"
            if not client.get(crash_key):
                client.set(crash_key, "1", ex=60)
                logger.info("Simulating database crash error for TestCrashAlert")
                raise ValueError("Database error!")
            logger.info("Resuming TestCrashAlert execution successfully.")

        if trigger_alert_name == "TestRetryLoopAlert" and retry_count == 0:
            logger.info(
                "Simulating malformed JSON output for TestRetryLoopAlert (attempt 0)"
            )
            return {
                "validation_error_message": "Malformed JSON structure: incomplete closing brackets."
            }

        if trigger_alert_name == "TestFallbackAlert" and retry_count < 3:
            logger.info(
                "Simulating persistent JSON failure for TestFallbackAlert (attempt %d)",
                retry_count,
            )
            return {
                "validation_error_message": "Persistent model validation JSON exception."
            }

        # 1. Assemble context blocks
        alerts_section = "=== ACTIVE ALERT EVENTS ===\n"
        for alert in state.get("raw_alerts", []):
            alerts_section += (
                f"- Alert: {alert.name}\n"
                f"  Service: {alert.service}\n"
                f"  Severity: {alert.severity}\n"
                f"  Trigger Time: {alert.starts_at.isoformat()}\n"
                f"  Description: {alert.description}\n"
            )

        topology_section = "=== SERVICE DEPENDENCY GRAPH ===\n"
        topology_section += (
            f"Affected Services: {', '.join(state.get('services_affected', []))}\n"
        )
        topology_section += f"Analysis Scope Services: {', '.join(state.get('expanded_topology_services', []))}\n"
        for svc in state.get("services_affected", []):
            try:
                upstreams = await asyncio.to_thread(neo4j_manager.get_upstreams, svc)
                downstreams_raw = await asyncio.to_thread(
                    neo4j_manager.get_downstreams, svc
                )
                downstreams = [d["name"] for d in downstreams_raw]
                topology_section += (
                    f"Service: {svc}\n"
                    f"  - Upstreams (depend on this service): {upstreams}\n"
                    f"  - Downstreams (this service depends on): {downstreams}\n"
                )
            except Exception as e:
                logger.warning(
                    "Could not append dependency paths for %s: %s", svc, str(e)
                )

        metrics_section = "=== PROMETHEUS METRIC SIGNALS ===\n"
        for svc, summary in state.get("collected_metrics", {}).items():
            metrics_section += f"{summary}\n\n"

        logs_section = "=== LOKI CRITICAL LOG TRACES ===\n"
        for svc, summary in state.get("collected_logs", {}).items():
            logs_section += f"{summary}\n\n"

        feedback_section = ""
        if state.get("validation_error_message"):
            feedback_section = (
                "\n=== SELF-CORRECTION FEEDBACK ===\n"
                f"Your previous output was invalid. Error: {state.get('validation_error_message')}\n"
                "Please analyze the telemetry again, correct the formatting/schema mistakes, and output valid JSON matching the schema.\n"
            )

        user_prompt = (
            f"{alerts_section}\n"
            f"{topology_section}\n"
            f"{metrics_section}\n"
            f"{logs_section}\n"
            f"{feedback_section}"
        )

        # 2. Query reasoning engine via groq_client
        try:
            raw_response = await groq_client.get_reasoning(
                system_prompt=SYSTEM_PROMPT, user_prompt=user_prompt
            )

            # Clean response of potential markdown wrappers
            cleaned_response = raw_response.strip()
            if cleaned_response.startswith("```json"):
                cleaned_response = cleaned_response[7:]
            if cleaned_response.endswith("```"):
                cleaned_response = cleaned_response[:-3]
            cleaned_response = cleaned_response.strip()

            # Validate JSON parses
            parsed_json = json.loads(cleaned_response)

            # Enforce schema validation via Pydantic
            from src.api.schemas import ReasoningOutput

            validated_output = ReasoningOutput.model_validate(parsed_json)

            logger.info(
                "LLM Reasoning succeeded and schema validated for incident: %s",
                incident_id,
            )
            return {
                "validation_error_message": None,
                "hypotheses": validated_output.hypotheses,
            }
        except json.JSONDecodeError as e:
            logger.warning(
                "LLM returned malformed JSON on incident %s: %s", incident_id, str(e)
            )
            return {
                "validation_error_message": f"JSONDecodeError: Malformed JSON structure. Please output raw valid JSON only. Error details: {str(e)}"
            }
        except Exception as e:
            # Pydantic validation error or API outage/timeout (after tenacity retries)
            # Check if this was a failure to query Groq completely (e.g. outage)
            if (
                not isinstance(e, ValueError)
                and "ValidationError" not in str(e)
                and "ReasoningOutput" not in str(e)
            ):
                logger.error(
                    "Groq reasoning engine failed completely: %s. Entering safety fallback mode.",
                    str(e),
                )
                fallback_diagnostics_total.inc()
                fallback = Hypothesis(
                    rank=1,
                    hypothesis="Safety Fallback Diagnostic: Groq AI Reasoning service is currently unreachable or timed out.",
                    confidence_score=0.1,
                    evidence=["API client connection exception"],
                    recommended_action="Inspect Groq API status or check logs manually.",
                )
                return {"validation_error_message": None, "hypotheses": [fallback]}

            # Formatting or schema validation error
            logger.warning(
                "Reasoning parsing / schema validation exception for incident %s: %s",
                incident_id,
                str(e),
            )
            return {"validation_error_message": f"ValidationError: {str(e)}"}

    @staticmethod
    async def rank_hypotheses(state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Acts as the parsing router. Validates JSON schemas and checks retry count limits.
        """
        logger.info(
            "Node [RankHypotheses] executing for incident: %s", state.get("incident_id")
        )

        # If there's a validation error, we routing based on retry counts
        val_error = state.get("validation_error_message")
        if val_error:
            # Increment retry count
            current_retry = state.get("retry_count", 0) + 1
            if current_retry < 3:
                logger.warning(
                    "Hypothesis validation failed: %s. Triggering correction loop.",
                    val_error,
                )
                return {
                    "retry_count": current_retry,
                    "validation_error_message": val_error,
                }
            else:
                # Fallback path triggered (max retries reached)
                logger.error(
                    "Max LLM reasoning retries reached. Triggering fallback hypothesis."
                )
                fallback_diagnostics_total.inc()
                fallback = Hypothesis(
                    rank=1,
                    hypothesis="Safety Fallback Diagnostic: Unspecified cascading latency spikes. Target metrics are unreachable or reasoning engine failed to format structure.",
                    confidence_score=0.1,
                    evidence=["Ingested firing alert inputs"],
                    recommended_action="Deploy SRE operators to trace metrics manually.",
                )
                return {
                    "retry_count": current_retry,
                    "validation_error_message": None,
                    "hypotheses": [fallback],
                }

        # If hypotheses are valid, we continue
        return {"validation_error_message": None}

    @staticmethod
    async def slack_escalation(state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Formatively maps findings and triggers Slack Bolt deliveries.
        """
        incident_id = cast(str, state.get("incident_id"))
        logger.info("Node [SlackEscalation] executing for incident: %s", incident_id)

        # Save hypotheses in Redis before posting to Slack, so the Slack client can access them
        incident = await asyncio.to_thread(redis_manager.get_incident, incident_id)
        if incident:
            incident.hypotheses = state.get("hypotheses", [])
            incident.updated_at = datetime.now()
            await asyncio.to_thread(redis_manager.save_incident, incident)

        # Import dynamically to avoid circular references if any
        from src.services.slack_client import slack_client

        await slack_client.post_escalation_card(incident_id)

        return {}

    @staticmethod
    async def timeline_rca_info(state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Finalizes timeline steps, builds final RCA document draft, and updates Redis database.
        """
        incident_id = cast(str, state.get("incident_id"))
        logger.info("Node [TimelineRCAInfo] starting for incident: %s", incident_id)

        incident = await asyncio.to_thread(redis_manager.get_incident, incident_id)
        if not incident:
            return {}

        # Update incident timeline with reasoning steps
        incident.timeline.append(
            TimelineItem(
                timestamp=datetime.now(timezone.utc),
                event_type="agent_milestone",
                source="system",
                message="Incident escalation card dispatched to Slack operators channel.",
                severity="info",
            )
        )

        # Compile hypotheses
        incident.hypotheses = state.get("hypotheses", [])
        incident.state = "escalated"
        incident.updated_at = datetime.now()

        # Save finalized state back to Redis
        await asyncio.to_thread(redis_manager.save_incident, incident)
        logger.info(
            "Incident %s successfully finalized in database (state=escalated).",
            incident_id,
        )

        return {"state": "completed", "timeline": incident.timeline}
