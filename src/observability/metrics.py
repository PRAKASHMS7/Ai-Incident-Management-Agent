"""
Prometheus Metrics definitions for the Incident Management Agent.
"""
from prometheus_client import Gauge, Counter, Histogram

# 1. Heartbeat
incident_agent_heartbeat = Gauge(
    "incident_agent_heartbeat",
    "Current timestamp representing the last heartbeat check of the watchdog daemon"
)

# 2. Incidents
incidents_detected_total = Counter(
    "incidents_detected_total",
    "Total number of incidents correlated and tracked",
    ["severity", "initial_service"]
)

# 3. Deduplicated Alerts
alert_deduplicated_total = Counter(
    "alert_deduplicated_total",
    "Total alerts dropped at deduplication layer",
    ["service", "alertname"]
)

# 4. LLM Latency
llm_reasoning_latency_seconds = Histogram(
    "llm_reasoning_latency_seconds",
    "Latency of Llama inference calls through the Groq API",
    ["attempt_count", "status"]
)

# 5. LLM Token Usage
llm_token_usage_total = Counter(
    "llm_token_usage_total",
    "Token usage accumulation totals from Groq calls",
    ["type"]  # prompt_tokens / completion_tokens
)

# 6. Slack Deliveries
slack_escalation_delivery_total = Counter(
    "slack_escalation_delivery_total",
    "Total interactive cards delivered to Slack channels",
    ["channel", "status"]
)

# 7. Operator Ack duration
operator_acknowledgement_duration_seconds = Histogram(
    "operator_acknowledgement_duration_seconds",
    "Duration between alert escalation and human operator acknowledgement"
)

# 8. Fallbacks
fallback_diagnostics_total = Counter(
    "fallback_diagnostics_total",
    "Total triggers of LLM reasoning fallback safety mode"
)
