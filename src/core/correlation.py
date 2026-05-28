"""
Alert Correlation Engine Module.

Contains the logic to group related alerts into incidents, query dependencies,
and merge multiple incidents during cascading failure overlaps.
"""

import logging
import uuid
from datetime import datetime
from typing import List

from src.api.schemas import StandardizedAlert, IncidentStateModel, TimelineItem
from src.database.redis_client import redis_manager
from src.database.neo4j_client import neo4j_manager
from src.observability.tracer import tracer
from src.observability.metrics import incidents_detected_total

logger = logging.getLogger(__name__)

# Configurable sliding time window in seconds
CORRELATION_WINDOW_SECONDS = 300


class CorrelationEngine:
    """
    Ingests unique alerts and maps them to new or existing incidents.
    """

    @staticmethod
    def correlate_alert(alert: StandardizedAlert) -> str:
        """
        Correlates an incoming alert against active incidents.
        Creates a new incident, merges with one, or aggregates multiple incidents.

        Returns:
            str: The UUID of the incident this alert has been mapped to.
        """
        with tracer.start_as_current_span("correlate_alert") as span:
            span.set_attribute("alert.id", alert.id)
            span.set_attribute("alert.name", alert.name)
            span.set_attribute("alert.service", alert.service)
            span.set_attribute("alert.severity", alert.severity)

            logger.info(
                "Correlating alert %s for service %s", alert.name, alert.service
            )

            # 1. Fetch all active incidents from Redis
            active_incidents = redis_manager.get_active_incidents()
            matched_incidents: List[IncidentStateModel] = []

            # 2. Check each active incident for matches
            for incident in active_incidents:
                # A. Time window check (sliding window from last update time)
                time_delta = abs(
                    (alert.starts_at - incident.updated_at).total_seconds()
                )
                if time_delta > CORRELATION_WINDOW_SECONDS:
                    continue

                # B. Direct service match
                if alert.service in incident.services_affected:
                    logger.info(
                        "Direct service match found for service %s in incident %s",
                        alert.service,
                        incident.id,
                    )
                    matched_incidents.append(incident)
                    continue

                # C. Dependency graph match (Neo4j)
                if neo4j_manager.check_dependency_path(
                    alert.service, list(incident.services_affected)
                ):
                    logger.info(
                        "Dependency graph relationship found between %s and incident %s services",
                        alert.service,
                        incident.id,
                    )
                    matched_incidents.append(incident)
                    continue

            # 3. Process matches
            if not matched_incidents:
                # Case 0: No matches -> Create a new incident
                new_incident = CorrelationEngine._create_incident(alert)
                redis_manager.save_incident(new_incident)
                # Increment Prometheus incidents counter
                incidents_detected_total.labels(
                    severity=new_incident.severity, initial_service=alert.service
                ).inc()
                span.set_attribute("incident.created", True)
                span.set_attribute("incident.id", new_incident.id)
                return new_incident.id

            elif len(matched_incidents) == 1:
                # Case 1: Exactly 1 match -> Merge alert into it
                target_incident = matched_incidents[0]
                logger.info(
                    "Mapping alert %s to existing incident %s",
                    alert.id,
                    target_incident.id,
                )
                CorrelationEngine._merge_alert_into_incident(target_incident, alert)
                redis_manager.save_incident(target_incident)
                span.set_attribute("incident.merged", True)
                span.set_attribute("incident.id", target_incident.id)
                return target_incident.id

            else:
                # Case 2: Multi-match -> Merge all matching incidents together + add alert
                logger.info(
                    "Alert %s bridges multiple incidents: %s",
                    alert.id,
                    [i.id for i in matched_incidents],
                )
                primary_id = CorrelationEngine._merge_multiple_incidents(
                    matched_incidents, alert
                )
                span.set_attribute("incident.multi_merged", True)
                span.set_attribute("incident.id", primary_id)
                return primary_id

    @staticmethod
    def _create_incident(alert: StandardizedAlert) -> IncidentStateModel:
        """
        Initializes a new incident state from a trigger alert.
        """
        incident_id = str(uuid.uuid4())
        logger.info(
            "Initializing new incident %s triggered by alert %s", incident_id, alert.id
        )

        timeline_item = TimelineItem(
            timestamp=alert.starts_at,
            event_type="alert_triggered",
            source="prometheus",
            message=f"Incident opened. Primary alert '{alert.name}' triggered on service '{alert.service}'",
            severity=alert.severity,
        )

        return IncidentStateModel(
            id=incident_id,
            state="open",
            severity=alert.severity,
            services_affected=[alert.service],
            primary_incident_alert_id=alert.id,
            alerts=[alert],
            timeline=[timeline_item],
            hypotheses=[],
            created_at=alert.starts_at,
            updated_at=alert.starts_at,
        )

    @staticmethod
    def _merge_alert_into_incident(
        incident: IncidentStateModel, alert: StandardizedAlert
    ) -> None:
        """
        Appends an alert to an existing incident's state.
        """
        # Append alert
        incident.alerts.append(alert)

        # Update affected services list
        if alert.service not in incident.services_affected:
            incident.services_affected.append(alert.service)

        # Update severity if the new alert is more severe
        severity_ranking = {"info": 1, "warning": 2, "critical": 3}
        if severity_ranking.get(alert.severity, 0) > severity_ranking.get(
            incident.severity, 0
        ):
            incident.severity = alert.severity

        # Add timeline record
        timeline_item = TimelineItem(
            timestamp=alert.starts_at,
            event_type="alert_triggered",
            source="prometheus",
            message=f"Alert '{alert.name}' linked to this incident for service '{alert.service}'",
            severity=alert.severity,
        )
        incident.timeline.append(timeline_item)

        # Sort timeline chronologically
        incident.timeline.sort(key=lambda x: x.timestamp)

        # Update updated_at
        incident.updated_at = max(alert.starts_at, incident.updated_at)

    @staticmethod
    def _merge_multiple_incidents(
        incidents: List[IncidentStateModel], alert: StandardizedAlert
    ) -> str:
        """
        Merges multiple overlapping active incidents into a single primary incident.
        Uses the oldest incident as the primary target.
        """
        # Sort incidents by created_at to select the oldest as primary
        incidents.sort(key=lambda x: x.created_at)
        primary = incidents[0]
        secondaries = incidents[1:]

        logger.info(
            "Merging secondary incidents %s into primary %s",
            [s.id for s in secondaries],
            primary.id,
        )

        # Step 1: Merge the bridging alert into the primary
        CorrelationEngine._merge_alert_into_incident(primary, alert)

        # Step 2: Merge each secondary's contents into the primary
        for secondary in secondaries:
            # Merge services
            for service in secondary.services_affected:
                if service not in primary.services_affected:
                    primary.services_affected.append(service)

            # Merge alerts
            existing_alert_ids = {a.id for a in primary.alerts}
            for alt in secondary.alerts:
                if alt.id not in existing_alert_ids:
                    primary.alerts.append(alt)

            # Merge timelines
            primary.timeline.extend(secondary.timeline)

            # Log merge action on primary timeline
            merge_time = datetime.now()
            primary.timeline.append(
                TimelineItem(
                    timestamp=merge_time,
                    event_type="incident_merged",
                    source="system",
                    message=f"Merged incident '{secondary.id}' into this incident due to service '{alert.service}' correlation bridge.",
                    severity="info",
                )
            )

            # Update secondary state to merged
            secondary.state = "merged"
            secondary.merged_into = primary.id
            secondary.updated_at = merge_time
            redis_manager.save_incident(secondary)  # Removing from active sets

        # Sort primary timeline chronologically
        primary.timeline.sort(key=lambda x: x.timestamp)

        # Update primary severity based on all alerts
        severity_ranking = {"info": 1, "warning": 2, "critical": 3}
        max_severity = max(
            [a.severity for a in primary.alerts],
            key=lambda s: severity_ranking.get(s, 0),
        )
        primary.severity = max_severity

        # Save primary incident
        redis_manager.save_incident(primary)
        return primary.id
