"""
Main FastAPI Application Entry Point.

Initializes the FastAPI application, registers health checks, configures structured logging,
and handles database driver cleanups during shutdown.
"""

import logging
import sys
import json
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, Response, status

from src.config import settings
from src.database.redis_client import redis_manager
from src.database.neo4j_client import neo4j_manager
from src.api.routes import router as api_router

# Configure structured JSON logging
logging.basicConfig(
    level=settings.LOG_LEVEL.upper(),
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "message": "%(message)s"}',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("incident_agent")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles application startup and shutdown events.
    """
    logger.info("Starting up AI-Powered Incident Management Agent...")
    
    # Eager connection check on startup
    logger.info("Verifying backend database connections...")
    redis_status = redis_manager.check_health()
    logger.info("Redis startup verification status: %s", redis_status["status"])
    
    try:
        neo4j_manager.get_driver()
        neo4j_status = neo4j_manager.check_health()
        logger.info("Neo4j startup verification status: %s", neo4j_status["status"])
        
        # 1. Setup Neo4j Constraints and indexes
        neo4j_manager.setup_constraints_and_indexes()
        
        # 2. Check if the graph database is empty
        driver = neo4j_manager.get_driver()
        is_empty = False
        with driver.session() as session:
            result = session.run("MATCH (n) RETURN count(n) AS count")
            record = result.single()
            if record and record["count"] == 0:
                is_empty = True
                
        # 3. Seed baseline topology if empty
        if is_empty:
            logger.info("Neo4j database is empty. Seeding baseline topology...")
            topology_path = Path(__file__).resolve().parent.parent / "scripts" / "baseline_topology.json"
            if topology_path.exists():
                with open(topology_path, "r") as f:
                    data = json.load(f)
                
                for svc in data.get("services", []):
                    neo4j_manager.create_service_node(
                        name=svc["name"],
                        language=svc.get("language", "python"),
                        version=svc.get("version", "latest")
                    )
                for db in data.get("databases", []):
                    neo4j_manager.create_database_node(
                        name=db["name"],
                        db_type=db["type"]
                    )
                for dep in data.get("dependencies", []):
                    neo4j_manager.create_dependency(
                        source=dep["source"],
                        target=dep["target"],
                        protocol=dep.get("protocol", "http"),
                        p99_latency_threshold_ms=dep.get("p99_latency_threshold_ms", 200)
                    )
                logger.info("Baseline topology seeded successfully in Neo4j.")
            else:
                logger.warning("Baseline topology file not found at: %s", topology_path)
    except Exception as e:
        logger.warning("Neo4j setup or seeding skipped (degraded mode active): %s", str(e))

    # Start SRE watchdog heartbeat worker task
    import asyncio
    from src.core.watchdog import start_watchdog_loop
    watchdog_task = asyncio.create_task(start_watchdog_loop())

    yield

    # Shutdown operations
    logger.info("Shutting down AI-Powered Incident Management Agent...")
    logger.info("Stopping SRE watchdog task...")
    watchdog_task.cancel()
    try:
        await watchdog_task
    except asyncio.CancelledError:
        logger.info("Watchdog task stopped.")
        
    logger.info("Closing database drivers and clients...")
    neo4j_manager.close()
    
    logger.info("Shutting down OpenTelemetry Tracer Provider...")
    try:
        from src.observability.tracer import provider as tracer_provider
        tracer_provider.shutdown()
        logger.info("Tracer Provider shut down successfully.")
    except Exception as e:
        logger.warning("Error shutting down Tracer Provider: %s", str(e))
    
    # Close HTTP async clients to release connection pools
    try:
        from src.services import prom_client, loki_client, groq_client
        await prom_client.close()
        await loki_client.close()
        await groq_client.close()
        logger.info("External HTTP client connection pools closed successfully.")
    except Exception as e:
        logger.warning("Error closing HTTP client pools: %s", str(e))
        
    logger.info("Shutdown lifecycle processes finalized.")

# Initialize Tracer early and instrument FastAPI
from src.observability.tracer import tracer
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

app = FastAPI(
    title="AI-Powered Incident Management Agent",
    description="Automated read-only incident correlation, reasoning, and escalation platform.",
    version="1.0.0",
    lifespan=lifespan
)

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instrument with OpenTelemetry
FastAPIInstrumentor.instrument_app(app)

app.include_router(api_router)

@app.get("/metrics")
def get_metrics() -> Response:
    """
    Exposes standard Prometheus metrics endpoint.
    """
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/", status_code=status.HTTP_200_OK)
def read_root() -> Dict[str, str]:
    """
    Base endpoint verifying that the service itself is reachable.
    """
    return {
        "service": "AI-Powered Incident Management Agent",
        "version": "1.0.0",
        "status": "operational"
    }

@app.get("/health", status_code=status.HTTP_200_OK)
def get_health(response: Response) -> Dict[str, Any]:
    """
    End-to-End system health check. Evaluates connection statuses for all backing datastores.
    
    If any dependency fails health checks, returns HTTP 503 Service Unavailable.
    """
    redis_health = redis_manager.check_health()
    neo4j_health = neo4j_manager.check_health()
    
    overall_healthy = (
        redis_health["status"] == "healthy" and 
        neo4j_health["status"] == "healthy"
    )
    
    result = {
        "status": "healthy" if overall_healthy else "unhealthy",
        "components": {
            "redis": redis_health,
            "neo4j": neo4j_health
        }
    }
    
    if not overall_healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        
    return result

@app.get("/health/redis", status_code=status.HTTP_200_OK)
def get_redis_health(response: Response) -> Dict[str, Any]:
    """
    Dedicated Redis service health check.
    """
    health = redis_manager.check_health()
    if health["status"] != "healthy":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return health

@app.get("/health/neo4j", status_code=status.HTTP_200_OK)
def get_neo4j_health(response: Response) -> Dict[str, Any]:
    """
    Dedicated Neo4j service health check.
    """
    health = neo4j_manager.check_health()
    if health["status"] != "healthy":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return health
