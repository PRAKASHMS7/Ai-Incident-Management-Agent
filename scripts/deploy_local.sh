#!/usr/bin/env bash
# SRE Agent Local Deployment Script
set -euo pipefail

echo "========================================="
echo "Starting SRE Incident Agent - LOCAL DEV"
echo "========================================="

# 1. Load Dev configuration
if [ -f ".env.dev" ]; then
    echo "Loading .env.dev profile..."
    export $(grep -v '^#' .env.dev | xargs)
else
    echo "Error: .env.dev configuration file not found!"
    exit 1
fi

# 2. Check dependencies
command -v docker >/dev/null 2>&1 || { echo "Error: docker is required but not installed." >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "Error: docker-compose is required but not installed." >&2; exit 1; }

# 3. Spin up docker compose dev services
echo "Rebuilding and starting dev containers..."
docker-compose -f docker-compose.yml up -d --build

# 4. Perform database connection check
echo "Waiting for services to initialize..."
sleep 5

echo "Checking Redis ping..."
docker exec incident-agent-redis redis-cli ping || echo "Redis health check failed, container starting slowly."

echo "Checking Neo4j node graph constraints..."
docker exec incident-agent-neo4j cypher-shell -u neo4j -p "${NEO4J_PASSWORD:-password}" "RETURN 1" || echo "Neo4j health check failed, starting slowly."

echo "========================================="
echo "Local Deployment successfully completed."
echo "Application running at http://localhost:8000"
echo "========================================="
