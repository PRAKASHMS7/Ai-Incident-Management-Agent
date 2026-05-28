"""
Redis Client and Repository Module.

Provides connection pool management, client instances, deduplication layers,
and incident state repositories for Redis.
"""

import hashlib
import json
import logging
from typing import Dict, Any, List, Optional
import redis

from src.config import settings
from src.api.schemas import IncidentStateModel
from src.observability.tracer import tracer
from src.observability.metrics import alert_deduplicated_total

logger = logging.getLogger(__name__)

class RedisClientManager:
    """
    Manages the Redis connection lifecycle and state repositories.
    """
    def __init__(self) -> None:
        self.host: str = settings.REDIS_HOST
        self.port: int = settings.REDIS_PORT
        self.db: int = settings.REDIS_DB
        self._client: Optional[redis.Redis] = None

    def get_client(self) -> redis.Redis:
        """
        Retrieves or initializes the Redis client using connection pooling.
        """
        if self._client is None:
            logger.info(
                "Initializing Redis connection pool to %s:%d db=%d",
                self.host,
                self.port,
                self.db
            )
            pool = redis.ConnectionPool(
                host=self.host,
                port=self.port,
                db=self.db,
                password=settings.REDIS_PASSWORD,
                decode_responses=True,
                socket_timeout=5.0,
                socket_connect_timeout=5.0
            )
            self._client = redis.Redis(connection_pool=pool)
        return self._client

    def check_health(self) -> Dict[str, Any]:
        """
        Pings Redis to verify that the service is operational.
        """
        with tracer.start_as_current_span("redis.check_health") as span:
            span.set_attribute("db.system", "redis")
            span.set_attribute("db.operation", "check_health")
            try:
                client = self.get_client()
                is_alive = client.ping()
                if is_alive:
                    return {
                        "status": "healthy",
                        "details": {
                            "host": self.host,
                            "port": self.port,
                            "db": self.db,
                            "ping": "pong"
                        }
                    }
                return {
                    "status": "unhealthy",
                    "details": "Ping did not return a successful response."
                }
            except redis.RedisError as e:
                logger.error("Redis health check failed: %s", str(e), exc_info=True)
                span.record_exception(e)
                return {
                    "status": "unhealthy",
                    "details": f"Connection failed: {str(e)}"
                }

    def check_deduplicate(
        self,
        alertname: str,
        service: str,
        severity: str,
        instance: Optional[str] = None
    ) -> bool:
        """
        Calculates a unique hash for an alert and checks if it has fired recently.
        If unique, saves it with a 60-second TTL to collapse duplicates.
        
        Returns:
            bool: True if it is a duplicate (should be dropped), False if it is unique.
        """
        with tracer.start_as_current_span("redis.check_deduplicate") as span:
            span.set_attribute("db.system", "redis")
            span.set_attribute("db.operation", "check_deduplicate")
            span.set_attribute("redis.alertname", alertname)
            span.set_attribute("redis.service", service)
            
            client = self.get_client()
            
            # Build deterministic hash key
            raw_string = f"{alertname}:{service}:{severity}:{instance or ''}"
            alert_hash = hashlib.sha256(raw_string.encode("utf-8")).hexdigest()
            redis_key = f"dedup:alert:{alert_hash}"
            span.set_attribute("redis.key", redis_key)
            
            try:
                # Try to set the key only if it does not exist (NX) with a 60s TTL (EX)
                success = client.set(redis_key, "1", ex=60, nx=True)
                if success:
                    logger.debug("Deduplication check passed. New alert hash: %s", alert_hash)
                    span.set_attribute("redis.duplicate", False)
                    return False
                logger.info("Alert deduplicated. Dropping alert: %s", raw_string)
                span.set_attribute("redis.duplicate", True)
                
                # Increment SRE Alert deduplicated counter
                alert_deduplicated_total.labels(service=service, alertname=alertname).inc()
                return True
            except redis.RedisError as e:
                logger.error("Deduplication lookup failed, defaulting to allow alert: %s", str(e))
                span.record_exception(e)
                return False

    def save_incident(self, incident: IncidentStateModel) -> None:
        """
        Saves or updates an incident's full state payload in Redis.
        Maintains active indices.
        """
        with tracer.start_as_current_span("redis.write") as span:
            span.set_attribute("db.system", "redis")
            span.set_attribute("db.operation", "save_incident")
            
            client = self.get_client()
            incident_key = f"incident:state:{incident.id}"
            active_set_key = "incident:active_ids"
            span.set_attribute("redis.key", incident_key)
            
            # Serialize Model using Pydantic
            serialized_data = incident.model_dump_json()
            
            try:
                # Save incident state (24-hour expiration)
                client.set(incident_key, serialized_data, ex=86400)
                
                # Manage active ID indexing based on state transitions
                if incident.state in ["open", "analyzing", "awaiting_approval", "escalated"]:
                    client.sadd(active_set_key, incident.id)
                    # Map affected services
                    for service in incident.services_affected:
                        client.sadd(f"service:active_incidents:{service}", incident.id)
                else:
                    # If resolved or merged, remove from active indices
                    client.srem(active_set_key, incident.id)
                    for service in incident.services_affected:
                        client.srem(f"service:active_incidents:{service}", incident.id)
                        
                logger.info("Saved incident %s (state=%s)", incident.id, incident.state)
            except redis.RedisError as e:
                logger.error("Failed to save incident %s to Redis: %s", incident.id, str(e))
                span.record_exception(e)

    def get_incident(self, incident_id: str) -> Optional[IncidentStateModel]:
        """
        Retrieves a single incident from Redis by its ID.
        """
        with tracer.start_as_current_span("redis.read") as span:
            span.set_attribute("db.system", "redis")
            span.set_attribute("db.operation", "get_incident")
            
            client = self.get_client()
            incident_key = f"incident:state:{incident_id}"
            span.set_attribute("redis.key", incident_key)
            
            try:
                data = client.get(incident_key)
                if data:
                    span.set_attribute("redis.cache_hit", True)
                    return IncidentStateModel.model_validate_json(data)
                span.set_attribute("redis.cache_hit", False)
                return None
            except redis.RedisError as e:
                logger.error("Failed to retrieve incident %s: %s", incident_id, str(e))
                span.record_exception(e)
                return None

    def get_active_incidents(self) -> List[IncidentStateModel]:
        """
        Fetches all active incidents currently indexed in Redis.
        Cleans up expired incident IDs from index sets on the fly.
        """
        with tracer.start_as_current_span("redis.read") as span:
            span.set_attribute("db.system", "redis")
            span.set_attribute("db.operation", "get_active_incidents")
            
            client = self.get_client()
            active_set_key = "incident:active_ids"
            
            try:
                active_ids = client.smembers(active_set_key)
                incidents = []
                for inc_id in active_ids:
                    inc = self.get_incident(inc_id)
                    if inc:
                        incidents.append(inc)
                    else:
                        # Clean up expired active ID from index sets to prevent leakage
                        logger.warning("Active incident %s has expired from state. Cleaning index.", inc_id)
                        client.srem(active_set_key, inc_id)
                return incidents
            except redis.RedisError as e:
                logger.error("Failed to list active incidents: %s", str(e))
                span.record_exception(e)
                return []

    def flush_all(self) -> None:
        """
        Clears all keys in the current Redis database (used for testing).
        """
        client = self.get_client()
        try:
            client.flushdb()
        except redis.RedisError as e:
            logger.error("FlushDB failed: %s", str(e))

# Global singleton client manager
redis_manager = RedisClientManager()
