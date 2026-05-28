"""
Unit tests for Timeline sorting and RCA Markdown generation.
"""

import pytest
from datetime import datetime, timedelta
from src.services.rca_generator import RCAGenerator
from src.api.schemas import TimelineItem, IncidentStateModel, Hypothesis, StandardizedAlert

def test_timeline_sorting():
    """
    Verifies that timeline events are sorted first chronologically,
    then by severity precedence, then by source precedence.
    """
    t1 = datetime(2026, 5, 27, 10, 0, 0)
    t2 = datetime(2026, 5, 27, 10, 0, 5)
    
    items = [
        # Chronological out of order
        TimelineItem(timestamp=t2, event_type="operator_action", source="slack_operator", message="Resolved", severity="info"),
        TimelineItem(timestamp=t1, event_type="alert_triggered", source="prometheus", message="Fired", severity="critical"),
        # Overlapping times: severity precedence (critical > error > warning > info)
        TimelineItem(timestamp=t1, event_type="agent_milestone", source="system", message="System Milestone", severity="info"),
        TimelineItem(timestamp=t1, event_type="log_error", source="loki", message="Log Error", severity="error"),
        # Overlapping times & severity: source precedence (prometheus > loki > system > slack_operator)
        TimelineItem(timestamp=t1, event_type="metric_anomaly", source="prometheus", message="Metric anomaly", severity="info"),
    ]
    
    sorted_items = RCAGenerator.sort_timeline(items)
    
    # 1. Earliest time + highest severity
    assert sorted_items[0].message == "Fired"
    assert sorted_items[0].timestamp == t1
    
    # 2. Same time, next highest severity (error)
    assert sorted_items[1].message == "Log Error"
    
    # 3. Same time, next severity (info), source prometheus (0)
    assert sorted_items[2].message == "Metric anomaly"
    
    # 4. Same time, next severity (info), source system (2)
    assert sorted_items[3].message == "System Milestone"
    
    # 5. Latest time
    assert sorted_items[4].message == "Resolved"
    assert sorted_items[4].timestamp == t2


def test_markdown_rendering():
    """
    Verifies that the report template contains all metadata,
    hypotheses, and timeline rows formatted cleanly.
    """
    t_start = datetime(2026, 5, 27, 9, 45, 0)
    t_end = datetime(2026, 5, 27, 10, 0, 0)
    
    alert = StandardizedAlert(
        id="alert-123",
        name="Http5xxRateHigh",
        service="payment-service",
        severity="critical",
        description="High error rate",
        starts_at=t_start
    )
    incident = IncidentStateModel(
        id="inc-test-render",
        state="resolved",
        severity="critical",
        services_affected=["payment-service"],
        primary_incident_alert_id="alert-123",
        alerts=[alert],
        timeline=[
            TimelineItem(timestamp=t_start, event_type="alert_triggered", source="prometheus", message="Alert Fired", severity="critical")
        ],
        hypotheses=[
            Hypothesis(rank=1, hypothesis="Hypothesis 1 Test", confidence_score=0.925, evidence=["Ev1"], recommended_action="Action 1"),
            Hypothesis(rank=2, hypothesis="Hypothesis 2 Test", confidence_score=0.68, evidence=["Ev2"], recommended_action="Action 2"),
        ],
        created_at=t_start,
        updated_at=t_end
    )
    
    summary = "AI generated executive summary snippet."
    report = RCAGenerator.render_markdown_report(incident, summary, 15)
    
    assert "# Incident Post-Mortem Report (RCA)" in report
    assert "inc-test-render" in report
    assert "AI generated executive summary snippet." in report
    
    # Check hypotheses table content
    assert "Hypothesis 1 Test" in report
    assert "0.93" in report
    assert "Hypothesis 2 Test" in report
    assert "0.68" in report
    
    # Check timeline rows
    assert "Alert Fired" in report
    assert "prometheus" in report
    
    # Check action items
    assert "Action 1" in report
    assert "Action 2" in report
