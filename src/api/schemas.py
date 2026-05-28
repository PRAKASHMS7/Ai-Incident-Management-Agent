"""
API Schemas Module.

Declares Pydantic models for incoming webhooks, data exchange formats, and system state storage.
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, field_validator

class AlertLabel(BaseModel):
    """Labels attached to Prometheus/Loki alerts."""
    alertname: str
    service: str
    severity: str = "warning"
    instance: Optional[str] = None

class AlertAnnotation(BaseModel):
    """Annotations containing descriptions and summaries."""
    summary: Optional[str] = None
    description: Optional[str] = None

class PrometheusAlert(BaseModel):
    """Raw alert format sent inside the AlertManager payload."""
    labels: AlertLabel
    annotations: AlertAnnotation
    startsAt: datetime
    endsAt: Optional[datetime] = None
    generatorURL: Optional[str] = None

class AlertManagerWebhookPayload(BaseModel):
    """AlertManager webhook ingestion payload schema."""
    receiver: str
    status: str  # "firing" or "resolved"
    alerts: List[PrometheusAlert]
    externalURL: Optional[str] = None

class StandardizedAlert(BaseModel):
    """Agent's internal representation of an ingested alert."""
    id: str = Field(description="Unique UUID string for the alert")
    name: str
    service: str
    severity: str
    description: str
    starts_at: datetime
    ends_at: Optional[datetime] = None
    details: Dict[str, Any] = Field(default_factory=dict)

class Hypothesis(BaseModel):
    """A diagnostic root cause hypothesis."""
    rank: int
    hypothesis: str
    confidence_score: float
    evidence: List[str]
    recommended_action: str

class ReasoningOutput(BaseModel):
    """The JSON output structure expected from the LLM reasoning engine."""
    hypotheses: List[Hypothesis]

    @field_validator("hypotheses")
    @classmethod
    def validate_hypotheses_count(cls, v: List[Hypothesis]) -> List[Hypothesis]:
        if len(v) != 3:
            raise ValueError("ReasoningOutput must contain exactly 3 hypotheses.")
        return v

class TimelineItem(BaseModel):
    """An event occurred during an incident lifecycle."""
    timestamp: datetime
    event_type: str  # e.g. alert_triggered, metric_anomaly, incident_resolved
    source: str      # e.g. prometheus, loki, system
    message: str
    severity: str    # e.g. info, warning, critical
    metadata: Dict[str, Any] = Field(default_factory=dict)

class IncidentStateModel(BaseModel):
    """The internal representation of an active or resolved incident ticket."""
    id: str
    state: str = "open"  # open, analyzing, awaiting_approval, escalated, resolved, merged
    severity: str = "warning"
    services_affected: List[str] = Field(default_factory=list)
    primary_incident_alert_id: str
    alerts: List[StandardizedAlert] = Field(default_factory=list)
    timeline: List[TimelineItem] = Field(default_factory=list)
    hypotheses: List[Hypothesis] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    merged_into: Optional[str] = None
    rca_document_url: Optional[str] = None

class ServiceNodeModel(BaseModel):
    """Validation model for Service nodes in Neo4j."""
    name: str = Field(..., description="Unique service ID name")
    language: Optional[str] = "python"
    version: Optional[str] = "latest"

class DatabaseNodeModel(BaseModel):
    """Validation model for Database nodes in Neo4j."""
    name: str = Field(..., description="Unique database ID name")
    type: str = Field(..., description="Database type (e.g. postgres, redis)")

class DependencyEdgeModel(BaseModel):
    """Validation model for DEPENDS_ON relationship edges in Neo4j."""
    source: str = Field(..., description="Source service name")
    target: str = Field(..., description="Target service/database name")
    protocol: str = Field("http", description="Communication protocol (http, grpc, sql)")
    p99_latency_threshold_ms: Optional[int] = 200

class TopologyLoadPayload(BaseModel):
    """Bulk topology load payload mapping."""
    services: List[ServiceNodeModel] = Field(default_factory=list)
    databases: List[DatabaseNodeModel] = Field(default_factory=list)
    dependencies: List[DependencyEdgeModel] = Field(default_factory=list)

class MetricPoint(BaseModel):
    """A single data point representing timestamp and float value."""
    timestamp: float
    value: float

class MetricSeries(BaseModel):
    """A metrics timeseries representing query results."""
    metric_name: str
    labels: Dict[str, str] = Field(default_factory=dict)
    values: List[MetricPoint] = Field(default_factory=list)

class PrometheusTelemetryResponse(BaseModel):
    """Standardized response from the Prometheus query client."""
    status: str
    data: List[MetricSeries] = Field(default_factory=list)

class LogLine(BaseModel):
    """A single parsed log line containing timestamp and payload message."""
    timestamp: str
    stream: Dict[str, str] = Field(default_factory=dict)
    message: str

class LogQueryResponse(BaseModel):
    """Standardized response from the Loki query client."""
    status: str
    logs: List[LogLine] = Field(default_factory=list)
