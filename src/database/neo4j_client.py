"""
Neo4j Client Module.

Provides driver management, session helpers, health checks, and path traversal queries for Neo4j.
"""

import logging
import json
from typing import Dict, Any, List, Optional
from neo4j import GraphDatabase, Driver
from neo4j.exceptions import Neo4jError
from neo4j.time import DateTime

from src.config import settings
from src.database.redis_client import redis_manager
from src.observability.tracer import tracer

logger = logging.getLogger(__name__)


def _convert_neo4j_datetime(val: Any) -> Any:
    """
    Recursively converts Neo4j DateTime objects into strings.
    Also handles dictionaries, lists, and tuples recursively.
    """
    if isinstance(val, DateTime):
        return str(val)
    elif isinstance(val, dict):
        return {k: _convert_neo4j_datetime(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [_convert_neo4j_datetime(x) for x in val]
    elif isinstance(val, tuple):
        return tuple(_convert_neo4j_datetime(x) for x in val)
    return val


class Neo4jClientManager:
    """
    Manages the lifecycle, health, indexes, and write/read operations of the Neo4j driver connection.
    """

    def __init__(self) -> None:
        self.uri: str = settings.NEO4J_URI
        self.user: str = settings.NEO4J_USER
        self.password: str = settings.NEO4J_PASSWORD
        self._driver: Optional[Driver] = None

    def get_driver(self) -> Driver:
        """
        Initializes and returns the Neo4j Driver instance.
        """
        if self._driver is None:
            logger.info(
                "Initializing Neo4j Bolt driver to %s as user '%s'", self.uri, self.user
            )
            self._driver = GraphDatabase.driver(
                self.uri,
                auth=(self.user, self.password),
                max_connection_lifetime=30 * 60,
                max_connection_pool_size=50,
                connection_timeout=5.0,
            )
        return self._driver

    def close(self) -> None:
        """
        Closes the Neo4j driver connection pool.
        """
        if self._driver:
            logger.info("Closing Neo4j Bolt driver connection pool")
            self._driver.close()
            self._driver = None

    def setup_constraints_and_indexes(self) -> None:
        """
        Registers required schema constraints and database indexes on Neo4j startup.
        """
        try:
            driver = self.get_driver()
            with driver.session() as session:
                logger.info("Setting up Neo4j schema constraints and indexes...")
                session.run(
                    "CREATE CONSTRAINT unique_service_name IF NOT EXISTS FOR (s:Service) REQUIRE s.name IS UNIQUE;"
                )
                session.run(
                    "CREATE CONSTRAINT unique_db_name IF NOT EXISTS FOR (d:Database) REQUIRE d.name IS UNIQUE;"
                )
                session.run(
                    "CREATE INDEX service_lookup_idx IF NOT EXISTS FOR (s:Service) ON (s.name);"
                )
                logger.info("Neo4j database schema initialization complete.")
        except Exception as e:
            logger.warning(
                "Could not set up Neo4j constraints/indexes (degraded fallback model active): %s",
                str(e),
            )

    def create_service_node(
        self, name: str, language: str = "python", version: str = "latest"
    ) -> None:
        """
        UPSERTs a Service node in the Neo4j dependency graph.
        """
        with tracer.start_as_current_span("neo4j.create_service_node") as span:
            span.set_attribute("db.system", "neo4j")
            span.set_attribute("db.operation", "create_service_node")
            span.set_attribute("neo4j.node.name", name)
            try:
                driver = self.get_driver()
                query = """
                MERGE (s:Service {name: $name})
                ON CREATE SET 
                  s.language = $language, 
                  s.version = $version, 
                  s.updated_at = datetime()
                ON MATCH SET 
                  s.language = COALESCE($language, s.language),
                  s.version = COALESCE($version, s.version), 
                  s.updated_at = datetime()
                """
                with driver.session() as session:
                    session.run(query, name=name, language=language, version=version)
                    logger.info("Upserted Neo4j Service node: %s", name)
            except Exception as e:
                logger.error("Failed to create Service node %s: %s", name, str(e))
                span.record_exception(e)
                raise e

    def create_database_node(self, name: str, db_type: str) -> None:
        """
        UPSERTs a Database node in the Neo4j dependency graph.
        """
        with tracer.start_as_current_span("neo4j.create_database_node") as span:
            span.set_attribute("db.system", "neo4j")
            span.set_attribute("db.operation", "create_database_node")
            span.set_attribute("neo4j.node.name", name)
            try:
                driver = self.get_driver()
                query = """
                MERGE (d:Database {name: $name})
                ON CREATE SET 
                  d.type = $db_type, 
                  d.updated_at = datetime()
                ON MATCH SET 
                  d.type = COALESCE($db_type, d.type), 
                  d.updated_at = datetime()
                """
                with driver.session() as session:
                    session.run(query, name=name, db_type=db_type)
                    logger.info("Upserted Neo4j Database node: %s", name)
            except Exception as e:
                logger.error("Failed to create Database node %s: %s", name, str(e))
                span.record_exception(e)
                raise e

    def create_dependency(
        self,
        source: str,
        target: str,
        protocol: str = "http",
        p99_latency_threshold_ms: int = 200,
    ) -> None:
        """
        Establishes a DEPENDS_ON relationship between source and target nodes.
        Uses label-specific indexes for source and target lookups.
        """
        with tracer.start_as_current_span("neo4j.create_dependency") as span:
            span.set_attribute("db.system", "neo4j")
            span.set_attribute("db.operation", "create_dependency")
            span.set_attribute("neo4j.relationship.source", source)
            span.set_attribute("neo4j.relationship.target", target)
            try:
                driver = self.get_driver()
                query = """
                OPTIONAL MATCH (s1:Service {name: $source})
                OPTIONAL MATCH (d1:Database {name: $source})
                WITH COALESCE(s1, d1) AS n1
                WHERE n1 IS NOT NULL
                
                OPTIONAL MATCH (s2:Service {name: $target})
                OPTIONAL MATCH (d2:Database {name: $target})
                WITH n1, COALESCE(s2, d2) AS n2
                WHERE n2 IS NOT NULL
                
                MERGE (n1)-[r:DEPENDS_ON]->(n2)
                ON CREATE SET 
                  r.protocol = $protocol, 
                  r.p99_latency_threshold_ms = $p99,
                  r.updated_at = datetime()
                ON MATCH SET 
                  r.protocol = COALESCE($protocol, r.protocol), 
                  r.p99_latency_threshold_ms = COALESCE($p99, r.p99_latency_threshold_ms),
                  r.updated_at = datetime()
                """
                with driver.session() as session:
                    session.run(
                        query,
                        source=source,
                        target=target,
                        protocol=protocol,
                        p99=p99_latency_threshold_ms,
                    )
                    logger.info(
                        "Established Neo4j dependency relation: %s -> %s",
                        source,
                        target,
                    )
            except Exception as e:
                logger.error(
                    "Failed to create dependency relation %s -> %s: %s",
                    source,
                    target,
                    str(e),
                )
                span.record_exception(e)
                raise e

    def get_upstreams(self, name: str) -> List[str]:
        """
        Returns all service names that directly depend on the specified node.
        Cached in Redis for 5 minutes.
        """
        with tracer.start_as_current_span("neo4j.get_upstreams") as span:
            span.set_attribute("db.system", "neo4j")
            span.set_attribute("db.operation", "get_upstreams")
            span.set_attribute("neo4j.node.name", name)
            cache_key = f"cache:neo4j:upstreams:{name}"
            try:
                redis_client = redis_manager.get_client()
                cached_val = redis_client.get(cache_key)
                if cached_val is not None:
                    logger.debug("Neo4j upstreams cache hit for %s", name)
                    span.set_attribute("redis.cache_hit", True)
                    return json.loads(cached_val)
                span.set_attribute("redis.cache_hit", False)
            except Exception as e:
                logger.warning(
                    "Failed to query Redis cache for Neo4j upstreams: %s", str(e)
                )

            try:
                driver = self.get_driver()
                query = """
                OPTIONAL MATCH (s1:Service {name: $name})
                OPTIONAL MATCH (d1:Database {name: $name})
                WITH COALESCE(s1, d1) AS s
                WHERE s IS NOT NULL
                MATCH (upstream:Service)-[:DEPENDS_ON]->(s)
                RETURN upstream.name AS name
                """
                with driver.session() as session:
                    result = session.run(query, name=name)
                    upstreams = [record["name"] for record in result]

                try:
                    redis_client = redis_manager.get_client()
                    redis_client.set(cache_key, json.dumps(upstreams), ex=300)
                except Exception as e:
                    logger.warning(
                        "Failed to write Neo4j upstreams to cache: %s", str(e)
                    )

                return upstreams
            except Exception as e:
                logger.error(
                    "Failed to retrieve upstream dependencies for %s: %s", name, str(e)
                )
                span.record_exception(e)
                return []

    def get_downstreams(self, name: str) -> List[Dict[str, str]]:
        """
        Returns details of nodes that the specified node directly depends on.
        Cached in Redis for 5 minutes.
        """
        with tracer.start_as_current_span("neo4j.get_downstreams") as span:
            span.set_attribute("db.system", "neo4j")
            span.set_attribute("db.operation", "get_downstreams")
            span.set_attribute("neo4j.node.name", name)
            cache_key = f"cache:neo4j:downstreams:{name}"
            try:
                redis_client = redis_manager.get_client()
                cached_val = redis_client.get(cache_key)
                if cached_val is not None:
                    logger.debug("Neo4j downstreams cache hit for %s", name)
                    span.set_attribute("redis.cache_hit", True)
                    return json.loads(cached_val)
                span.set_attribute("redis.cache_hit", False)
            except Exception as e:
                logger.warning(
                    "Failed to query Redis cache for Neo4j downstreams: %s", str(e)
                )

            try:
                driver = self.get_driver()
                query = """
                OPTIONAL MATCH (s1:Service {name: $name})
                OPTIONAL MATCH (d1:Database {name: $name})
                WITH COALESCE(s1, d1) AS s
                WHERE s IS NOT NULL
                MATCH (s)-[:DEPENDS_ON]->(downstream)
                RETURN labels(downstream)[0] AS type, downstream.name AS name
                """
                with driver.session() as session:
                    result = session.run(query, name=name)
                    downstreams = [
                        {"type": record["type"], "name": record["name"]}
                        for record in result
                    ]

                try:
                    redis_client = redis_manager.get_client()
                    redis_client.set(cache_key, json.dumps(downstreams), ex=300)
                except Exception as e:
                    logger.warning(
                        "Failed to write Neo4j downstreams to cache: %s", str(e)
                    )

                return downstreams
            except Exception as e:
                logger.error(
                    "Failed to retrieve downstream dependencies for %s: %s",
                    name,
                    str(e),
                )
                span.record_exception(e)
                return []

    def get_full_graph(self) -> Dict[str, List[Any]]:
        """
        Fetches the complete topology representation (nodes and relationships).
        """
        with tracer.start_as_current_span("neo4j.get_full_graph") as span:
            span.set_attribute("db.system", "neo4j")
            span.set_attribute("db.operation", "get_full_graph")
            try:
                driver = self.get_driver()
                nodes = []
                edges = []

                with driver.session() as session:
                    # Query all nodes
                    nodes_res = session.run(
                        "MATCH (n) RETURN labels(n)[0] AS type, properties(n) AS props"
                    )
                    for r in nodes_res:
                        props = r["props"]
                        converted_props = _convert_neo4j_datetime(props)
                        nodes.append(
                            {
                                "id": converted_props.get("name"),
                                "label": r["type"],
                                "properties": {
                                    k: v
                                    for k, v in converted_props.items()
                                    if k != "name"
                                },
                            }
                        )

                    # Query all dependency relations
                    edges_res = session.run(
                        "MATCH (n1)-[r:DEPENDS_ON]->(n2) RETURN n1.name AS source, n2.name AS target, properties(r) AS props"
                    )
                    for r in edges_res:
                        converted_edge_props = _convert_neo4j_datetime(r["props"])
                        edges.append(
                            {
                                "source": r["source"],
                                "target": r["target"],
                                "properties": converted_edge_props,
                            }
                        )

                return {"nodes": nodes, "edges": edges}
            except Exception as e:
                logger.error("Failed to retrieve full database graph: %s", str(e))
                span.record_exception(e)
                return {"nodes": [], "edges": []}

    def check_health(self) -> Dict[str, Any]:
        """
        Performs a health check by running a simple Cypher query.
        """
        with tracer.start_as_current_span("neo4j.check_health") as span:
            span.set_attribute("db.system", "neo4j")
            span.set_attribute("db.operation", "check_health")
            try:
                driver = self.get_driver()
                driver.verify_connectivity()

                with driver.session() as session:
                    result = session.run("RETURN 1 AS check")
                    record = result.single()
                    if record and record["check"] == 1:
                        return {
                            "status": "healthy",
                            "details": {
                                "uri": self.uri,
                                "user": self.user,
                                "connection": "verified",
                                "query_test": "passed",
                            },
                        }
                return {
                    "status": "unhealthy",
                    "details": "Test query executed but failed to return expected value.",
                }
            except Neo4jError as e:
                logger.error(
                    "Neo4j database error during health check: %s",
                    str(e),
                    exc_info=True,
                )
                span.record_exception(e)
                return {
                    "status": "unhealthy",
                    "details": f"Database query failed: {str(e)}",
                }
            except Exception as e:
                logger.error(
                    "Unexpected exception during Neo4j health check: %s",
                    str(e),
                    exc_info=True,
                )
                span.record_exception(e)
                return {
                    "status": "unhealthy",
                    "details": f"Connection failed: {str(e)}",
                }

    def check_dependency_path(self, service_a: str, services_list: List[str]) -> bool:
        """
        Queries Neo4j to find if there is a dependency path (depth 1 or 2)
        between service_a and any service in services_list.

        Uses Redis to cache query results for 5 minutes (300 seconds).
        Degrades gracefully by returning False and logging a warning if Neo4j is down.
        """
        with tracer.start_as_current_span("neo4j.check_dependency_path") as span:
            span.set_attribute("db.system", "neo4j")
            span.set_attribute("db.operation", "check_dependency_path")
            span.set_attribute("neo4j.service_a", service_a)
            span.set_attribute("neo4j.services_list", services_list)

            if not services_list:
                return False

            # Create deterministic cache key
            sorted_services = sorted(services_list)
            services_str = ",".join(sorted_services)
            cache_key = f"cache:neo4j:{service_a}:{services_str}"

            # 1. Attempt to fetch from Redis Cache
            try:
                redis_client = redis_manager.get_client()
                cached_val = redis_client.get(cache_key)
                if cached_val is not None:
                    logger.debug(
                        "Neo4j path search cache hit for %s -> %s",
                        service_a,
                        services_str,
                    )
                    span.set_attribute("redis.cache_hit", True)
                    return cached_val == "1"
                span.set_attribute("redis.cache_hit", False)
            except Exception as e:
                logger.warning(
                    "Failed to query Redis cache for Neo4j path search: %s", str(e)
                )

            # 2. Query Neo4j on Cache Miss
            try:
                driver = self.get_driver()
                query = """
                MATCH p = (s1:Service)-[:DEPENDS_ON*1..2]-(s2:Service)
                WHERE s1.name = $service_a AND s2.name IN $services_list
                RETURN count(p) > 0 AS connected
                """
                connected = False
                with driver.session() as session:
                    result = session.run(
                        query, service_a=service_a, services_list=services_list
                    )
                    record = result.single()
                    if record:
                        connected = bool(record["connected"])

                # 3. Store result in Redis Cache (5-minute TTL)
                try:
                    redis_client = redis_manager.get_client()
                    redis_client.set(cache_key, "1" if connected else "0", ex=300)
                except Exception as e:
                    logger.warning(
                        "Failed to write Neo4j path search to cache: %s", str(e)
                    )

                return connected
            except Exception as e:
                logger.warning(
                    "Neo4j path search failed or database is offline. Falling back to default correlation. Error: %s",
                    str(e),
                )
                span.record_exception(e)
                return False


# Global singleton client manager
neo4j_manager = Neo4jClientManager()
