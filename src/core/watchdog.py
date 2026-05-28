"""
Agent Heartbeat Watchdog.

Runs a background task checking database healths and updating Prometheus gauges.
"""
import asyncio
import time
import logging
from src.database.redis_client import redis_manager
from src.database.neo4j_client import neo4j_manager
from src.observability.metrics import incident_agent_heartbeat

logger = logging.getLogger(__name__)

async def start_watchdog_loop():
    """
    SRE Watchdog Worker loop running health checks every 30 seconds.
    Updates the Prometheus gauge incident_agent_heartbeat with the current timestamp.
    """
    logger.info("Initializing SRE Watchdog Heartbeat Worker...")
    while True:
        try:
            # 1. Perform database checks
            redis_status = redis_manager.check_health()
            neo4j_status = neo4j_manager.check_health()
            
            redis_ok = redis_status.get("status") == "healthy"
            neo4j_ok = neo4j_status.get("status") == "healthy"
            
            if redis_ok and neo4j_ok:
                current_time = time.time()
                incident_agent_heartbeat.set(current_time)
                logger.debug(f"Watchdog check passed. Heartbeat updated to {current_time}")
            else:
                logger.warning(
                    f"Watchdog health checks degraded. Redis healthy: {redis_ok}, Neo4j healthy: {neo4j_ok}. "
                    "Skipping heartbeat update."
                )
        except Exception as e:
            logger.error(f"Watchdog worker loop encountered exception: {str(e)}")
            
        await asyncio.sleep(30)
