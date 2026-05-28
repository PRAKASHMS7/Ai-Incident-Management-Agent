import os
import tempfile
import pytest
from fastapi.testclient import TestClient
from src.main import app
from src.config import resolve_secret_value, Settings

client = TestClient(app)

def test_secrets_resolution_env_vars():
    """
    Verifies that resolve_secret_value returns the value as is if it's standard text.
    """
    assert resolve_secret_value("standard_value") == "standard_value"
    assert resolve_secret_value(None) is None

def test_secrets_resolution_docker_secrets():
    """
    Verifies that resolve_secret_value resolves file paths (Docker secrets).
    """
    with tempfile.NamedTemporaryFile(mode="w+", delete=False) as temp_file:
        temp_file.write("secret_password_123\n")
        temp_file_path = temp_file.name

    try:
        resolved = resolve_secret_value(temp_file_path)
        assert resolved == "secret_password_123"
    finally:
        os.remove(temp_file_path)

def test_secrets_resolution_vault_placeholders():
    """
    Verifies that resolve_secret_value parses vault placeholders.
    """
    vault_str = "vault:secret/data/sre/groq#api_key"
    resolved = resolve_secret_value(vault_str)
    assert resolved == "vault_resolved_api_key_from_secret_data_sre_groq"

def test_health_endpoints_health_checks():
    """
    Verifies FastAPI health endpoints return expected schema structures.
    """
    response = client.get("/health")
    assert response.status_code in [200, 503]  # Accept both (depends on if Redis/Neo4j mock are active)
    data = response.json()
    assert "status" in data
    assert "components" in data
    assert "redis" in data["components"]
    assert "neo4j" in data["components"]

def test_deployment_env_profiles_exist():
    """
    Asserts that environment profile files exist in the workspace.
    """
    assert os.path.exists(".env.dev")
    assert os.path.exists(".env.test")
    assert os.path.exists(".env.prod")
    assert os.path.exists("docker-compose.prod.yml")
    assert os.path.exists("nginx.prod.conf")
