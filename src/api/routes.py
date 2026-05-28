"""
API Routes Module.

Defines HTTP handlers for alert ingestion, topology nodes management, and dependency graph queries.
"""

import logging
import uuid
from typing import Dict, Any, List
from datetime import datetime

import json
from pathlib import Path
from fastapi import APIRouter, Response, status, HTTPException, Request
from fastapi.responses import FileResponse

from src.api.schemas import (
    AlertManagerWebhookPayload,
    StandardizedAlert,
    IncidentStateModel,
    TopologyLoadPayload,
    ServiceNodeModel,
    DatabaseNodeModel
)
from src.database.redis_client import redis_manager
from src.database.neo4j_client import neo4j_manager
from src.core.correlation import CorrelationEngine
from src.services import RCAGenerator

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/alerts", status_code=status.HTTP_202_ACCEPTED)
def ingest_alerts(payload: AlertManagerWebhookPayload) -> Dict[str, Any]:
    """
    Ingest webhook alerts from Prometheus AlertManager or Grafana Loki.
    
    Filters duplicate events via a 60-second Bloom filter/hash block, standardizes
    unique notifications, and routes them to the Correlation Engine.
    """
    logger.info("Received AlertManager webhook containing %d alerts", len(payload.alerts))
    processed_count = 0
    incidents_mapped = []
    
    for raw_alert in payload.alerts:
        labels = raw_alert.labels
        annotations = raw_alert.annotations
        
        # 1. Deduplication check
        is_duplicate = redis_manager.check_deduplicate(
            alertname=labels.alertname,
            service=labels.service,
            severity=labels.severity,
            instance=labels.instance
        )
        
        if is_duplicate:
            logger.info("Dropping duplicate alert: %s on service %s", labels.alertname, labels.service)
            continue
            
        # 2. Standardize unique alert
        alert_id = str(uuid.uuid4())
        description = annotations.description or annotations.summary or f"Alert {labels.alertname} active on service {labels.service}"
        
        standard_alert = StandardizedAlert(
            id=alert_id,
            name=labels.alertname,
            service=labels.service,
            severity=labels.severity.lower() if labels.severity else "warning",
            description=description,
            starts_at=raw_alert.startsAt or datetime.now(),
            ends_at=raw_alert.endsAt,
            details={
                "receiver": payload.receiver,
                "generatorURL": raw_alert.generatorURL,
                "instance": labels.instance
            }
        )
        
        # 3. Correlate alert
        try:
            incident_id = CorrelationEngine.correlate_alert(standard_alert)
            inc = redis_manager.get_incident(incident_id)
            action = "created"
            if inc and len(inc.alerts) > 1:
                action = "merged"
                
            incidents_mapped.append({
                "incident_id": incident_id,
                "action": action
            })
            processed_count += 1
        except Exception as e:
            logger.error("Failed to correlate alert %s: %s", alert_id, str(e), exc_info=True)
            
    return {
        "status": "accepted",
        "processed_alerts_count": processed_count,
        "incidents_mapped": incidents_mapped
    }

@router.post("/topology/load", status_code=status.HTTP_200_OK)
def load_topology(payload: TopologyLoadPayload) -> Dict[str, Any]:
    """
    Overwrites or seeds the service dependency graph in Neo4j.
    """
    logger.info(
        "Loading batch topology: %d services, %d databases, %d dependencies",
        len(payload.services),
        len(payload.databases),
        len(payload.dependencies)
    )
    
    try:
        # Verify Neo4j is reachable
        neo4j_manager.get_driver().verify_connectivity()
    except Exception as e:
        logger.error("Neo4j database connection unavailable during topology load: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Neo4j database connection failed: {str(e)}"
        )
        
    inserted_services = 0
    inserted_databases = 0
    inserted_dependencies = 0
    
    # 1. Insert Services
    for service in payload.services:
        try:
            neo4j_manager.create_service_node(
                name=service.name,
                language=service.language or "python",
                version=service.version or "latest"
            )
            inserted_services += 1
        except Exception as e:
            logger.error("Failed to insert service %s during topology load: %s", service.name, str(e))
            
    # 2. Insert Databases
    for db in payload.databases:
        try:
            neo4j_manager.create_database_node(
                name=db.name,
                db_type=db.type
            )
            inserted_databases += 1
        except Exception as e:
            logger.error("Failed to insert database %s during topology load: %s", db.name, str(e))
            
    # 3. Insert Dependency Edges
    for dep in payload.dependencies:
        try:
            neo4j_manager.create_dependency(
                source=dep.source,
                target=dep.target,
                protocol=dep.protocol or "http",
                p99_latency_threshold_ms=dep.p99_latency_threshold_ms or 200
            )
            inserted_dependencies += 1
        except Exception as e:
            logger.error("Failed to create relationship %s -> %s during topology load: %s", dep.source, dep.target, str(e))

    # Clear Neo4j caches in Redis to force fresh traversals
    try:
        redis_client = redis_manager.get_client()
        cache_keys = redis_client.keys("cache:neo4j:*")
        if cache_keys:
            redis_client.delete(*cache_keys)
            logger.info("Cleared %d cached Neo4j path records in Redis", len(cache_keys))
    except Exception as e:
        logger.warning("Could not flush Neo4j cache keys in Redis: %s", str(e))

    return {
        "status": "success",
        "inserted_services": inserted_services,
        "inserted_databases": inserted_databases,
        "inserted_dependencies": inserted_dependencies
    }

@router.get("/topology/services/{name}", status_code=status.HTTP_200_OK)
def get_service_topology(name: str) -> Dict[str, Any]:
    """
    Retrieves details for a service node along with its immediate upstream and downstream connections.
    """
    try:
        driver = neo4j_manager.get_driver()
        # Verify node existence
        query = """
        OPTIONAL MATCH (s:Service {name: $name})
        OPTIONAL MATCH (d:Database {name: $name})
        WITH COALESCE(s, d) AS n
        WHERE n IS NOT NULL
        RETURN labels(n)[0] AS type, properties(n) AS props
        """
        with driver.session() as session:
            res = session.run(query, name=name)
            record = res.single()
            if not record:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Service or Database node '{name}' not found in topology graph."
                )
                
            label = record["type"]
            props = record["props"]
            
        upstreams = neo4j_manager.get_upstreams(name)
        downstreams = neo4j_manager.get_downstreams(name)
        
        return {
            "name": name,
            "type": label,
            "properties": {k: v for k, v in props.items() if k != "name"},
            "upstreams": upstreams,
            "downstreams": downstreams
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error retrieving topology details for %s: %s", name, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading dependency topology: {str(e)}"
        )

@router.get("/topology/graph", status_code=status.HTTP_200_OK)
def get_topology_graph() -> Dict[str, Any]:
    """
    Fetches the full topology graph nodes and relationships representation.
    """
    try:
        graph = neo4j_manager.get_full_graph()
        return graph
    except Exception as e:
        logger.error("Error retrieving full topology graph: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error querying full graph schema: {str(e)}"
        )

@router.post("/incidents/{id}/resolve", status_code=status.HTTP_200_OK)
async def resolve_incident(id: str, operator_name: str = "operator") -> Dict[str, Any]:
    """
    Manually resolve an incident and generate its post-mortem RCA report.
    """
    logger.info("Resolve endpoint called for incident %s by %s", id, operator_name)
    resolved_incident = await RCAGenerator.resolve_incident(id, operator_name)
    if not resolved_incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident {id} not found."
        )
    return resolved_incident.model_dump()

@router.get("/incidents", response_model=List[IncidentStateModel], status_code=status.HTTP_200_OK)
def get_incidents() -> List[IncidentStateModel]:
    """
    Retrieves all incidents currently stored in Redis.
    """
    try:
        redis_client = redis_manager.get_client()
        keys = redis_client.keys("incident:state:*")
        incidents = []
        for key in keys:
            data = redis_client.get(key)
            if data:
                try:
                    incidents.append(IncidentStateModel.model_validate_json(data))
                except Exception as e:
                    logger.warning("Failed to validate incident data for key %s: %s", key, str(e))
        return incidents
    except Exception as e:
        logger.error("Failed to retrieve incidents: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading incidents: {str(e)}"
        )

@router.get("/incidents/{id}", response_model=IncidentStateModel, status_code=status.HTTP_200_OK)
def get_incident(id: str) -> IncidentStateModel:
    """
    Retrieves a single incident from Redis by its ID.
    """
    incident = redis_manager.get_incident(id)
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident {id} not found."
        )
    return incident

@router.get("/timeline/{id}", status_code=status.HTTP_200_OK)
def get_timeline(id: str) -> Dict[str, Any]:
    """
    Retrieves the sorted chronological timeline of events for an incident.
    """
    incident = redis_manager.get_incident(id)
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident {id} not found."
        )
    sorted_timeline = RCAGenerator.sort_timeline(incident.timeline)
    return {
        "incident_id": id,
        "timeline": sorted_timeline
    }

@router.get("/rca/{id}", status_code=status.HTTP_200_OK)
def get_rca_report(id: str) -> Response:
    """
    Retrieves the raw Markdown content of the RCA post-mortem report.
    """
    # 1. Check Redis cache
    try:
        redis_client = redis_manager.get_client()
        rca_data = redis_client.get(f"rca:{id}")
        if rca_data:
            parsed = json.loads(rca_data)
            return Response(content=parsed["markdown_content"], media_type="text/markdown")
    except Exception as e:
        logger.warning("Redis lookup for RCA report %s failed: %s", id, str(e))

    # 2. Check local disk
    local_path = Path("storage/rcas") / f"{id}.md"
    if local_path.exists():
        content = local_path.read_text(encoding="utf-8")
        # Populate Redis cache
        try:
            redis_client = redis_manager.get_client()
            rca_payload = {
                "incident_id": id,
                "title": f"Incident Post-Mortem Report (RCA) - {id}",
                "markdown_content": content,
                "resolved_at": datetime.now().isoformat(),
                "last_updated_at": datetime.now().isoformat()
            }
            redis_client.setex(f"rca:{id}", 604800, json.dumps(rca_payload))
        except Exception as e:
            logger.warning("Failed to refresh Redis cache on read for RCA %s: %s", id, str(e))
            
        return Response(content=content, media_type="text/markdown")

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"RCA report for incident {id} not found."
    )

@router.get("/rca/{id}/export", response_class=FileResponse)
def export_rca_report(id: str):
    """
    Exports the RCA post-mortem Markdown file as a downloadable file transfer payload.
    """
    local_path = Path("storage/rcas") / f"{id}.md"
    
    # If not on local disk, check Redis cache and construct it
    if not local_path.exists():
        try:
            redis_client = redis_manager.get_client()
            rca_data = redis_client.get(f"rca:{id}")
            if rca_data:
                parsed = json.loads(rca_data)
                local_path.parent.mkdir(parents=True, exist_ok=True)
                local_path.write_text(parsed["markdown_content"], encoding="utf-8")
        except Exception as e:
            logger.warning("Redis cache fallback for export rca %s failed: %s", id, str(e))

    if not local_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"RCA report file for incident {id} not found to export."
        )

    return FileResponse(
        path=str(local_path),
        filename=f"rca-{id}.md",
        media_type="text/markdown"
    )

@router.get("/rca/{id}/json", status_code=status.HTTP_200_OK)
def get_rca_metadata_json(id: str) -> Dict[str, Any]:
    """
    Retrieves the structured JSON metadata representing the RCA post-mortem.
    """
    try:
        redis_client = redis_manager.get_client()
        rca_data = redis_client.get(f"rca:{id}")
        if rca_data:
            return json.loads(rca_data)
    except Exception as e:
        logger.warning("Failed to query Redis rca cache: %s", str(e))

    # Fallback check disk
    local_path = Path("storage/rcas") / f"{id}.md"
    if local_path.exists():
        content = local_path.read_text(encoding="utf-8")
        incident = redis_manager.get_incident(id)
        resolved_at = incident.updated_at.isoformat() if (incident and incident.state == "resolved") else datetime.now().isoformat()
        return {
            "incident_id": id,
            "title": f"Incident Post-Mortem Report (RCA) - {id}",
            "markdown_content": content,
            "resolved_at": resolved_at,
            "last_updated_at": resolved_at
        }

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"RCA report JSON for incident {id} not found."
    )


# Slack Webhook endpoint callback router
from slack_bolt.adapter.fastapi.async_handler import AsyncSlackRequestHandler
from src.services.slack_client import slack_app

slack_handler = AsyncSlackRequestHandler(slack_app)

@router.post("/slack/events", include_in_schema=False)
async def slack_events(request: Request):
    """
    Callback receiver for Slack webhook events and interactive actions.
    """
    return await slack_handler.handle(request)
