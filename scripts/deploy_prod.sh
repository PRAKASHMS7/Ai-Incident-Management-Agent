#!/usr/bin/env bash
# SRE Agent Production Deployment Script
set -euo pipefail

echo "========================================="
echo "Starting SRE Incident Agent - PRODUCTION"
echo "========================================="

# 1. Load Prod profile
if [ -f ".env.prod" ]; then
    echo "Loading .env.prod profile..."
    export $(grep -v '^#' .env.prod | xargs)
else
    echo "Error: .env.prod configuration file not found!"
    exit 1
fi

# 2. Check dependencies
command -v docker >/dev/null 2>&1 || { echo "Error: docker is required but not installed." >&2; exit 1; }

# 3. Validate Docker Compose config file
echo "Validating docker-compose.prod.yml schema..."
docker compose -f docker-compose.prod.yml config >/dev/null

# 4. Pull and launch production services in daemon mode
echo "Pulling production images & launching containers..."
docker compose -f docker-compose.prod.yml up -d --build

# 5. Wait for database check and verification
echo "Waiting 15 seconds for production systems to start..."
sleep 15

# Verify container health statuses
echo "Verifying running container states..."
docker compose -f docker-compose.prod.yml ps

# Confirm backend health probe responds
echo "Calling backend health probe..."
HEALTH_CHECK_STATUS=$(docker exec sre_backend curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health || echo "500")
if [ "$HEALTH_CHECK_STATUS" -eq 200 ]; then
    echo "Backend and datastores are fully operational (HTTP 200)!"
else
    echo "Warning: Health checks failed with HTTP status: $HEALTH_CHECK_STATUS."
    echo "Check logs using: docker compose -f docker-compose.prod.yml logs backend"
fi

echo "========================================="
echo "Production Deployment completed."
echo "Access reverse proxy dashboard on http://localhost"
echo "========================================="
