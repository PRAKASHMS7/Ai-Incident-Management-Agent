"""
RCA and Timeline Generation Service.

Provides timeline sorting, event aggregation, markdown report rendering,
optional Groq summary generation, and dual storage persistence (Redis + Local File).
"""

import os
import json
import logging
import asyncio
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path

from src.config import settings
from src.database.redis_client import redis_manager
from src.api.schemas import IncidentStateModel, TimelineItem, Hypothesis
from src.services.groq_client import groq_client

logger = logging.getLogger(__name__)

# Severity priority ordering (lowest integer = highest priority)
SEVERITY_ORDER = {
    "critical": 0,
    "error": 1,
    "warning": 2,
    "info": 3
}

# Source priority ordering (lowest integer = highest priority)
SOURCE_ORDER = {
    "prometheus": 0,
    "loki": 1,
    "system": 2,
    "slack_operator": 3
}

class RCAGenerator:
    """
    Service for timeline processing and post-mortem RCA report compilation.
    """

    @staticmethod
    def sort_timeline(timeline: List[TimelineItem]) -> List[TimelineItem]:
        """
        Sorts timeline items:
        1. Ascending chronological order (timestamp)
        2. Severity precedence (critical > error > warning > info)
        3. Source precedence (prometheus > loki > system > slack_operator)
        """
        def sort_key(item: TimelineItem):
            sev = item.severity.lower() if item.severity else "info"
            src = item.source.lower() if item.source else "system"
            
            sev_rank = SEVERITY_ORDER.get(sev, 4)
            src_rank = SOURCE_ORDER.get(src, 4)
            return (item.timestamp, sev_rank, src_rank)

        return sorted(timeline, key=sort_key)

    @classmethod
    async def generate_executive_summary(
        cls, 
        incident_id: str, 
        services: List[str], 
        timeline: List[TimelineItem], 
        hypotheses: List[Hypothesis]
    ) -> str:
        """
        Queries Groq to write a professional executive summary of the incident.
        Falls back to a structured programmatic summary if Groq fails or is disabled.
        """
        # Determine if Groq should be called (if API key is default/mock, skip and use fallback)
        if settings.GROQ_API_KEY == "mock_key" or not settings.GROQ_API_KEY:
            logger.info("Using programmatic fallback executive summary (Groq API key not set).")
            return cls._fallback_summary(incident_id, services, timeline, hypotheses)

        # Assemble brief telemetry context for summary generation
        summary_context = {
            "incident_id": incident_id,
            "services_affected": services,
            "hypotheses": [{"rank": h.rank, "hypothesis": h.hypothesis} for h in hypotheses],
            "timeline": [{"timestamp": t.timestamp.isoformat(), "source": t.source, "message": t.message} for t in timeline]
        }

        system_prompt = (
            "You are a Senior Staff Site Reliability Engineer (SRE). "
            "Write a concise, professional 2-3 sentence executive summary of the incident "
            "focusing on the impact, root cause, and remediation. "
            "Do NOT include conversational filler, headers, intro, or markdown formatting. Output plain text only."
        )
        user_prompt = f"Context payload:\n{json.dumps(summary_context, indent=2)}"

        try:
            summary = await groq_client.get_reasoning(
                system_prompt=system_prompt,
                user_prompt=user_prompt
            )
            return summary.strip()
        except Exception as e:
            logger.error("Failed to generate executive summary via Groq: %s. Using fallback.", str(e))
            return cls._fallback_summary(incident_id, services, timeline, hypotheses)

    @staticmethod
    def _fallback_summary(
        incident_id: str, 
        services: List[str], 
        timeline: List[TimelineItem], 
        hypotheses: List[Hypothesis]
    ) -> str:
        """
        Programmatic summary helper.
        """
        services_str = ", ".join(services) if services else "unknown services"
        detected_at = "unknown time"
        resolved_at = "unknown time"
        
        if timeline:
            sorted_t = sorted(timeline, key=lambda x: x.timestamp)
            detected_at = sorted_t[0].timestamp.strftime("%Y-%m-%d %H:%M:%S")
            resolved_at = sorted_t[-1].timestamp.strftime("%Y-%m-%d %H:%M:%S")

        summary = f"Incident {incident_id} affected the service(s): {services_str}. "
        
        if hypotheses:
            summary += f"The primary root cause is hypothesized to be: {hypotheses[0].hypothesis} (confidence: {hypotheses[0].confidence_score:.2f}). "
        
        summary += f"The incident was detected at {detected_at} and resolved at {resolved_at} after operator confirmation."
        return summary

    @classmethod
    def render_markdown_report(
        cls, 
        incident: IncidentStateModel, 
        summary: str, 
        duration_minutes: int
    ) -> str:
        """
        Compiles incident telemetry, timeline, and hypotheses into a clean Markdown post-mortem document.
        """
        # Formulate hypotheses table
        hypotheses_table = ""
        if incident.hypotheses:
            for h in incident.hypotheses:
                evidence_str = "<br>".join([f"- {e}" for e in h.evidence])
                hyp_text = h.hypothesis.replace("|", "\\|")
                action_text = h.recommended_action.replace("|", "\\|")
                hypotheses_table += f"| {h.rank} | {hyp_text} | {h.confidence_score:.2f} | {evidence_str} | {action_text} |\n"
        else:
            hypotheses_table = "| N/A | No hypotheses generated. | 0.00 | - | - |\n"

        # Formulate timeline table
        sorted_timeline = cls.sort_timeline(incident.timeline)
        timeline_rows = ""
        if sorted_timeline:
            for t in sorted_timeline:
                ts_str = t.timestamp.strftime("%Y-%m-%d %H:%M:%S")
                msg_text = t.message.replace("|", "\\|")
                timeline_rows += f"| {ts_str} | {t.source} | {t.severity.upper()} | {msg_text} |\n"
        else:
            timeline_rows = "| - | - | - | No timeline events recorded. |\n"

        # Define remediation actions
        remediation_1 = incident.hypotheses[0].recommended_action if len(incident.hypotheses) > 0 else "Verify underlying microservice status."
        remediation_2 = incident.hypotheses[1].recommended_action if len(incident.hypotheses) > 1 else "Establish additional monitoring metrics alerts."

        detected_at = incident.created_at.strftime("%Y-%m-%d %H:%M:%S") if incident.created_at else "N/A"
        resolved_at = incident.updated_at.strftime("%Y-%m-%d %H:%M:%S") if incident.updated_at else "N/A"

        # Compile final template
        report = f"""# Incident Post-Mortem Report (RCA)
## Incident: {incident.id}

**Status:** RESOLVED
**Incident Severity:** {incident.severity.upper()}
**Duration:** {duration_minutes} minutes
**Detected At:** {detected_at}
**Resolved At:** {resolved_at}

---

### 1. Executive Summary
{summary}

---

### 2. Root Cause Analysis & Ranked Hypotheses
Below are the ranked hypotheses generated during analysis:

| Rank | Hypothesis | Confidence | Evidence | Recommended Actions |
|------|------------|------------|----------|---------------------|
{hypotheses_table}
---

### 3. Chronological Incident Timeline
Below is the sequence of events recorded from detection to resolution:

| Timestamp | Source | Severity | Description |
|-----------|--------|----------|-------------|
{timeline_rows}
---

### 4. Remediation & Action Items
- [ ] **[TODO]** Correct underlying issue identified in Hypothesis 1: `{remediation_1}` (Owner: SRE-Team)
- [ ] **[TODO]** Implement monitoring checks to prevent recurrence: `{remediation_2}` (Owner: SRE-Team)
"""
        return report

    @classmethod
    async def resolve_incident(cls, incident_id: str, operator_name: str = "operator") -> Optional[IncidentStateModel]:
        """
        Executes the resolution workflow:
        1. Transitions state to 'resolved' and sets final updated timestamp
        2. Appends 'incident_resolved' operator timeline event
        3. Generates the executive summary (with fallback support)
        4. Compiles the markdown RCA post-mortem report
        5. Persists the report to Redis (with a 7-day retention) and local disk
        6. Updates incident's rca_document_url and persists back to Redis
        """
        logger.info("Executing resolution workflow for incident: %s by %s", incident_id, operator_name)
        
        # 1. Fetch incident from Redis
        incident = await asyncio.to_thread(redis_manager.get_incident, incident_id)
        if not incident:
            logger.error("Incident %s not found in Redis, cannot resolve.", incident_id)
            return None

        # If already resolved, return it
        if incident.state == "resolved":
            logger.info("Incident %s is already resolved.", incident_id)
            return incident

        # 2. Append resolving timeline event
        resolved_time = datetime.now(incident.created_at.tzinfo)
        incident.state = "resolved"
        incident.updated_at = resolved_time
        
        incident.timeline.append(TimelineItem(
            timestamp=resolved_time,
            event_type="operator_action",
            source="slack_operator",
            message=f"Incident marked resolved by operator '@{operator_name}'.",
            severity="info",
            metadata={"operator": operator_name}
        ))

        # 3. Calculate duration (in minutes)
        duration_minutes = int((resolved_time - incident.created_at).total_seconds() / 60)
        if duration_minutes < 0:
            duration_minutes = 0

        # 4. Sort timeline to prepare context
        sorted_timeline = cls.sort_timeline(incident.timeline)

        # 5. Generate executive summary
        summary = await cls.generate_executive_summary(
            incident_id=incident.id,
            services=incident.services_affected,
            timeline=sorted_timeline,
            hypotheses=incident.hypotheses
        )

        # 6. Render markdown document
        markdown_content = cls.render_markdown_report(incident, summary, duration_minutes)

        # 7. Persist RCA (Redis + Local filesystem)
        rca_payload = {
            "incident_id": incident.id,
            "title": f"Incident Post-Mortem Report (RCA) - {incident.id}",
            "markdown_content": markdown_content,
            "resolved_at": resolved_time.isoformat(),
            "last_updated_at": resolved_time.isoformat()
        }

        # Save to Redis with 7-day TTL (604800 seconds)
        try:
            redis_client = redis_manager.get_client()
            redis_client.setex(f"rca:{incident.id}", 604800, json.dumps(rca_payload))
            logger.info("RCA successfully persisted to Redis cache with 7-day TTL.")
        except Exception as e:
            logger.error("Failed to persist RCA to Redis: %s", str(e))

        # Save to local file storage
        local_dir = Path("storage/rcas")
        local_dir.mkdir(parents=True, exist_ok=True)
        local_path = local_dir / f"{incident.id}.md"
        
        try:
            await asyncio.to_thread(local_path.write_text, markdown_content, encoding="utf-8")
            logger.info("RCA successfully written to local disk: %s", local_path)
        except Exception as e:
            logger.error("Failed to write RCA file to disk: %s", str(e))

        # 8. Update URL in incident model and save
        incident.timeline = sorted_timeline  # Store the sorted timeline
        incident.rca_document_url = f"/rca/{incident.id}"
        await asyncio.to_thread(redis_manager.save_incident, incident)

        return incident
