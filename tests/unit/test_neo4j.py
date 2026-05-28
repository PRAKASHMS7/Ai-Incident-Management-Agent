"""
Unit Tests for Neo4j Client Manager.
"""

from unittest.mock import MagicMock, patch
import pytest

from src.database.neo4j_client import Neo4jClientManager

@pytest.fixture
def manager():
    """Returns a Neo4jClientManager instance with mocked driver."""
    mgr = Neo4jClientManager()
    mgr._driver = MagicMock()
    return mgr

def test_create_service_node(manager):
    """Verifies Cypher upsert query structure for Service nodes."""
    mock_session = MagicMock()
    manager._driver.session.return_value.__enter__.return_value = mock_session
    
    manager.create_service_node("payment-service", "python", "v1.2.0")
    
    # Assert query execution
    mock_session.run.assert_called_once()
    args, kwargs = mock_session.run.call_args
    assert "MERGE (s:Service {name: $name})" in args[0]
    assert kwargs["name"] == "payment-service"
    assert kwargs["language"] == "python"
    assert kwargs["version"] == "v1.2.0"

def test_create_database_node(manager):
    """Verifies Cypher upsert query structure for Database nodes."""
    mock_session = MagicMock()
    manager._driver.session.return_value.__enter__.return_value = mock_session
    
    manager.create_database_node("payment-db", "postgres")
    
    mock_session.run.assert_called_once()
    args, kwargs = mock_session.run.call_args
    assert "MERGE (d:Database {name: $name})" in args[0]
    assert kwargs["name"] == "payment-db"
    assert kwargs["db_type"] == "postgres"

def test_create_dependency(manager):
    """Verifies Cypher relationship merge query structure."""
    mock_session = MagicMock()
    manager._driver.session.return_value.__enter__.return_value = mock_session
    
    manager.create_dependency("api-gateway", "payment-service", "http", 250)
    
    mock_session.run.assert_called_once()
    args, kwargs = mock_session.run.call_args
    assert "MERGE (n1)-[r:DEPENDS_ON]->(n2)" in args[0]
    assert kwargs["source"] == "api-gateway"
    assert kwargs["target"] == "payment-service"
    assert kwargs["protocol"] == "http"
    assert kwargs["p99"] == 250

def test_get_upstreams(manager):
    """Verifies query mapping for upstream dependencies."""
    mock_session = MagicMock()
    manager._driver.session.return_value.__enter__.return_value = mock_session
    
    # Mock return list
    mock_record1 = {"name": "api-gateway"}
    mock_session.run.return_value = [mock_record1]
    
    upstreams = manager.get_upstreams("payment-service")
    
    assert upstreams == ["api-gateway"]
    mock_session.run.assert_called_once()
    args, kwargs = mock_session.run.call_args
    assert "MATCH (upstream:Service)-[:DEPENDS_ON]->(s)" in args[0]
    assert kwargs["name"] == "payment-service"

def test_get_downstreams(manager):
    """Verifies query mapping for downstream dependencies."""
    mock_session = MagicMock()
    manager._driver.session.return_value.__enter__.return_value = mock_session
    
    mock_record1 = {"type": "Database", "name": "payment-db"}
    mock_session.run.return_value = [mock_record1]
    
    downstreams = manager.get_downstreams("payment-service")
    
    assert downstreams == [{"type": "Database", "name": "payment-db"}]
    mock_session.run.assert_called_once()
    args, kwargs = mock_session.run.call_args
    assert "MATCH (s)-[:DEPENDS_ON]->(downstream)" in args[0]
    assert kwargs["name"] == "payment-service"

def test_get_full_graph(manager):
    """Verifies complete graph schema representation fetching."""
    mock_session = MagicMock()
    manager._driver.session.return_value.__enter__.return_value = mock_session
    
    # Mock records
    mock_node_record = {"type": "Service", "props": {"name": "payment-service", "language": "python"}}
    mock_edge_record = {"source": "api-gateway", "target": "payment-service", "props": {"protocol": "http"}}
    
    # Setup multi-query runs
    mock_session.run.side_effect = [
        [mock_node_record],
        [mock_edge_record]
    ]
    
    graph = manager.get_full_graph()
    
    assert "nodes" in graph
    assert "edges" in graph
    assert len(graph["nodes"]) == 1
    assert graph["nodes"][0]["id"] == "payment-service"
    assert graph["nodes"][0]["label"] == "Service"
    assert graph["nodes"][0]["properties"] == {"language": "python"}
    
    assert len(graph["edges"]) == 1
    assert graph["edges"][0]["source"] == "api-gateway"
    assert graph["edges"][0]["target"] == "payment-service"
    assert graph["edges"][0]["properties"] == {"protocol": "http"}

@patch("src.database.neo4j_client.redis_manager")
def test_check_dependency_path_cache_hit(mock_redis_mgr, manager):
    """Verifies that check_dependency_path reads from Redis cache and bypasses Neo4j on hit."""
    mock_redis_client = MagicMock()
    mock_redis_mgr.get_client.return_value = mock_redis_client
    
    # Cache hit returns "1" (True)
    mock_redis_client.get.return_value = "1"
    
    # Call method
    connected = manager.check_dependency_path("api-gateway", ["payment-service"])
    
    assert connected is True
    mock_redis_client.get.assert_called_once()
    # Neo4j driver session should not be opened
    manager._driver.session.assert_not_called()

@patch("src.database.neo4j_client.redis_manager")
def test_check_dependency_path_cache_miss(mock_redis_mgr, manager):
    """Verifies that check_dependency_path queries Neo4j on cache miss and stores results in Redis."""
    mock_redis_client = MagicMock()
    mock_redis_mgr.get_client.return_value = mock_redis_client
    
    # Cache miss returns None
    mock_redis_client.get.return_value = None
    
    # Mock Neo4j session returning query match
    mock_session = MagicMock()
    manager._driver.session.return_value.__enter__.return_value = mock_session
    mock_record = MagicMock()
    mock_record.__getitem__.side_effect = lambda key: True if key == "connected" else None
    mock_session.run.return_value.single.return_value = mock_record
    
    # Call method
    connected = manager.check_dependency_path("api-gateway", ["payment-service"])
    
    assert connected is True
    mock_redis_client.get.assert_called_once()
    mock_session.run.assert_called_once()
    # Assert result written back to cache with 300s expiration
    mock_redis_client.set.assert_called_once_with(
        "cache:neo4j:api-gateway:payment-service",
        "1",
        ex=300
    )
