"""
Integration Tests for Topology endpoints.
"""

from unittest.mock import MagicMock, patch
import pytest
from fastapi import status
from fastapi.testclient import TestClient

from src.main import app

@pytest.fixture
def client():
    """Returns a test client for the FastAPI app."""
    return TestClient(app)

@pytest.fixture
def sample_payload():
    """Returns a valid topology load payload."""
    return {
      "services": [
        {"name": "payment-service", "language": "python", "version": "v1.2.0"},
        {"name": "api-gateway", "language": "go", "version": "v1.0.0"}
      ],
      "databases": [
        {"name": "payment-db", "type": "postgres"}
      ],
      "dependencies": [
        {"source": "api-gateway", "target": "payment-service", "protocol": "http", "p99_latency_threshold_ms": 250},
        {"source": "payment-service", "target": "payment-db", "protocol": "sql", "p99_latency_threshold_ms": 80}
      ]
    }

@patch("src.api.routes.redis_manager")
@patch("src.api.routes.neo4j_manager")
def test_topology_load_endpoint(mock_neo4j, mock_redis, client, sample_payload):
    """
    Verifies POST /topology/load accepts payload, registers nodes and links,
    flushes Redis caches, and returns success counts.
    """
    mock_driver = MagicMock()
    mock_neo4j.get_driver.return_value = mock_driver
    
    # Mock Redis client keys delete
    mock_redis_client = MagicMock()
    mock_redis.get_client.return_value = mock_redis_client
    mock_redis_client.keys.return_value = ["cache:neo4j:key1"]
    
    response = client.post("/topology/load", json=sample_payload)
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "success"
    assert data["inserted_services"] == 2
    assert data["inserted_databases"] == 1
    assert data["inserted_dependencies"] == 2
    
    # Assert Neo4j client write methods were called
    assert mock_neo4j.create_service_node.call_count == 2
    assert mock_neo4j.create_database_node.call_count == 1
    assert mock_neo4j.create_dependency.call_count == 2
    
    # Assert Redis cache flushing occurred
    mock_redis_client.keys.assert_called_once_with("cache:neo4j:*")
    mock_redis_client.delete.assert_called_once_with("cache:neo4j:key1")

@patch("src.api.routes.neo4j_manager")
def test_topology_services_detail_not_found(mock_neo4j, client):
    """
    Verifies GET /topology/services/{name} returns HTTP 404 if the node does not exist.
    """
    mock_driver = MagicMock()
    mock_neo4j.get_driver.return_value = mock_driver
    
    # Mock driver session to return empty (no node exists)
    mock_session = MagicMock()
    mock_driver.session.return_value.__enter__.return_value = mock_session
    mock_session.run.return_value.single.return_value = None
    
    response = client.get("/topology/services/unknown-service")
    
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "unknown-service" in response.json()["detail"]

@patch("src.api.routes.neo4j_manager")
def test_topology_services_detail_success(mock_neo4j, client):
    """
    Verifies GET /topology/services/{name} returns details and up/down dependency links.
    """
    mock_driver = MagicMock()
    mock_neo4j.get_driver.return_value = mock_driver
    
    # Mock node lookup
    mock_session = MagicMock()
    mock_driver.session.return_value.__enter__.return_value = mock_session
    mock_record = {
        "type": "Service",
        "props": {"name": "payment-service", "language": "python", "version": "v1.2.0"}
    }
    mock_session.run.return_value.single.return_value = mock_record
    
    # Mock up/down values
    mock_neo4j.get_upstreams.return_value = ["api-gateway"]
    mock_neo4j.get_downstreams.return_value = [{"type": "Database", "name": "payment-db"}]
    
    response = client.get("/topology/services/payment-service")
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["name"] == "payment-service"
    assert data["type"] == "Service"
    assert data["properties"] == {"language": "python", "version": "v1.2.0"}
    assert data["upstreams"] == ["api-gateway"]
    assert data["downstreams"] == [{"type": "Database", "name": "payment-db"}]

@patch("src.api.routes.neo4j_manager")
def test_topology_graph_endpoint(mock_neo4j, client):
    """
    Verifies GET /topology/graph returns the full graph layout.
    """
    mock_neo4j.get_full_graph.return_value = {
        "nodes": [
            {"id": "api-gateway", "label": "Service", "properties": {}},
            {"id": "payment-service", "label": "Service", "properties": {}}
        ],
        "edges": [
            {"source": "api-gateway", "target": "payment-service", "properties": {}}
        ]
    }
    
    response = client.get("/topology/graph")
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data["nodes"]) == 2
    assert len(data["edges"]) == 1
